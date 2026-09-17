import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { applyOp, applyOps, emptyDoc, isProgressDoc } from './doc';
import { GitHubError, readPublic, readRemote, writeRemote } from './github';
import { PUBLIC_PROGRESS } from '../config';
import type { GitHubSettings } from './github';
import type { Op, ProgressDoc } from './types';
import { storage } from './storage';

const KEY_BASE = 'pt:base';
const KEY_SHA = 'pt:sha';
const KEY_PENDING = 'pt:pending';
const KEY_GITHUB = 'pt:github';
const SAVE_DELAY = 2000;

export type SyncStatus = 'local' | 'readonly' | 'loading' | 'synced' | 'pending' | 'saving' | 'error' | 'offline';

interface StoreState {
  doc: ProgressDoc;
  dispatch: (op: Op) => void;
  status: SyncStatus;
  error: string | null;
  lastSync: Date | null;
  github: GitHubSettings | null;
  setGithub: (s: GitHubSettings | null, opts?: { uploadLocal?: boolean }) => void;
  syncNow: () => Promise<void>;
  pendingCount: number;
  /** sin token y con progreso público: solo lectura */
  readOnly: boolean;
}

const StoreContext = createContext<StoreState | null>(null);

export function StoreProvider ({ children }: { children: ReactNode }) {
  const [base, setBase] = useState<ProgressDoc>(() => {
    const v = storage.getJSON<ProgressDoc>(KEY_BASE);
    return isProgressDoc(v) ? v : emptyDoc();
  });
  const [pending, setPending] = useState<Op[]>(() => storage.getJSON<Op[]>(KEY_PENDING) || []);
  const [github, setGithubState] = useState<GitHubSettings | null>(() => storage.getJSON<GitHubSettings>(KEY_GITHUB));
  const readOnly = !github && Boolean(PUBLIC_PROGRESS);
  const [status, setStatus] = useState<SyncStatus>(github || readOnly ? 'loading' : 'local');
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // refs para que la sincronización lea siempre el último valor
  const shaRef = useRef<string | null>(storage.get(KEY_SHA));
  const baseRef = useRef(base);
  const pendingRef = useRef(pending);
  const githubRef = useRef(github);
  const busyRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);

  baseRef.current = base;
  pendingRef.current = pending;
  githubRef.current = github;

  useEffect(() => storage.setJSON(KEY_BASE, base), [base]);
  useEffect(() => storage.setJSON(KEY_PENDING, pending), [pending]);

  const doc = useMemo(() => applyOps(base, pending), [base, pending]);

  const setSha = (sha: string | null) => {
    shaRef.current = sha;
    if (sha) storage.set(KEY_SHA, sha); else storage.remove(KEY_SHA);
  };

  /** Sin GitHub: las operaciones se consolidan directamente en la base local. */
  const commitLocally = useCallback(() => {
    if (pendingRef.current.length === 0) return;
    setBase((b) => applyOps(b, pendingRef.current));
    setPending([]);
  }, []);

  const pull = useCallback(async () => {
    const gh = githubRef.current;
    if (!gh) return;
    const remote = await readRemote(gh);
    if (remote) {
      if (!isProgressDoc(remote.doc)) throw new Error('El fichero remoto no tiene el formato esperado');
      setBase(remote.doc);
      baseRef.current = remote.doc;
      setSha(remote.sha);
    } else {
      // El fichero no existe: se creará en el primer guardado con lo que haya en local
      setSha(null);
    }
  }, []);

  const push = useCallback(async () => {
    const gh = githubRef.current;
    if (!gh || busyRef.current) return;
    busyRef.current = true;
    setStatus('saving');
    setError(null);
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const sent = pendingRef.current;
        const next = applyOps(baseRef.current, sent);
        const firstPush = shaRef.current === null && sent.length === 0;
        if (sent.length === 0 && !firstPush) break;
        try {
          const sha = await writeRemote(gh, next, shaRef.current);
          setSha(sha);
          setBase(next);
          baseRef.current = next;
          // lo que se añadió mientras guardábamos queda pendiente
          setPending((p) => p.slice(sent.length));
          pendingRef.current = pendingRef.current.slice(sent.length);
          break;
        } catch (e) {
          if (e instanceof GitHubError && (e.status === 409 || e.status === 422) && attempt < 2) {
            // Otro dispositivo guardó antes: traemos su versión y reaplicamos nuestros cambios encima
            await pull();
            continue;
          }
          throw e;
        }
      }
      setLastSync(new Date());
      setStatus(pendingRef.current.length ? 'pending' : 'synced');
    } catch (e) {
      const offline = !navigator.onLine;
      setStatus(offline ? 'offline' : 'error');
      setError(offline ? 'Sin conexión: los cambios se guardarán al volver' : (e as Error).message);
    } finally {
      busyRef.current = false;
      if (pendingRef.current.length && githubRef.current) schedule();
    }
  }, [pull]);

  const schedule = useCallback((delay = SAVE_DELAY) => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      void push();
    }, delay);
  }, [push]);

  const loadPublic = useCallback(async () => {
    if (!PUBLIC_PROGRESS) return;
    setError(null);
    try {
      const remote = await readPublic(PUBLIC_PROGRESS);
      if (githubRef.current) return; // se ha conectado mientras tanto
      if (remote && !isProgressDoc(remote)) throw new Error('El fichero remoto no tiene el formato esperado');
      const next = remote || emptyDoc();
      setBase(next);
      baseRef.current = next;
      setLastSync(new Date());
      setStatus('readonly');
    } catch (e) {
      setStatus(navigator.onLine ? 'error' : 'offline');
      setError(`Modo lectura: ${(e as Error).message}`);
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (!githubRef.current) {
      if (PUBLIC_PROGRESS) await loadPublic();
      return;
    }
    if (busyRef.current) return;
    setStatus('loading');
    setError(null);
    try {
      await pull();
      await push();
      if (!pendingRef.current.length) {
        setStatus('synced');
        setLastSync(new Date());
      }
    } catch (e) {
      setStatus(navigator.onLine ? 'error' : 'offline');
      setError((e as Error).message);
    }
  }, [pull, push]);

  // Carga inicial / cambio de configuración
  useEffect(() => {
    if (github) {
      void syncNow();
    } else if (PUBLIC_PROGRESS) {
      pendingRef.current = [];
      setPending([]);
      setSha(null);
      setStatus('loading');
      void loadPublic();
    } else {
      commitLocally();
      setStatus('local');
    }
  }, [github]);

  // Reintentar al recuperar conexión y al volver a la pestaña
  useEffect(() => {
    const onOnline = () => void syncNow();
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !busyRef.current && !pendingRef.current.length) {
        void syncNow();
      }
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (githubRef.current && pendingRef.current.length) {
        e.preventDefault();
      }
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [syncNow]);

  const dispatch = useCallback((op: Op) => {
    if (!githubRef.current) {
      if (PUBLIC_PROGRESS) return; // modo lectura
      setBase((b) => applyOp(b, op));
      return;
    }
    const next = [...pendingRef.current, op];
    pendingRef.current = next;
    setPending(next);
    setStatus((s) => (s === 'saving' ? s : 'pending'));
    schedule();
  }, [schedule]);

  const setGithub = useCallback((s: GitHubSettings | null, opts: { uploadLocal?: boolean } = {}) => {
    if (s) storage.setJSON(KEY_GITHUB, s); else storage.remove(KEY_GITHUB);
    // Al cambiar de repositorio, el sha anterior deja de servir
    setSha(null);
    if (s && opts.uploadLocal) {
      // Lo que hay en este navegador sustituirá al fichero remoto en el primer guardado
      const current = applyOps(baseRef.current, pendingRef.current);
      const next: Op[] = [{ type: 'replace', doc: current }];
      pendingRef.current = next;
      setPending(next);
    } else if (s && !githubRef.current) {
      // Se descartan los cambios locales pendientes: manda lo que haya en GitHub
      pendingRef.current = [];
      setPending([]);
    }
    githubRef.current = s;
    setGithubState(s);
  }, []);

  const value = useMemo<StoreState>(() => ({
    doc,
    dispatch,
    status,
    error,
    lastSync,
    github,
    setGithub,
    syncNow,
    pendingCount: pending.length,
    readOnly,
  }), [doc, dispatch, status, error, lastSync, github, setGithub, syncNow, pending.length, readOnly]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore () {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore fuera de StoreProvider');
  return ctx;
}

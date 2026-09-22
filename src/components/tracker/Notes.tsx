import classNames from 'classnames';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useStore } from '../../lib/store';
import type { DexConfig, SlotPatch } from '../../lib/types';

interface Props {
  dex: DexConfig;
  entryId: string;
  note: string;
  patch: (p: SlotPatch) => void;
}

const SAVE_DELAY_MS = 600;
export const MAX_NOTE = 1000;

/** Notas libres de cada casilla: desplegable con guardado automático. */
export function Notes ({ dex, entryId, note, patch }: Props) {
  const { readOnly, status } = useStore();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(note);
  const [dirty, setDirty] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const area = useRef<HTMLTextAreaElement>(null);
  // lo que falta por guardar, para no perderlo al cambiar de Pokémon
  const unsaved = useRef<{ text: string; patch: Props['patch'] } | null>(null);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    const u = unsaved.current;
    unsaved.current = null;
    if (u) u.patch({ n: u.text.trim() ? u.text : '' });
    setDirty(false);
  }, []);

  // Al cambiar de Pokémon se guarda lo pendiente y se carga su nota
  useEffect(() => {
    flush();
    setText(note);
  }, [entryId, dex.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Si la nota cambia desde fuera (otro dispositivo) y no se está editando
  useEffect(() => {
    if (!unsaved.current) setText(note);
  }, [note]);

  useEffect(() => flush, [flush]);

  // La caja crece con el texto
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight + 2, 96)}px`;
  }, [text, open]);

  const onChange = (value: string) => {
    setText(value);
    setDirty(true);
    unsaved.current = { text: value, patch };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, SAVE_DELAY_MS);
  };

  const hasNote = note.trim() !== '';

  if (readOnly) {
    if (!hasNote) return null;
    return (
      <div className="info-notes open">
        <div className="info-notes-summary static">Notas</div>
        <p className="info-notes-readonly">{note}</p>
      </div>
    );
  }

  const firstLine = note.split('\n').find((l) => l.trim()) ?? '';
  const saveLabel = dirty ? 'Escribiendo…'
    : status === 'offline' ? 'Sin conexión: se guardará luego'
      : status === 'error' ? 'Error al guardar'
        : status === 'pending' || status === 'saving' ? 'Guardando…'
          : '✓ Guardado';

  return (
    <div className={classNames('info-notes', { open })}>
      <button aria-expanded={open} className="info-notes-summary" onClick={() => setOpen(!open)} type="button">
        <span className="caret">{open ? '▾' : '▸'}</span>
        Notas
        {!open && !hasNote && <span className="add">Añadir…</span>}
      </button>
      {!open && hasNote && (
        <p className="info-notes-preview" onClick={() => setOpen(true)} title={note}>{firstLine}</p>
      )}
      {open && (
        <>
          <textarea
            maxLength={MAX_NOTE}
            onBlur={flush}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Naturaleza, bola, habilidad, qué le falta…"
            ref={area}
            value={text}
          />
          <div className="info-notes-footer">
            <span>Solo para esta dex ({dex.shiny ? 'shiny' : 'normal'})</span>
            <span>{saveLabel}</span>
          </div>
        </>
      )}
    </div>
  );
}

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleNotch, faDownload, faSyncAlt, faUpload } from '@fortawesome/free-solid-svg-icons';
import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

import { Nav, STATUS } from './Nav';
import { isProgressDoc } from '../lib/doc';
import { readRemote, testConnection } from '../lib/github';
import type { GitHubSettings } from '../lib/github';
import { useStore } from '../lib/store';

const DEFAULTS: GitHubSettings = { owner: 'afsenovilla', repo: 'poketracker', branch: 'main', path: 'data/progreso.json', token: '' };

export function SettingsPage () {
  const { doc, dispatch, github, setGithub, status, error, lastSync, syncNow, pendingCount } = useStore();
  const [form, setForm] = useState<GitHubSettings>(github || DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [conflict, setConflict] = useState<GitHubSettings | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof GitHubSettings) => (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value.trim() });

  const hasLocalData = doc.dexes.length > 0;

  const handleConnect = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setConflict(null);
    try {
      const repo = await testConnection(form);
      const remote = await readRemote(form);
      if (!repo.private) {
        setMessage({ type: 'success', text: 'Conectado. El repositorio es público: el progreso se podrá ver, el token no.' });
      } else {
        setMessage({ type: 'success', text: 'Conectado correctamente.' });
      }
      if (remote && hasLocalData && !github) {
        // Hay datos en los dos sitios: que decida el usuario
        setConflict(form);
      } else {
        setGithub(form, { uploadLocal: !remote });
      }
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(doc, null, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `poketracker-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!isProgressDoc(parsed)) throw new Error('El fichero no es una copia de Poketracker');
      if (!window.confirm(`Se sustituirá tu progreso actual por el del fichero (${parsed.dexes.length} dex). ¿Continuar?`)) return;
      dispatch({ type: 'replace', doc: parsed });
      setMessage({ type: 'success', text: 'Copia importada.' });
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    }
  };

  return (
    <div className="account-container">
      <Nav />
      <div className="form settings">
        <h1>Ajustes</h1>
        <form onSubmit={handleConnect}>
          <div className="form-column">
            <h2>Sincronizar con GitHub</h2>
            <p className="settings-help">
              El progreso se guarda como un fichero JSON en tu repositorio (puede ser el mismo de la web). Crea un
              {' '}<a className="link" href="https://github.com/settings/personal-access-tokens/new" rel="noreferrer" target="_blank">token de acceso fine-grained</a>{' '}
              con acceso solo a ese repositorio y el permiso <b>Contents: Read and write</b>.
              El token se guarda únicamente en este navegador.
            </p>

            {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

            {conflict && (
              <div className="alert settings-conflict">
                Ya hay progreso guardado en GitHub y también en este navegador. ¿Cuál quieres conservar?
                <button className="btn btn-blue btn-inline" onClick={() => { setGithub(conflict); setConflict(null); }} type="button">
                  Usar el de GitHub
                </button>
                <button className="btn btn-white btn-inline" onClick={() => { setGithub(conflict, { uploadLocal: true }); setConflict(null); }} type="button">
                  Subir el de este navegador
                </button>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="gh_owner">Usuario u organización</label>
              <input className="form-control" id="gh_owner" onChange={set('owner')} placeholder="afsenovilla" required value={form.owner} />
            </div>
            <div className="form-group">
              <label htmlFor="gh_repo">Repositorio</label>
              <input className="form-control" id="gh_repo" onChange={set('repo')} placeholder="poketracker" required value={form.repo} />
            </div>
            <div className="form-group">
              <label htmlFor="gh_branch">Rama</label>
              <input className="form-control" id="gh_branch" onChange={set('branch')} required value={form.branch} />
            </div>
            <div className="form-group">
              <label htmlFor="gh_path">Ruta del fichero</label>
              <input className="form-control" id="gh_path" onChange={set('path')} required value={form.path} />
            </div>
            <div className="form-group">
              <label htmlFor="gh_token">Token</label>
              <input autoComplete="off" className="form-control" id="gh_token" onChange={set('token')} placeholder="github_pat_…" required type="password" value={form.token} />
            </div>

            <button className="btn btn-blue" disabled={busy} type="submit">
              {busy ? <FontAwesomeIcon icon={faCircleNotch} spin /> : github ? 'Guardar conexión' : 'Conectar'}
            </button>

            {github && (
              <div className="settings-status">
                <p>
                  Estado: <b>{STATUS[status].label}</b>{pendingCount > 0 && ` · ${pendingCount} cambios pendientes`}
                  {lastSync && ` · última sincronización ${lastSync.toLocaleTimeString('es-ES')}`}
                </p>
                {error && <div className="alert alert-error">{error}</div>}
                <div className="settings-actions">
                  <button className="btn btn-yellow btn-inline" onClick={() => void syncNow()} type="button">
                    <FontAwesomeIcon icon={faSyncAlt} /> Sincronizar ahora
                  </button>
                  <button
                    className="btn btn-white btn-inline"
                    onClick={() => {
                      if (window.confirm('Se desconectará GitHub. Tu progreso se quedará en este navegador. ¿Continuar?')) {
                        setGithub(null);
                        setForm(DEFAULTS);
                      }
                    }}
                    type="button"
                  >
                    Desconectar
                  </button>
                </div>
              </div>
            )}

            <h2>Copia de seguridad</h2>
            <div className="settings-actions">
              <button className="btn btn-white btn-inline" onClick={handleExport} type="button">
                <FontAwesomeIcon icon={faDownload} /> Exportar JSON
              </button>
              <button className="btn btn-white btn-inline" onClick={() => fileRef.current?.click()} type="button">
                <FontAwesomeIcon icon={faUpload} /> Importar JSON
              </button>
              <input accept="application/json,.json" hidden onChange={handleImport} ref={fileRef} type="file" />
            </div>

            <p className="settings-credits">
              Basado en <a className="link" href="https://github.com/pokedextracker/pokedextracker.com" rel="noreferrer" target="_blank">PokédexTracker</a> (MIT).
              Datos y sprites de <a className="link" href="https://pokeapi.co" rel="noreferrer" target="_blank">PokéAPI</a>.
              Pokémon y sus nombres son marcas de Nintendo, Game Freak y The Pokémon Company.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

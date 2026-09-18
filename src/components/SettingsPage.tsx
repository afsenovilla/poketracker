import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleNotch, faDownload, faSyncAlt, faUpload } from '@fortawesome/free-solid-svg-icons';
import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

import { Nav, STATUS } from './Nav';
import { PUBLIC_PROGRESS } from '../config';
import { decryptToken, encryptToken, isAccessFile, MIN_PASSWORD } from '../lib/crypto';
import { isProgressDoc } from '../lib/doc';
import { useStore } from '../lib/store';

const ACCESS_FILE = 'acceso.json';

export function SettingsPage () {
  const { doc, dispatch, email, github, login, logout, status, error, lastSync, syncNow, pendingCount, readOnly } = useStore();

  const [form, setForm] = useState({ email: email ?? '', password: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}${ACCESS_FILE}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Todavía no hay ningún acceso creado en esta web');
      const file = await res.json();
      if (!isAccessFile(file)) throw new Error('El fichero de acceso no tiene el formato esperado');
      const token = await decryptToken(form.email, form.password, file).catch(() => {
        throw new Error('Correo o contraseña incorrectos');
      });
      login(form.email.trim(), token);
      setForm({ email: form.email.trim(), password: '' });
      setMessage({ type: 'success', text: 'Sesión iniciada. Se queda guardada en este dispositivo.' });
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
        <h1>{github ? 'Tu cuenta' : 'Entrar'}</h1>
        <form onSubmit={handleLogin}>
          <div className="form-column">
            {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

            {github ? (
              <div className="settings-status">
                <p className="settings-session">
                  Sesión iniciada{email ? <> como <b>{email}</b></> : null}.
                </p>
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
                      if (window.confirm('Se cerrará la sesión en este dispositivo y pasarás a modo lectura. ¿Continuar?')) {
                        logout();
                        setMessage(null);
                      }
                    }}
                    type="button"
                  >
                    Cerrar sesión
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="settings-help">
                  Entra con tu correo y tu contraseña para poder editar. La sesión se queda guardada en este dispositivo
                  hasta que cierres sesión.
                </p>
                <div className="form-group">
                  <label htmlFor="acc_email">Correo</label>
                  <input
                    autoComplete="username"
                    className="form-control"
                    id="acc_email"
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                    type="email"
                    value={form.email}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="acc_password">Contraseña</label>
                  <input
                    autoComplete="current-password"
                    className="form-control"
                    id="acc_password"
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    type="password"
                    value={form.password}
                  />
                </div>
                <button className="btn btn-blue" disabled={busy} type="submit">
                  {busy ? <FontAwesomeIcon icon={faCircleNotch} spin /> : 'Entrar'}
                </button>
              </>
            )}

            <h2>Copia de seguridad</h2>
            <div className="settings-actions">
              <button className="btn btn-white btn-inline" onClick={handleExport} type="button">
                <FontAwesomeIcon icon={faDownload} /> Exportar JSON
              </button>
              {!readOnly && (
                <button className="btn btn-white btn-inline" onClick={() => fileRef.current?.click()} type="button">
                  <FontAwesomeIcon icon={faUpload} /> Importar JSON
                </button>
              )}
              <input accept="application/json,.json" hidden onChange={handleImport} ref={fileRef} type="file" />
            </div>

            <p className="settings-generator-link">
              <a className="link" onClick={() => setShowGenerator(!showGenerator)}>
                {showGenerator ? 'Ocultar' : 'Crear o cambiar el acceso'}
              </a>
            </p>
          </div>
        </form>

        {showGenerator && <AccessGenerator />}

        <div className="form-column">
          <p className="settings-credits">
            Basado en <a className="link" href="https://github.com/pokedextracker/pokedextracker.com" rel="noreferrer" target="_blank">PokédexTracker</a> (MIT).
            Datos y sprites de <a className="link" href="https://pokeapi.co" rel="noreferrer" target="_blank">PokéAPI</a>.
            Pokémon y sus nombres son marcas de Nintendo, Game Freak y The Pokémon Company.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Genera el acceso.json cifrado a partir del token de GitHub. */
function AccessGenerator () {
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (password.length < MIN_PASSWORD) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres: el fichero cifrado es público.`);
      return;
    }
    if (password !== repeat) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setBusy(true);
    try {
      const file = await encryptToken(email, password, token.trim());
      setResult(JSON.stringify(file));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([result], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = ACCESS_FILE;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <form className="access-generator" onSubmit={handleGenerate}>
      <div className="form-column">
        <h2>Crear o cambiar el acceso</h2>
        <p className="settings-help">
          Cifra tu token de GitHub con el correo y la contraseña que elijas. Después sube el fichero
          <b> {ACCESS_FILE}</b> a la carpeta <b>public/</b> del repositorio
          {PUBLIC_PROGRESS ? <> (<b>{PUBLIC_PROGRESS.owner}/{PUBLIC_PROGRESS.repo}</b>)</> : null}. El token no se envía
          a ningún sitio: se cifra aquí, en tu navegador.
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-group">
          <label htmlFor="gen_token">Token de GitHub</label>
          <input
            autoComplete="off"
            className="form-control"
            id="gen_token"
            onChange={(e) => setToken(e.target.value)}
            placeholder="github_pat_…"
            required
            type="password"
            value={token}
          />
        </div>
        <div className="form-group">
          <label htmlFor="gen_email">Correo</label>
          <input className="form-control" id="gen_email" onChange={(e) => setEmail(e.target.value)} required type="email" value={email} />
        </div>
        <div className="form-group">
          <label htmlFor="gen_password">Contraseña (mínimo {MIN_PASSWORD} caracteres)</label>
          <input autoComplete="new-password" className="form-control" id="gen_password" onChange={(e) => setPassword(e.target.value)} required type="password" value={password} />
        </div>
        <div className="form-group">
          <label htmlFor="gen_repeat">Repite la contraseña</label>
          <input autoComplete="new-password" className="form-control" id="gen_repeat" onChange={(e) => setRepeat(e.target.value)} required type="password" value={repeat} />
        </div>

        <button className="btn btn-blue" disabled={busy} type="submit">
          {busy ? <FontAwesomeIcon icon={faCircleNotch} spin /> : 'Generar fichero de acceso'}
        </button>

        {result && (
          <div className="access-result">
            <p>Listo. Descárgalo y súbelo a <b>public/{ACCESS_FILE}</b>:</p>
            <textarea readOnly rows={4} value={result} />
            <button className="btn btn-yellow btn-inline" onClick={download} type="button">
              <FontAwesomeIcon icon={faDownload} /> Descargar {ACCESS_FILE}
            </button>
          </div>
        )}
      </div>
    </form>
  );
}

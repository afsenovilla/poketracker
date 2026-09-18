import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog, faPencilAlt, faStar } from '@fortawesome/free-solid-svg-icons';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { DexForm } from './DexForm';
import { Nav } from './Nav';
import { Progress } from './Progress';
import { includeEntry, usePokedex } from '../lib/data';
import { useStore } from '../lib/store';
import type { DexConfig, Entry } from '../lib/types';

function DexPreview ({ dex, entries, onEdit }: { dex: DexConfig; entries: Entry[]; onEdit?: () => void }) {
  const { doc } = useStore();
  const { caught, total, pending } = useMemo(() => {
    const caps = doc.captures[dex.id] || {};
    let c = 0;
    let t = 0;
    let p = 0;
    for (const e of entries) {
      if (!includeEntry(dex, e)) continue;
      const s = caps[e.id];
      if (s?.x) continue;
      t++;
      if (s?.c) c++;
      else if (s?.g) p++;
    }
    return { caught: c, total: t, pending: p };
  }, [doc.captures, dex, entries]);

  const tags = [
    dex.regional && 'Regionales',
  ].filter(Boolean);

  return (
    <div className="dex-preview">
      <div className="dex-preview-header">
        <h3><Link className="link" to={`/dex/${dex.id}`}>{dex.title}</Link></h3>
        <div className="dex-edit">
          {onEdit && <a className="link" onClick={onEdit} title="Editar"><FontAwesomeIcon icon={faPencilAlt} /></a>}
        </div>
        <div className="dex-indicator">
          {dex.shiny && <span className="label"><FontAwesomeIcon icon={faStar} /> Shiny</span>}
          {tags.map((t) => <span className="label" key={t as string}>{t}</span>)}
        </div>
      </div>
      <div className="percentage">
        <Progress caught={caught} pending={pending} total={total} />
      </div>
    </div>
  );
}

export function HomePage () {
  const { data, error } = usePokedex();
  const { doc, dispatch, status, readOnly } = useStore();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<DexConfig | 'new' | null>(null);

  if (error) return <div className="loading">Error: {error}</div>;
  if (!data) return <div className="loading">Cargando…</div>;

  return (
    <div className="profile-container">
      <Nav />
      <div className="profile">
        <div className="wrapper">
          <header>
            <div className="header-row">
              <h1>Mis Living Dex</h1>
            </div>
            <h2>Seguimiento de tus cajas de Pokémon HOME</h2>
          </header>

          {readOnly && (
            <div className="alert alert-muted home-sync-hint">
              Estás en <b>modo lectura</b>.{' '}
              <Link to="/ajustes"><FontAwesomeIcon icon={faCog} /> Entra con tu cuenta</Link> para hacer cambios.
            </div>
          )}

          {doc.dexes.length === 0 && status !== 'loading' && (
            <p className="empty-dexes">
              {readOnly ? 'Todavía no hay ninguna dex guardada.' : 'Aún no tienes ninguna dex. Crea una normal y otra shiny para empezar.'}
            </p>
          )}

          {doc.dexes.map((dex) => (
            <DexPreview dex={dex} entries={data.entries} key={dex.id} onEdit={readOnly ? undefined : () => setEditing(dex)} />
          ))}

          {!readOnly && (
            <div className="dex-create">
              <button className="btn btn-blue" onClick={() => setEditing('new')} type="button">Nueva dex</button>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <DexForm
          entries={data.entries}
          initial={editing === 'new' ? undefined : editing}
          onCancel={() => setEditing(null)}
          onDelete={editing === 'new' ? undefined : () => {
            dispatch({ type: 'dex-delete', id: editing.id });
            setEditing(null);
          }}
          onSubmit={(dex) => {
            dispatch({ type: 'dex-upsert', dex });
            setEditing(null);
            if (editing === 'new') navigate(`/dex/${dex.id}`);
          }}
        />
      )}
    </div>
  );
}

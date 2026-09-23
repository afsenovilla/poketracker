import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt, faCaretLeft, faCaretRight } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { CATEGORY_LABEL, formaGroup, homeUrl, includeEntry, labelIndex, pad, TYPE_COLORS, useLocations, usePokedex, wikidexUrl } from '../../lib/data';
import { GameMark } from '../GameMark';
import { Notes } from './Notes';
import { GAME_BY_ID, GAMES } from '../../lib/games';
import { useStore } from '../../lib/store';
import { useUI } from '../../lib/ui';
import type { DexConfig, SlotPatch, Slot, SlotState } from '../../lib/types';

interface Props {
  dex: DexConfig;
  /** ir a otra casilla de la dex (preevoluciones) */
  onSelectEntry?: (id: string) => void;
  flavor?: string;
  slot: Slot;
  state?: SlotState;
}

/** Enlace a otra casilla de la misma dex; si no está en la dex, solo texto. */
function EntryLink ({ dex, id, label, onSelect }: { dex: DexConfig; id?: string | null; label: string; onSelect?: (id: string) => void }) {
  const { data } = usePokedex();
  const target = id ? data?.entries.find((e) => e.id === id) : undefined;
  const available = Boolean(onSelect && target && includeEntry(dex, target));
  if (!available) return <b>{label}</b>;
  return (
    <button className="info-entry-link" onClick={() => onSelect!(id!)} title={`Ver ${label}`} type="button">
      {label}
    </button>
  );
}

const DERIVED = /^(Evolución de|Crianza con) (.+)$/;

function WhereToCatch ({ dex, entryId, evo, evoId, onSelect }: {
  dex: DexConfig;
  entryId: string;
  evo: string | null;
  evoId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const data = useLocations();
  const { data: dex_ } = usePokedex();
  const byLabel = useMemo(() => labelIndex(dex_?.entries || []), [dex_]);
  if (!data) return <p className="info-muted">Cargando…</p>;
  const list = data.locations[entryId] || [];

  return (
    <div className="info-where">
      {list.length === 0 && (
        <p className="info-muted">
          No aparece en estado salvaje en los juegos compatibles con HOME
          {evo ? '.' : ' (suele ser de evento, regalo o intercambio).'}
        </p>
      )}
      {list.map(([game, places]) => (
        places.length === 0 ? (
          <div className="info-where-game static" key={game}>
            <span className="game-name">{data.games[game]}</span>
            <span className="info-muted"> · disponible</span>
          </div>
        ) : (
          <details className="info-where-game" key={game} open={list.length === 1}>
            <summary>
              <span className="game-name">{data.games[game]}</span>
              <span className="count">{places.length}</span>
            </summary>
            <ul>
              {places.map((p) => {
                const m = DERIVED.exec(p);
                return m ? (
                  <li className="derived" key={p}>
                    {m[1]}{' '}
                    <EntryLink dex={dex} id={byLabel.get(m[2])} label={m[2]} onSelect={onSelect} />
                  </li>
                ) : <li key={p}>{p}</li>;
              })}
            </ul>
          </details>
        )
      ))}
      {evo && (
        <p className="info-evo">
          Evoluciona de <EntryLink dex={dex} id={evoId} label={evo} onSelect={onSelect} />
        </p>
      )}
    </div>
  );
}

export function Info ({ dex, flavor, onSelectEntry, slot, state }: Props) {
  const { showInfo, setShowInfo } = useUI();
  const { dispatch, readOnly } = useStore();
  const { entry } = slot;
  const [showShiny, setShowShiny] = useState(dex.shiny);

  useEffect(() => setShowShiny(dex.shiny), [dex.shiny, entry.id]);

  const patch = (p: SlotPatch) => dispatch({ type: 'slot', dex: dex.id, entries: [entry.id], patch: p });

  const status = state?.c ? 'home' : state?.g ? 'game' : 'none';

  return (
    <div className={classNames('info', { collapsed: !showInfo })}>
      <div className="info-collapse" onClick={() => setShowInfo(!showInfo)} role="button" title={showInfo ? 'Ocultar ficha' : 'Mostrar ficha'}>
        <FontAwesomeIcon icon={showInfo ? faCaretRight : faCaretLeft} />
      </div>

      <div className="info-main">
        <div className="info-header">
          <div className="info-title">
            <h1>
              <a className="info-wikidex" href={wikidexUrl(entry)} rel="noopener noreferrer" target="_blank" title={`${entry.name} en WikiDex`}>
                {entry.name}
                <FontAwesomeIcon className="info-wikidex-icon" icon={faExternalLinkAlt} />
              </a>
            </h1>
            {entry.form && entry.category !== 'base' && <p className="info-form">{entry.form}</p>}
          </div>
          <h2>#{pad(entry.species)}</h2>
        </div>

        <div className="info-body">
          <div className="info-art">
            <img alt={entry.name} key={`${entry.id}-${showShiny}`} src={homeUrl(entry, showShiny)} />
            <div className="info-art-toggle">
              <button className={classNames({ active: !showShiny })} onClick={() => setShowShiny(false)} type="button">Normal</button>
              <button className={classNames({ active: showShiny })} onClick={() => setShowShiny(true)} type="button">Shiny</button>
            </div>
          </div>

          <div className="info-types">
            {entry.types.map((t) => (
              <span className="type-chip" key={t} style={{ backgroundColor: TYPE_COLORS[t] }}>{t}</span>
            ))}
          </div>
          <p className="info-category">
            <Link to={`/dex/${dex.id}?cat=${formaGroup(entry)?.value ?? entry.category}`}>
              {formaGroup(entry)?.label ?? CATEGORY_LABEL[entry.category]}
            </Link>
            {' · '}
            <Link to={`/dex/${dex.id}?gen=${entry.gen}`}>Generación {entry.gen}</Link>
          </p>

          {slot.unavailable ? (
            <div className="info-unavailable">
              <b>No disponible</b>
              Nunca se ha distribuido variocolor, así que no cuenta para completar la dex shiny.
            </div>
          ) : readOnly ? (
            <p className={`info-readonly status-${status}`}>
              {state?.x ? 'Excluido de esta dex'
                : status === 'home' ? `✓ En HOME${state?.g ? ` · desde ${GAME_BY_ID[state.g]?.name}` : ''}`
                  : status === 'game' ? `Pendiente en ${GAME_BY_ID[state!.g!]?.name ?? 'otro juego'}`
                    : 'Aún no lo tienes'}
            </p>
          ) : (
          <div className="info-actions">
            <div className="info-status" role="radiogroup">
              <button
                aria-checked={status === 'none'}
                className={classNames({ active: status === 'none' })}
                disabled={Boolean(state?.x)}
                onClick={() => patch({ c: false, g: '' })}
                role="radio"
                type="button"
              >
                No lo tengo
              </button>
              <button
                aria-checked={status === 'game'}
                className={classNames('game', { active: status === 'game' })}
                disabled={Boolean(state?.x)}
                onClick={() => patch({ c: false, g: state?.g || 'go' })}
                role="radio"
                type="button"
              >
                En otro juego
              </button>
              <button
                aria-checked={status === 'home'}
                className={classNames('home', { active: status === 'home' })}
                disabled={Boolean(state?.x)}
                onClick={() => patch({ c: true })}
                role="radio"
                type="button"
              >
                En HOME
              </button>
            </div>

            {(status === 'game' || status === 'home') && (
              <div className="info-game-picker">
                <span className="info-game-label">
                  {status === 'game' ? '¿En qué juego está?' : '¿De qué juego viene?'}
                </span>
                <div className="info-game-options">
                  {GAMES.map((g) => {
                    const active = state?.g === g.id;
                    // si ya está en HOME, volver a pulsar el juego marcado lo quita
                    const onClick = () => patch({ c: status === 'home', g: active && status === 'home' ? '' : g.id });
                    return (
                      <button
                        aria-pressed={active}
                        className={classNames('info-game-option', { active })}
                        key={g.id}
                        onClick={onClick}
                        title={active && status === 'home' ? `${g.name} (pulsa para quitarlo)` : g.name}
                        type="button"
                      >
                        <GameMark game={g} onDark />
                        <span className="info-game-name">{g.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <label className="info-exclude">
              <input checked={Boolean(state?.x)} onChange={(e) => patch({ x: e.target.checked })} type="checkbox" />
              Excluir de esta dex (no disponible / no lo busco)
            </label>
          </div>
          )}

          <Notes dex={dex} entryId={entry.id} note={state?.n ?? ''} patch={patch} />

          <h3 className="info-section info-section-link">
            Dónde capturarlo
            <a href={wikidexUrl(entry, 'Localización')} rel="noopener noreferrer" target="_blank">
              Ver en WikiDex <FontAwesomeIcon icon={faExternalLinkAlt} />
            </a>
          </h3>
          <WhereToCatch dex={dex} entryId={entry.id} evo={entry.evo} evoId={entry.evoId} onSelect={onSelectEntry} />

          {flavor && <blockquote className="info-flavor">{flavor}</blockquote>}
        </div>

      </div>
    </div>
  );
}

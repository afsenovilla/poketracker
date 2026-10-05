import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt, faCaretLeft, faCaretRight } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { CATEGORY_LABEL, formaGroup, homeUrl, includeEntry, labelIndex, pad, slotNumber, TYPE_COLORS, useGameLocations, useLocations, usePokedex, wikidexUrl } from '../../lib/data';
import { GAME_COLORS, gameDexOf, otherSources, pairedVersion, placesIn, widestScope } from '../../lib/gamedex';
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

/** Lista plegable de lugares, con enlaces en «Evolución de X» / «Crianza con Y» */
function PlaceList ({ color, dex, onSelect, open, places, title }: {
  /** color del juego (marca a la izquierda del nombre) */
  color?: string;
  dex: DexConfig;
  onSelect?: (id: string) => void;
  open: boolean;
  places: string[];
  title: string;
}) {
  const { data } = usePokedex();
  const byLabel = useMemo(() => labelIndex(data?.entries || []), [data]);
  if (!places.length) {
    return (
      <div className="info-where-game static">
        <span className="game-name">{color && <i className="game-dot" style={{ backgroundColor: color }} />}{title}</span>
      </div>
    );
  }
  return (
    <details className="info-where-game" open={open}>
      <summary>
        <span className="game-name">{color && <i className="game-dot" style={{ backgroundColor: color }} />}{title}</span>
        <span className="count">{places.length}</span>
      </summary>
      <ul>
        {places.map((p) => {
          // «Evolución de Seadra (por intercambio con Escama Dragón)»
          const m = /^(Evolución de|Crianza con) ([^(]+?)(?: \((.+)\))?$/.exec(p);
          return m ? (
            <li className="derived" key={p}>
              {m[1]}{' '}
              <EntryLink dex={dex} id={byLabel.get(m[2])} label={m[2]} onSelect={onSelect} />
              {m[3] && <> ({m[3]})</>}
            </li>
          ) : <li key={p}>{p}</li>;
        })}
      </ul>
    </details>
  );
}

/** Dónde conseguirlo en una dex de juego: en esta versión, en la otra o en otros juegos */
function GameWhere ({ dex, entryId, onSelect }: { dex: DexConfig; entryId: string; onSelect?: (id: string) => void }) {
  const def = gameDexOf(dex);
  const data = useGameLocations(def?.locations);
  if (!def?.locations) {
    return <p className="info-muted">Los lugares de {def?.name ?? 'este juego'} aún no están en la web: míralos en WikiDex.</p>;
  }
  if (!data) return <p className="info-muted">Cargando…</p>;
  const version = def.locations.version;
  const here = placesIn(data, version, entryId);
  const other = pairedVersion(data, version);
  const there = other ? placesIn(data, other, entryId) : [];
  const elsewhere = otherSources(data, entryId);
  const versionsText = Object.values(data.versions).join(' ni en ');
  const onlyEvents = elsewhere.every(([g]) => g === 'event');

  return (
    <div className="info-where">
      {here.length > 0 && <PlaceList color={GAME_COLORS[version]} dex={dex} onSelect={onSelect} open places={here} title={data.versions[version]} />}
      {here.length === 0 && there.length > 0 && (
        <>
          <p className="info-where-note">No sale en {data.versions[version]}: tienes que conseguirlo en {data.versions[other!]} e intercambiarlo.</p>
          <PlaceList color={GAME_COLORS[other!]} dex={dex} onSelect={onSelect} open places={there} title={data.versions[other!]} />
        </>
      )}
      {here.length > 0 && there.length > 0 && there.join('|') !== here.join('|') && (
        <PlaceList color={GAME_COLORS[other!]} dex={dex} onSelect={onSelect} open={false} places={there} title={data.versions[other!]} />
      )}
      {here.length === 0 && there.length === 0 && (
        <>
          <p className="info-where-note">
            No se puede conseguir en {versionsText}.
            {onlyEvents ? ' Solo se ha distribuido en eventos.' : ' Hay que traerlo de otro juego:'}
          </p>
          {!onlyEvents && elsewhere.map(([g, places]) => (
            <PlaceList color={GAME_COLORS[g]} dex={dex} key={g} onSelect={onSelect} open={elsewhere.length === 1} places={places} title={data.other[g] || g} />
          ))}
        </>
      )}
    </div>
  );
}

/** Estados de una dex de juego: no lo tengo, visto y capturado */
function GameStatus ({ dex, patch, state }: { dex: DexConfig; patch: (p: SlotPatch) => void; state?: SlotState }) {
  const status = state?.c ? 'caught' : state?.v ? 'seen' : 'none';
  const options: { value: typeof status; label: string; className?: string; patch: SlotPatch }[] = [
    { value: 'none', label: 'No lo tengo', patch: { c: false, v: false } },
    { value: 'seen', label: 'Visto', className: 'game', patch: { c: false, v: true } },
    // «visto» se conserva: si luego se desmarca la captura, vuelve a quedar como visto
    { value: 'caught', label: 'Capturado', className: 'home', patch: { c: true } },
  ];
  return (
    <div className="info-actions">
      <div className="info-status" role="radiogroup" aria-label={`Estado en ${gameDexOf(dex)?.name ?? 'el juego'}`}>
        {options.map((o) => (
          <button
            aria-checked={status === o.value}
            className={classNames(o.className, { active: status === o.value })}
            disabled={Boolean(state?.x)}
            key={o.value}
            onClick={() => patch(o.patch)}
            role="radio"
            type="button"
          >
            {o.label}
          </button>
        ))}
      </div>
      <label className="info-exclude">
        <input checked={Boolean(state?.x)} onChange={(e) => patch({ x: e.target.checked })} type="checkbox" />
        Excluir de esta dex (no lo busco / solo por intercambio)
      </label>
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
  const gameDex = Boolean(dex.game);
  const gameDef = gameDexOf(dex);
  const { data: pokedex } = usePokedex();
  // en una dex de juego, la preevolución solo se cita si existe en ese juego (Munchlax no está en Rojo Fuego)
  const evoTarget = entry.evoId ? pokedex?.entries.find((e) => e.id === entry.evoId) : undefined;
  const evoInGame = Boolean(evoTarget && includeEntry(dex, evoTarget));
  const digits = gameDex ? gameDef?.digits ?? 3 : 4;

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
          <h2>#{pad(slotNumber(slot), digits)}</h2>
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
            {!gameDex && (
              <>
                <Link to={`/dex/${dex.id}?cat=${formaGroup(entry)?.value ?? entry.category}`}>
                  {formaGroup(entry)?.label ?? CATEGORY_LABEL[entry.category]}
                </Link>
                {' · '}
              </>
            )}
            <Link to={`/dex/${dex.id}?gen=${entry.gen}${gameDef ? `&pokedex=${widestScope(gameDef)}` : ''}`}>Generación {entry.gen}</Link>
            {gameDex && slot.number !== undefined && slot.number !== entry.species && <> · Nacional #{pad(entry.species, digits)}</>}
          </p>

          {slot.unavailable ? (
            <div className="info-unavailable">
              <b>No disponible</b>
              Nunca se ha distribuido variocolor, así que no cuenta para completar la dex shiny.
            </div>
          ) : gameDex ? (
            readOnly ? (
              <p className={`info-readonly status-${state?.c ? 'home' : state?.v ? 'game' : 'none'}`}>
                {state?.x ? 'Excluido de esta dex' : state?.c ? '✓ Capturado' : state?.v ? 'Visto' : 'Aún no lo tienes'}
              </p>
            ) : <GameStatus dex={dex} patch={patch} state={state} />
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
          {gameDex ? (
            <>
              <GameWhere dex={dex} entryId={entry.id} onSelect={onSelectEntry} />
              {entry.evo && evoInGame && (
                <p className="info-evo">
                  Evoluciona de <EntryLink dex={dex} id={entry.evoId} label={entry.evo} onSelect={onSelectEntry} />
                </p>
              )}
            </>
          ) : (
            <WhereToCatch dex={dex} entryId={entry.id} evo={entry.evo} evoId={entry.evoId} onSelect={onSelectEntry} />
          )}

          {flavor && <blockquote className="info-flavor">{flavor}</blockquote>}
        </div>

      </div>
    </div>
  );
}

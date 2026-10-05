import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLongArrowAltUp, faStar } from '@fortawesome/free-solid-svg-icons';
import { memo, useMemo } from 'react';

import { Box } from './Box';
import { PokemonSlot } from './PokemonSlot';
import { Progress } from '../Progress';
import { formaGroup, groupBoxes, isUnown, normalize, pad, slotNumber } from '../../lib/data';
import { gameDexOf } from '../../lib/gamedex';
import type { DexScope } from '../../lib/gamedex';
import { useStore } from '../../lib/store';
import type { DexConfig, Slot, SlotState } from '../../lib/types';
import { isFiltering } from './SearchBar';
import type { Filters } from './SearchBar';
import type { TradeHint } from './PokemonSlot';

/** Leyenda de los bordes de color de una dex de juego */
export interface TradeLegendItem {
  color: string;
  label: string;
}

/** Progreso de cada Pokédex de una dex de juego, para el selector Kanto / Nacional */
export interface ScopeSummary {
  scope: DexScope;
  label: string;
  caught: number;
  total: number;
}

interface Props {
  availability: Map<string, Set<string>>;
  /** dex de juego: casillas que no se consiguen en esta versión -> aviso de la casilla */
  tradeHints?: Map<string, TradeHint>;
  tradeLegend?: TradeLegendItem[];
  /** dex de juego: Pokédex que se está viendo y cómo cambiarla */
  scope?: DexScope;
  scopes?: ScopeSummary[];
  onScope?: (scope: DexScope) => void;
  captures: Record<string, SlotState>;
  dex: DexConfig;
  filters: Filters;
  onScrollTop: () => void;
  onSelect: (id: string) => void;
  selected?: string;
  showScrollButton: boolean;
  slots: Slot[];
}

function matches (slot: Slot, q: string, padding: number) {
  if (!q) return true;
  const e = slot.entry;
  const digits = q.replace(/^#/, '');
  if (/^\d+$/.test(digits)) {
    const n = slotNumber(slot);
    return String(n) === String(Number(digits)) || pad(n, padding).startsWith(digits);
  }
  const hay = normalize(`${e.name} ${e.category === 'base' ? '' : e.form ?? ''}`);
  return q.split(/\s+/).every((word) => hay.includes(word));
}

export const Dex = memo(function Dex ({
  availability, captures, tradeHints, tradeLegend, dex, filters, onScope, onScrollTop, onSelect, scope, scopes, selected, showScrollButton, slots,
}: Props) {
  const { readOnly } = useStore();
  const gameDex = Boolean(dex.game);
  const gameDef = gameDexOf(dex);
  const digits = gameDex ? gameDef?.digits ?? 3 : 4;
  const { caught, total, pending } = useMemo(() => {
    let c = 0;
    let t = 0;
    let p = 0;
    for (const s of slots) {
      const st = captures[s.entry.id];
      if (st?.x || s.unavailable) continue;
      t++;
      if (st?.c) c++;
      else if (gameDex ? st?.v : st?.g) p++;
    }
    return { caught: c, total: t, pending: p };
  }, [slots, captures, gameDex]);

  const boxes = useMemo(() => groupBoxes(slots), [slots]);

  const filtering = isFiltering(filters);

  const results = useMemo(() => {
    if (!filtering) return [];
    const q = normalize(filters.query);
    return slots.filter((s) => {
      const st = captures[s.entry.id];
      if (filters.hideCaught && (st?.c || st?.x || s.unavailable)) return false;
      if (filters.onlyPending && s.unavailable) return false;
      if (filters.gen && s.entry.gen !== filters.gen) return false;
      // en una dex de juego, «pendientes» son los vistos sin capturar
      if (filters.onlyPending && (st?.c || !(gameDex ? st?.v : st?.g))) return false;
      if (filters.game && st?.g !== filters.game) return false;
      if (filters.category === 'base' && (s.entry.category !== 'base' || isUnown(s.entry))) return false;
      if (filters.category === 'regional' && s.entry.category !== 'regional') return false;
      if (filters.category === 'unown' && !isUnown(s.entry)) return false;
      if (filters.category === 'vivillon' && formaGroup(s.entry)?.value !== 'vivillon') return false;
      if (filters.category === 'alcremie' && formaGroup(s.entry)?.value !== 'alcremie') return false;
      if (filters.category === 'other' && formaGroup(s.entry)?.value !== 'other') return false;
      if (filters.available && (s.unavailable || st?.x || !availability.get(filters.available)?.has(s.entry.id))) return false;
      return matches(s, q, digits);
    });
  }, [filtering, filters, slots, captures, availability, gameDex, digits]);

  return (
    <div className="dex">
      <div className="wrapper">
        <div className={`scroll-up ${showScrollButton ? 'visible' : ''}`} onClick={onScrollTop}>
          <FontAwesomeIcon icon={faLongArrowAltUp} />
        </div>
        <header>
          <div className="header-row">
            <h1>{dex.title}</h1>
            {dex.shiny && <span className="shiny-badge"><FontAwesomeIcon icon={faStar} /> Shiny</span>}
          </div>
          {gameDex ? (
            <h2>
              {gameDef && dex.title !== gameDef.name ? `${gameDef.name} · ` : ''}
              {scope === 'regional' && gameDef ? `Pokédex de ${gameDef.regional.label}` : 'Pokédex nacional'}
              {' · '}{slots.length} Pokémon · {boxes.length} cajas del PC
            </h2>
          ) : (
            <h2>
              {slots.length} casillas · {boxes.length} cajas de HOME
              {dex.layout === 'separado' ? ' · formas al final' : ''}
            </h2>
          )}
          {gameDex && scopes && scopes.length > 1 && (
            <div className="dex-scope" role="tablist" aria-label="Pokédex">
              {scopes.map((s) => (
                <button
                  aria-selected={s.scope === scope}
                  className={s.scope === scope ? 'active' : undefined}
                  key={s.scope}
                  onClick={() => onScope?.(s.scope)}
                  role="tab"
                  type="button"
                >
                  <span className="dex-scope-label">{s.label}</span>
                  <span className="dex-scope-count">{s.caught}/{s.total}</span>
                </button>
              ))}
            </div>
          )}
          {gameDex && tradeLegend && tradeLegend.length > 0 && (
            <p className="dex-trade-legend">
              <span className="dex-trade-legend-title">Hay que traerlo de:</span>
              {tradeLegend.map((l) => (
                <span className="dex-trade-legend-item" key={l.label}>
                  <i style={{ borderColor: l.color }} />{l.label}
                </span>
              ))}
            </p>
          )}
        </header>
        <p className="mobile-hint">{readOnly ? 'Modo lectura · toca un Pokémon para ver su ficha' : 'Toca para marcar · mantén pulsado para ver la ficha'}</p>
        <div className="percentage">
          {gameDex
            ? <Progress caught={caught} caughtLabel="capturados" pending={pending} pendingLabel="vistos sin capturar" total={total} />
            : <Progress caught={caught} pending={pending} total={total} />}
        </div>

        {filtering ? (
          <div className="search-results">
            {results.length === 0 ? (
              <p className="search-results-empty">
                {filters.hideCaught && !filters.query ? '¡No te falta ninguno!' : 'No hay resultados.'}
              </p>
            ) : (
              <>
                <p className="search-results-count">{results.length} resultado{results.length === 1 ? '' : 's'}</p>
                <div className="box-container">
                  {results.slice(0, 300).map((s) => (
                    <PokemonSlot
                      dexId={dex.id}
                      digits={digits}
                      gameDex={gameDex}
                      tradeHint={tradeHints?.get(s.entry.id)}
                      key={s.entry.id}
                      onSelect={onSelect}
                      selected={selected === s.entry.id}
                      shiny={dex.shiny}
                      slot={s}
                      state={captures[s.entry.id]}
                    />
                  ))}
                </div>
                {results.length > 300 && <p className="search-results-count">Mostrando 300 de {results.length}. Afina la búsqueda.</p>}
              </>
            )}
          </div>
        ) : (
          boxes.map((box, i) => (
            <Box
              captures={captures}
              dex={dex}
              key={i}
              number={i + 1}
              onSelect={onSelect}
              selected={selected}
              slots={box}
              tradeHints={tradeHints}
            />
          ))
        )}
      </div>
    </div>
  );
});

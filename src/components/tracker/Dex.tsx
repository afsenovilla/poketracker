import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLongArrowAltUp, faStar } from '@fortawesome/free-solid-svg-icons';
import { memo, useMemo } from 'react';

import { Box } from './Box';
import { PokemonSlot } from './PokemonSlot';
import { Progress } from '../Progress';
import { groupBoxes, normalize, pad } from '../../lib/data';
import { useStore } from '../../lib/store';
import type { DexConfig, Slot, SlotState } from '../../lib/types';
import type { Filters } from './SearchBar';

interface Props {
  captures: Record<string, SlotState>;
  dex: DexConfig;
  filters: Filters;
  onScrollTop: () => void;
  onSelect: (id: string) => void;
  selected?: string;
  showScrollButton: boolean;
  slots: Slot[];
}

function matches (slot: Slot, q: string) {
  if (!q) return true;
  const e = slot.entry;
  const digits = q.replace(/^#/, '');
  if (/^\d+$/.test(digits)) {
    return String(e.species) === String(Number(digits)) || pad(e.species).startsWith(digits);
  }
  const hay = normalize(`${e.name} ${e.category === 'base' ? '' : e.form ?? ''}`);
  return q.split(/\s+/).every((word) => hay.includes(word));
}

export const Dex = memo(function Dex ({ captures, dex, filters, onScrollTop, onSelect, selected, showScrollButton, slots }: Props) {
  const { readOnly } = useStore();
  const { caught, total, pending } = useMemo(() => {
    let c = 0;
    let t = 0;
    let p = 0;
    for (const s of slots) {
      const st = captures[s.entry.id];
      if (st?.x) continue;
      t++;
      if (st?.c) c++;
      else if (st?.g) p++;
    }
    return { caught: c, total: t, pending: p };
  }, [slots, captures]);

  const boxes = useMemo(() => groupBoxes(slots), [slots]);

  const filtering = filters.query.trim() !== '' || filters.hideCaught || filters.gen > 0 || filters.onlyPending || filters.game !== '';

  const results = useMemo(() => {
    if (!filtering) return [];
    const q = normalize(filters.query);
    return slots.filter((s) => {
      const st = captures[s.entry.id];
      if (filters.hideCaught && (st?.c || st?.x)) return false;
      if (filters.gen && s.entry.gen !== filters.gen) return false;
      if (filters.onlyPending && (st?.c || !st?.g)) return false;
      if (filters.game && st?.g !== filters.game) return false;
      return matches(s, q);
    });
  }, [filtering, filters, slots, captures]);

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
          <h2>
            {slots.length} casillas · {boxes.length} cajas de HOME
            {dex.layout === 'separado' ? ' · formas al final' : ''}
          </h2>
        </header>
        <p className="mobile-hint">{readOnly ? 'Modo lectura · toca un Pokémon para ver su ficha' : 'Toca para marcar · mantén pulsado para ver la ficha'}</p>
        <div className="percentage">
          <Progress caught={caught} pending={pending} total={total} />
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
            />
          ))
        )}
      </div>
    </div>
  );
});

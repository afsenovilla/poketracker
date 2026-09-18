import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import { Dex } from './Dex';
import { Info } from './Info';
import { Nav } from '../Nav';
import { NotFound } from '../NotFound';
import { SearchBar } from './SearchBar';
import { GAMES } from '../../lib/games';
import { buildSlots, usePokedex } from '../../lib/data';
import { useStore } from '../../lib/store';
import type { Filters } from './SearchBar';

const SHOW_SCROLL_THRESHOLD = 400;

export function Tracker () {
  const { dexId } = useParams<{ dexId: string }>();
  const { data, error } = usePokedex();
  const { doc, status } = useStore();

  const dex = doc.dexes.find((d) => d.id === dexId);
  const captures = (dex && doc.captures[dex.id]) || {};

  const columnRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState<Filters>({ query: '', hideCaught: false, gen: 0, onlyPending: false, game: '' });
  const [selected, setSelected] = useState<string | null>(null);
  const [showScroll, setShowScroll] = useState(false);

  const slots = useMemo(() => (dex && data ? buildSlots(dex, data.entries) : []), [dex, data]);

  // Solo se ofrecen los juegos que tienen algún Pokémon asignado en esta dex
  const gameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of slots) {
      const g = captures[s.entry.id]?.g;
      if (g) counts.set(g, (counts.get(g) || 0) + 1);
    }
    return GAMES.filter((g) => counts.has(g.id)).map((g) => ({ id: g.id, name: g.name, count: counts.get(g.id)! }));
  }, [slots, captures]);

  useEffect(() => {
    document.title = dex ? `${dex.title} | Poketracker` : 'Poketracker';
  }, [dex?.title]);

  useEffect(() => {
    if (!selected && slots.length) setSelected(slots[0].entry.id);
  }, [slots, selected]);

  useEffect(() => {
    if (columnRef.current) columnRef.current.scrollTop = 0;
  }, [filters.query, filters.hideCaught, filters.gen, filters.onlyPending, filters.game]);


  const handleScroll = useCallback(() => {
    const top = columnRef.current?.scrollTop ?? 0;
    setShowScroll(top >= SHOW_SCROLL_THRESHOLD);
  }, []);


  if (error) return <div className="loading">Error: {error}</div>;
  if (!data || (!dex && status === 'loading')) return <div className="loading">Cargando…</div>;
  if (!dex) return <NotFound />;

  const selectedSlot = slots.find((s) => s.entry.id === selected) || slots[0];

  return (
    <div className="tracker-container">
      <Nav />
      <div className="tracker">
        <div className="dex-wrapper">
          <SearchBar filters={filters} gameCounts={gameCounts} setFilters={setFilters} />
          <div className="dex-column" onScroll={handleScroll} ref={columnRef}>
            <Dex
              captures={captures}
              dex={dex}
              filters={filters}
              onScrollTop={() => { if (columnRef.current) columnRef.current.scrollTop = 0; }}
              onSelect={setSelected}
              selected={selectedSlot?.entry.id}
              showScrollButton={showScroll}
              slots={slots}
            />
            <footer className="main-footer">
              Basado en PokédexTracker · Datos de PokéAPI · Pokémon © Nintendo / Game Freak / The Pokémon Company
            </footer>
          </div>
        </div>
        {selectedSlot && (
          <Info
            dex={dex}
            flavor={data.flavor[selectedSlot.entry.species]}
            slot={selectedSlot}
            state={captures[selectedSlot.entry.id]}
          />
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { Dex } from './Dex';
import { Info } from './Info';
import { Nav } from '../Nav';
import { NotFound } from '../NotFound';
import { EMPTY_FILTERS, isFiltering, SearchBar } from './SearchBar';
import { GAMES } from '../../lib/games';
import { availabilityByGame, BOX_COLUMNS, buildSlots, useLocations, usePokedex } from '../../lib/data';
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
  const [params] = useSearchParams();
  // Filtros de partida desde el enlace (p. ej. desde las estadísticas: ?faltan=swsh)
  const [filters, setFilters] = useState<Filters>(() => ({
    ...EMPTY_FILTERS,
    hideCaught: params.has('faltan'),
    available: params.get('faltan') || params.get('disponible') || '',
    game: params.get('origen') || '',
    gen: Number(params.get('gen')) || 0,
  }));
  const locations = useLocations();
  const availability = useMemo(() => availabilityByGame(locations), [locations]);
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

  // Juegos donde se consiguen (solo cuentan los que puntúan: ni excluidos ni sin shiny)
  const availableCounts = useMemo(() => {
    if (!locations) return [];
    return Object.entries(locations.games).map(([id, name]) => {
      const set = availability.get(id);
      let count = 0;
      for (const s of slots) {
        const st = captures[s.entry.id];
        if (s.unavailable || st?.x || !set?.has(s.entry.id)) continue;
        if (filters.hideCaught && st?.c) continue;
        count++;
      }
      return { id, name, count };
    }).filter((g) => g.count > 0 || g.id === filters.available);
  }, [locations, availability, slots, captures, filters.hideCaught, filters.available]);

  useEffect(() => {
    document.title = dex ? `${dex.title} | Poketracker` : 'Poketracker';
  }, [dex?.title]);

  useEffect(() => {
    if (!selected && slots.length) setSelected(slots[0].entry.id);
  }, [slots, selected]);

  useEffect(() => {
    if (columnRef.current) columnRef.current.scrollTop = 0;
  }, [filters.query, filters.hideCaught, filters.gen, filters.onlyPending, filters.game, filters.available]);


  const filtering = isFiltering(filters);

  // Navegación con las flechas del teclado por la casilla seleccionada
  useEffect(() => {
    const byIndex = new Map(slots.map((s) => [s.index, s]));
    const maxIndex = slots.length ? slots[slots.length - 1].index : 0;

    const onKey = (e: KeyboardEvent) => {
      const dir = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key];
      if (!dir || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || !selected) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;

      let next: string | undefined;
      if (filtering) {
        // en los resultados de búsqueda: según la rejilla que se ve en pantalla
        const cells = Array.from(document.querySelectorAll<HTMLElement>('.search-results .pokemon[data-entry]'));
        const pos = cells.findIndex((c) => c.dataset.entry === selected);
        if (pos < 0) return;
        const top = cells[0].offsetTop;
        const cols = Math.max(1, cells.filter((c) => c.offsetTop === top).length);
        const step = { up: -cols, down: cols, left: -1, right: 1 }[dir]!;
        next = cells[pos + step]?.dataset.entry;
      } else {
        // en las cajas: 6 columnas y las cajas van seguidas, así que arriba/abajo = ±6
        const current = slots.find((s) => s.entry.id === selected);
        if (!current) return;
        const step = { up: -BOX_COLUMNS, down: BOX_COLUMNS, left: -1, right: 1 }[dir]!;
        for (let i = current.index + step; i >= 0 && i <= maxIndex; i += step) {
          const s = byIndex.get(i);
          if (s) { next = s.entry.id; break; }
        }
      }
      e.preventDefault();
      if (!next) return;
      setSelected(next);
      requestAnimationFrame(() => {
        const scope = filtering ? '.search-results ' : '.box ';
        document.querySelector(`${scope}.pokemon[data-entry="${next}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slots, selected, filtering]);

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
          <SearchBar availableCounts={availableCounts} filters={filters} gameCounts={gameCounts} setFilters={setFilters} />
          <div className="dex-column" onScroll={handleScroll} ref={columnRef}>
            <Dex
              availability={availability}
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

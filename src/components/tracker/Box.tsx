import { memo, useMemo } from 'react';

import { PokemonSlot } from './PokemonSlot';
import { BOX_SIZE, pad } from '../../lib/data';
import { useStore } from '../../lib/store';
import type { DexConfig, Slot, SlotState } from '../../lib/types';

interface Props {
  captures: Record<string, SlotState>;
  dex: DexConfig;
  number: number;
  onSelect: (id: string) => void;
  selected?: string;
  slots: Slot[];
}

function boxTitle (slots: Slot[]) {
  const first = slots[0].entry;
  const last = slots[slots.length - 1].entry;
  const range = first.species === last.species ? pad(first.species) : `${pad(first.species)} – ${pad(last.species)}`;
  const nonBase = slots.every((s) => s.entry.category !== 'base');
  return nonBase ? `Formas · ${range}` : range;
}

export const Box = memo(function Box ({ captures, dex, number, onSelect, selected, slots }: Props) {
  const { dispatch, readOnly } = useStore();
  const empties = BOX_SIZE - slots.length;

  const pendingIds = useMemo(
    () => slots.filter((s) => !captures[s.entry.id]?.c && !captures[s.entry.id]?.x).map((s) => s.entry.id),
    [slots, captures],
  );
  const caughtIds = useMemo(() => slots.filter((s) => captures[s.entry.id]?.c).map((s) => s.entry.id), [slots, captures]);
  const allDone = pendingIds.length === 0;

  const handleMarkAll = () => {
    if (allDone) {
      if (!window.confirm(`¿Desmarcar los ${caughtIds.length} Pokémon de la caja ${number}?`)) return;
      dispatch({ type: 'slot', dex: dex.id, entries: caughtIds, patch: { c: false } });
    } else {
      dispatch({ type: 'slot', dex: dex.id, entries: pendingIds, patch: { c: true } });
    }
  };

  return (
    <div className="box" id={`box-${number}`}>
      <div className="box-header">
        <h1>
          <span className="box-number">Caja {number}</span>
          <span className="box-range">{boxTitle(slots)}</span>
        </h1>
        {readOnly ? (
          <span className="box-count">{slots.length - pendingIds.length}/{slots.length}</span>
        ) : (
        <button className="btn btn-yellow" onClick={handleMarkAll} type="button">
          {allDone ? 'Desmarcar todos' : `Marcar todos (${pendingIds.length})`}
        </button>
        )}
      </div>
      <div className="box-container">
        {slots.map((s) => (
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
        {Array.from({ length: empties }, (_, i) => (
          <div className="pokemon empty" key={`e${i}`}>
            <div className="set-captured" />
            <div className="set-captured-mobile" />
          </div>
        ))}
      </div>
    </div>
  );
});

import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBan, faInfo } from '@fortawesome/free-solid-svg-icons';
import { memo, useRef } from 'react';
import type { MouseEvent, TouchEvent } from 'react';

import { pad, spriteUrl } from '../../lib/data';
import { GAME_BY_ID } from '../../lib/games';
import { useStore } from '../../lib/store';
import { useUI } from '../../lib/ui';
import type { Slot, SlotState } from '../../lib/types';

interface Props {
  dexId: string;
  onSelect: (id: string) => void;
  selected: boolean;
  shiny: boolean;
  slot: Slot;
  state?: SlotState;
}

const LONG_PRESS_MS = 450;

export const PokemonSlot = memo(function PokemonSlot ({ dexId, onSelect, selected, shiny, slot, state }: Props) {
  const { dispatch, readOnly } = useStore();
  const { setShowInfo } = useUI();
  const { entry } = slot;
  const excluded = Boolean(state?.x);
  const pendingGame = !state?.c && state?.g ? GAME_BY_ID[state.g] : undefined;

  const timer = useRef<number | undefined>(undefined);
  const longPressed = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);

  const openInfo = () => {
    onSelect(entry.id);
    setShowInfo(true);
  };

  const handleToggle = () => {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    onSelect(entry.id);
    if (excluded || readOnly) {
      setShowInfo(true);
      return;
    }
    dispatch({ type: 'slot', dex: dexId, entries: [entry.id], patch: { c: !state?.c } });
  };

  // Pulsación larga en móvil = abrir ficha
  const onTouchStart = (e: TouchEvent) => {
    longPressed.current = false;
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    timer.current = window.setTimeout(() => {
      longPressed.current = true;
      navigator.vibrate?.(15);
      openInfo();
    }, LONG_PRESS_MS);
  };
  const onTouchMove = (e: TouchEvent) => {
    const s = start.current;
    if (s && (Math.abs(e.touches[0].clientX - s.x) > 10 || Math.abs(e.touches[0].clientY - s.y) > 10)) {
      window.clearTimeout(timer.current);
    }
  };
  const onTouchEnd = () => window.clearTimeout(timer.current);
  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    if (!longPressed.current) openInfo();
  };

  const label = entry.form ? `${entry.name} (${entry.form})` : entry.name;
  const title = pendingGame ? `${label} · pendiente en ${pendingGame.name}` : label;

  return (
    <div
      className={classNames('pokemon', {
        captured: state?.c && !excluded,
        'pending-game': pendingGame && !excluded,
        excluded,
        selected,
      })}
    >
      <div
        className="set-captured"
        onClick={handleToggle}
        onContextMenu={onContextMenu}
        onTouchEnd={onTouchEnd}
        onTouchMove={onTouchMove}
        onTouchStart={onTouchStart}
        role="button"
        title={title}
      >
        <h4>
          {entry.name}
          {entry.form && <span className="form-name">{entry.form}</span>}
        </h4>
        <div className="icon-wrapper">
          <img alt={label} decoding="async" draggable={false} loading="lazy" src={spriteUrl(entry, shiny)} />
        </div>
        <p>#{pad(entry.species)}</p>
      </div>
      {pendingGame && !excluded && <div className="slot-flag game" title={`Pendiente en ${pendingGame.name}`}>{pendingGame.short}</div>}
      {excluded && <div className="slot-flag ban" title="Excluido"><FontAwesomeIcon icon={faBan} /></div>}
      <div className="set-info" onClick={openInfo} role="button" title="Ver ficha">
        <FontAwesomeIcon icon={faInfo} />
      </div>
    </div>
  );
});

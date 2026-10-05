import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBan, faEye, faInfo, faLock, faPen } from '@fortawesome/free-solid-svg-icons';
import { memo, useRef } from 'react';
import type { MouseEvent, TouchEvent } from 'react';

import { GameMark } from '../GameMark';
import { isUnown, pad, slotNumber, spriteUrl } from '../../lib/data';
import { GAME_BY_ID } from '../../lib/games';
import { useStore } from '../../lib/store';
import { useUI } from '../../lib/ui';
import type { Slot, SlotState } from '../../lib/types';

/**
 * Dex de juego: el Pokémon no se consigue en esta versión. La casilla lleva un
 * borde interior del color del juego de donde hay que traerlo (`background`:
 * un color o franjas de varios).
 */
export interface TradeHint {
  background: string;
  title: string;
}

interface Props {
  dexId: string;
  tradeHint?: TradeHint;
  /** dex de un juego: estados «visto» y «capturado», sin juego de origen */
  gameDex?: boolean;
  /** cifras del número (4 en HOME, 3 en los juegos clásicos) */
  digits?: number;
  onSelect: (id: string) => void;
  selected: boolean;
  shiny: boolean;
  slot: Slot;
  state?: SlotState;
}

const LONG_PRESS_MS = 450;

export const PokemonSlot = memo(function PokemonSlot ({ dexId, digits = 4, gameDex = false, onSelect, selected, shiny, slot, state, tradeHint }: Props) {
  const { dispatch, readOnly } = useStore();
  const { setShowInfo } = useUI();
  const { entry } = slot;
  // Unown enseña su letra aunque sea la forma «base»
  const formLabel = entry.category !== 'base' || isUnown(entry) ? entry.form : null;
  const unavailable = Boolean(slot.unavailable);
  const excluded = Boolean(state?.x) && !unavailable;
  const game = state?.g && !unavailable && !gameDex ? GAME_BY_ID[state.g] : undefined;
  // en una dex de juego, «visto» se pinta como los pendientes de pasar a HOME
  const seen = gameDex && Boolean(state?.v) && !state?.c && !unavailable;
  const pending = (Boolean(game) && !state?.c) || seen;

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
    if (excluded || unavailable || readOnly) {
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

  const iconClass = (shiny ? entry.iconShiny : entry.icon) || entry.icon;
  const label = formLabel ? `${entry.name} (${formLabel})` : entry.name;
  const title = tradeHint && !state?.c && !excluded ? `${label} · ${tradeHint.title}`
    : unavailable ? `${label} · no existe shiny`
    : game ? `${label} · ${state?.c ? `desde ${game.name}` : `pendiente en ${game.name}`}`
      : seen ? `${label} · visto` : label;

  return (
    <div
      className={classNames('pokemon', {
        captured: state?.c && !excluded && !unavailable,
        'pending-game': pending && !excluded,
        excluded,
        unavailable,
        selected,
      })}
      data-entry={entry.id}
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
          {formLabel && <span className="form-name">{formLabel}</span>}
        </h4>
        <div className="icon-wrapper">
          {iconClass
            ? <i className={`pkicon ${iconClass}`} role="img" />
            : <img alt={label} decoding="async" draggable={false} loading="lazy" src={spriteUrl(entry, shiny)} />}
        </div>
        <p>#{pad(slotNumber(slot), digits)}</p>
      </div>
      {game && !excluded && (
        <div className="slot-flag game">
          <GameMark game={game} title={state?.c ? `Desde ${game.name}` : `Pendiente en ${game.name}`} />
        </div>
      )}
      {seen && !excluded && <div className="slot-flag seen" title="Visto"><FontAwesomeIcon icon={faEye} /></div>}
      {tradeHint && !state?.c && !excluded && (
        <div aria-hidden className="slot-trade-border" style={{ background: tradeHint.background }} />
      )}
      {state?.n && <div className="slot-flag note" title={state.n}><FontAwesomeIcon icon={faPen} /></div>}
      {excluded && <div className="slot-flag ban" title="Excluido"><FontAwesomeIcon icon={faBan} /></div>}
      {unavailable && <div className="slot-flag lock" title="No disponible: nunca ha salido variocolor"><FontAwesomeIcon icon={faLock} /></div>}
      <div className="set-info" onClick={openInfo} role="button" title="Ver ficha">
        <FontAwesomeIcon icon={faInfo} />
      </div>
    </div>
  );
});

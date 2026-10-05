import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLongArrowAltRight, faTimes } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';

import { buildSlots, countEntries, groupBoxes, scopeEntries } from '../lib/data';
import { GAME_DEX_BY_ID, GAME_DEXES } from '../lib/gamedex';
import type { DexConfig, Entry, Layout } from '../lib/types';
import { useUI } from '../lib/ui';

interface Props {
  entries: Entry[];
  /** Pokédex regionales (de pokedex.json), para contar las dex de juego */
  regionalDexes?: Record<string, number[]>;
  initial?: DexConfig;
  onCancel: () => void;
  onSubmit: (dex: DexConfig) => void;
  onDelete?: () => void;
}

const newId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

export function Modal ({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const { nightMode } = useUI();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div aria-modal="true" className={classNames('modal', { 'night-mode': nightMode })} role="dialog">
        <button aria-label="Cerrar sin guardar" className="modal-close" onClick={onClose} type="button">
          <FontAwesomeIcon icon={faTimes} />
        </button>
        {children}
      </div>
    </div>
  );
}

export function DexForm ({ entries, initial, onCancel, onSubmit, onDelete, regionalDexes }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  // '' = Living Dex de HOME; si no, el id del juego (src/lib/gamedex.ts). No se cambia al editar.
  const [game, setGame] = useState(initial?.game ?? '');
  const gameDef = game ? GAME_DEX_BY_ID[game] : undefined;
  const [shiny, setShiny] = useState(initial?.shiny ?? false);
  const [regional, setRegional] = useState(initial?.regional ?? true);
  const [unown, setUnown] = useState(initial?.unown ?? false);
  const [otherForms, setOtherForms] = useState(initial?.otherForms ?? false);
  const [vivillon, setVivillon] = useState(initial?.vivillon ?? false);
  const [alcremie, setAlcremie] = useState(initial?.alcremie ?? false);
  const gender = false;
  const [layout, setLayout] = useState<Layout>(initial?.layout ?? 'separado');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const total = useMemo(
    () => countEntries({ regional, unown, otherForms, vivillon, alcremie, game: game || undefined }, entries),
    [regional, unown, otherForms, vivillon, alcremie, game, entries],
  );
  const boxes = useMemo(
    () => groupBoxes(buildSlots(
      { id: '', title: '', shiny, regional, gender, unown, otherForms, vivillon, alcremie, layout, createdAt: '', game: game || undefined }, entries,
    )).length,
    [shiny, regional, gender, unown, otherForms, vivillon, alcremie, layout, game, entries],
  );
  const regionalTotal = useMemo(
    () => (gameDef && regionalDexes?.[gameDef.regional.dex]
      ? scopeEntries({ regional: false, game }, entries, { scope: 'regional', regionalDexes }).length
      : 0),
    [gameDef, game, entries, regionalDexes],
  );
  const defaultTitle = gameDef ? gameDef.name : 'Living Dex';
  const placeholder = shiny ? `${defaultTitle} Shiny` : defaultTitle;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({
      id: initial?.id ?? newId(),
      title: title.trim() || placeholder,
      shiny,
      // en una dex de juego no hay formas
      regional: game ? false : regional,
      unown: game ? false : unown,
      otherForms: game ? false : otherForms,
      vivillon: game ? false : vivillon,
      alcremie: game ? false : alcremie,
      gender,
      layout,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      ...(game ? { game } : {}),
    });
  };

  const check = (id: string, label: string, value: boolean, set: (v: boolean) => void, hint = '', disabled = false) => (
    <div className="form-option">
      <div className={classNames('checkbox', { disabled })}>
        <label htmlFor={id} title={hint || undefined}>
          <input checked={value} disabled={disabled} id={id} onChange={(e) => set(e.target.checked)} type="checkbox" />
          <span className="checkbox-custom"><span /></span>{label}
        </label>
      </div>
    </div>
  );

  return (
    <Modal onClose={onCancel}>
      <div className="form dex-form">
        <h1>{initial ? 'Editar dex' : 'Nueva dex'}</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-column">
            <div className="form-group">
              <label htmlFor="dex_game">Juego</label>
              <select
                className="form-control"
                disabled={Boolean(initial)}
                id="dex_game"
                onChange={(e) => setGame(e.target.value)}
                title={initial ? 'El juego de una dex no se puede cambiar' : undefined}
                value={game}
              >
                <option value="">Pokémon HOME (Living Dex)</option>
                {[...new Set(GAME_DEXES.map((g) => g.family))].map((family) => (
                  <optgroup key={family} label={family}>
                    {GAME_DEXES.filter((g) => g.family === family).map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </optgroup>
                ))}
                {initial?.game && !GAME_DEX_BY_ID[initial.game] && <option value={initial.game}>{initial.game}</option>}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="dex_title">Nombre</label>
              <input
                autoFocus
                className="form-control"
                id="dex_title"
                maxLength={60}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={placeholder}
                value={title}
              />
            </div>

            <div className="form-group">
              <label>Tipo</label>
              <div className="form-option">
                <div className="radio">
                  <label>
                    <input checked={!shiny} name="shiny" onChange={() => setShiny(false)} type="radio" />
                    <span className="radio-custom"><span /></span>Normal
                  </label>
                </div>
                <div className="radio">
                  <label>
                    <input checked={shiny} name="shiny" onChange={() => setShiny(true)} type="radio" />
                    <span className="radio-custom"><span /></span>Shiny
                  </label>
                </div>
              </div>
            </div>

            {!game && (
            <>
            <div className="form-group">
              <label>Incluir</label>
              {check('opt_regional', 'Formas regionales', regional, setRegional)}
              {check('opt_other_forms', 'Otras formas sueltas', otherForms, setOtherForms, 'Lycanroc, Oricorio, Zygarde 10%, gorras de Pikachu…')}
              {check('opt_vivillon', 'Patrones de Vivillon (19)', vivillon, setVivillon)}
              {check('opt_alcremie', 'Combinaciones de Alcremie (62)', alcremie, setAlcremie)}
              {check('opt_unown', 'Caja de Unown (las 28 letras)', unown, setUnown)}
            </div>

            <div className="form-group">
              <label>Orden de las cajas</label>
              <div className="form-option">
                <div className="radio">
                  <label>
                    <input checked={layout === 'junto'} name="layout" onChange={() => setLayout('junto')} type="radio" />
                    <span className="radio-custom"><span /></span>Formas junto a su especie
                  </label>
                </div>
              </div>
              <div className="form-option">
                <div className="radio">
                  <label>
                    <input checked={layout === 'separado'} name="layout" onChange={() => setLayout('separado')} type="radio" />
                    <span className="radio-custom"><span /></span>Formas en cajas al final
                  </label>
                </div>
              </div>
            </div>
            </>
            )}

            {gameDef ? (
              <p className="dex-form-summary">
                {regionalTotal > 0 && <><b>{regionalTotal}</b> en la Pokédex de {gameDef.regional.label} y </>}
                <b>{total}</b> en la nacional, en <b>{boxes}</b> cajas del PC
              </p>
            ) : (
              <p className="dex-form-summary"><b>{total}</b> Pokémon en <b>{boxes}</b> cajas de HOME</p>
            )}
            {gameDef && !initial && (
              <p className="dex-form-note">Solo especies, sin formas. Para cada Pokémon marcarás si lo has visto o capturado.</p>
            )}
            {initial && <p className="dex-form-note">Cambiar las opciones no borra lo que ya hayas marcado.</p>}

            <button className="btn btn-blue" type="submit">
              {initial ? 'Guardar' : 'Crear'} <FontAwesomeIcon icon={faLongArrowAltRight} />
            </button>

            {onDelete && (
              <p className="dex-form-delete">
                {confirmDelete ? (
                  <>
                    ¿Seguro? Se perderá todo su progreso.{' '}
                    <a className="link danger" onClick={onDelete}>Sí, borrar</a>{' · '}
                    <a className="link" onClick={() => setConfirmDelete(false)}>No</a>
                  </>
                ) : (
                  <a className="link danger" onClick={() => setConfirmDelete(true)}>Borrar esta dex</a>
                )}
              </p>
            )}
          </div>
        </form>
      </div>
    </Modal>
  );
}

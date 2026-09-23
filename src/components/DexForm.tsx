import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLongArrowAltRight } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';

import { buildSlots, countEntries, groupBoxes } from '../lib/data';
import type { DexConfig, Entry, Layout } from '../lib/types';
import { useUI } from '../lib/ui';

interface Props {
  entries: Entry[];
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
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div aria-modal="true" className={classNames('modal', { 'night-mode': nightMode })} role="dialog">
        {children}
      </div>
    </div>
  );
}

export function DexForm ({ entries, initial, onCancel, onSubmit, onDelete }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
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
    () => countEntries({ regional, unown, otherForms, vivillon, alcremie }, entries),
    [regional, unown, otherForms, vivillon, alcremie, entries],
  );
  const boxes = useMemo(
    () => groupBoxes(buildSlots(
      { id: '', title: '', shiny, regional, gender, unown, otherForms, vivillon, alcremie, layout, createdAt: '' }, entries,
    )).length,
    [shiny, regional, gender, unown, otherForms, vivillon, alcremie, layout, entries],
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({
      id: initial?.id ?? newId(),
      title: title.trim() || (shiny ? 'Living Dex Shiny' : 'Living Dex'),
      shiny,
      regional,
      unown,
      otherForms,
      vivillon,
      alcremie,
      gender,
      layout,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    });
  };

  const check = (id: string, label: string, value: boolean, set: (v: boolean) => void, disabled = false) => (
    <div className="form-option">
      <div className={classNames('checkbox', { disabled })}>
        <label htmlFor={id}>
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
              <label htmlFor="dex_title">Nombre</label>
              <input
                autoFocus
                className="form-control"
                id="dex_title"
                maxLength={60}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={shiny ? 'Living Dex Shiny' : 'Living Dex'}
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

            <div className="form-group">
              <label>Incluir</label>
              {check('opt_regional', 'Formas regionales', regional, setRegional)}
              {check('opt_other_forms', 'Otras formas sueltas (Lycanroc, Oricorio, Zygarde 10%…)', otherForms, setOtherForms)}
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

            <p className="dex-form-summary"><b>{total}</b> Pokémon en <b>{boxes}</b> cajas de HOME</p>
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

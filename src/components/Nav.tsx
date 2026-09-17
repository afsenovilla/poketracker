import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCaretDown, faCheck, faCircleNotch, faCloud, faCog, faExclamationTriangle, faHome, faMoon, faStar, faSun, faTh,
} from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';

import { useStore } from '../lib/store';
import type { SyncStatus } from '../lib/store';
import { useUI } from '../lib/ui';

export const STATUS: Record<SyncStatus, { label: string; icon: typeof faCheck; spin?: boolean }> = {
  local: { label: 'Solo en este navegador', icon: faHome },
  loading: { label: 'Cargando de GitHub…', icon: faCircleNotch, spin: true },
  synced: { label: 'Guardado en GitHub', icon: faCheck },
  pending: { label: 'Cambios sin guardar', icon: faCloud },
  saving: { label: 'Guardando…', icon: faCircleNotch, spin: true },
  error: { label: 'Error al guardar', icon: faExclamationTriangle },
  offline: { label: 'Sin conexión', icon: faExclamationTriangle },
};

export function Nav () {
  const { nightMode, setNightMode } = useUI();
  const { doc, status, error } = useStore();
  const st = STATUS[status];

  return (
    <nav>
      <Link to="/">Poketracker</Link>
      <Link className={`tooltip tooltip-below sync-status sync-${status}`} to="/ajustes">
        <FontAwesomeIcon icon={st.icon} spin={st.spin} />
        <span className="tooltip-text">{error || st.label}</span>
      </Link>
      <a className="tooltip tooltip-below" onClick={() => setNightMode(!nightMode)}>
        <FontAwesomeIcon icon={nightMode ? faSun : faMoon} />
        <span className="tooltip-text">Modo noche {nightMode ? 'off' : 'on'}</span>
      </a>
      <div className="dropdown">
        <a href="#/">Mis dex <FontAwesomeIcon icon={faCaretDown} /></a>
        <ul>
          <div className="dropdown-scroll">
            {doc.dexes.map((dex) => (
              <li key={dex.id}>
                <Link to={`/dex/${dex.id}`}>
                  <FontAwesomeIcon icon={dex.shiny ? faStar : faTh} /> {dex.title}
                </Link>
              </li>
            ))}
          </div>
          <li><Link to="/"><FontAwesomeIcon icon={faHome} /> Inicio</Link></li>
          <li><Link to="/ajustes"><FontAwesomeIcon icon={faCog} /> Ajustes y sincronización</Link></li>
        </ul>
      </div>
    </nav>
  );
}

import classNames from 'classnames';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';

import { HomePage } from './HomePage';
import { NotFound } from './NotFound';
import { SettingsPage } from './SettingsPage';
import { Tracker } from './tracker/Tracker';
import { useUI } from '../lib/ui';

/**
 * La dex se vuelve a montar al cambiar de enlace (otra dex desde el menú, o un
 * enlace con filtros como «Generación 2» en la ficha), para que lea de nuevo
 * los filtros y la Pokédex del enlace en vez de quedarse con los de antes.
 */
function TrackerRoute () {
  const { pathname, search } = useLocation();
  return <Tracker key={pathname + search} />;
}

export function App () {
  const { nightMode } = useUI();

  return (
    <div className={classNames('root', { 'night-mode': nightMode })}>
      <HashRouter>
        <Routes>
          <Route element={<HomePage />} path="/" />
          <Route element={<SettingsPage />} path="/ajustes" />
          <Route element={<TrackerRoute />} path="/dex/:dexId" />
          <Route element={<NotFound />} path="*" />
        </Routes>
      </HashRouter>
    </div>
  );
}

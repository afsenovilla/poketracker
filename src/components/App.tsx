import classNames from 'classnames';
import { HashRouter, Route, Routes } from 'react-router-dom';

import { HomePage } from './HomePage';
import { NotFound } from './NotFound';
import { SettingsPage } from './SettingsPage';
import { Tracker } from './tracker/Tracker';
import { useUI } from '../lib/ui';

export function App () {
  const { nightMode } = useUI();

  return (
    <div className={classNames('root', { 'night-mode': nightMode })}>
      <HashRouter>
        <Routes>
          <Route element={<HomePage />} path="/" />
          <Route element={<SettingsPage />} path="/ajustes" />
          <Route element={<Tracker />} path="/dex/:dexId" />
          <Route element={<NotFound />} path="*" />
        </Routes>
      </HashRouter>
    </div>
  );
}

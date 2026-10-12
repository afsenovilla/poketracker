import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { storage } from './storage';

interface UIState {
  nightMode: boolean;
  setNightMode: (v: boolean) => void;
  showInfo: boolean;
  setShowInfo: (v: boolean) => void;
}

const UIContext = createContext<UIState | null>(null);

function usePersisted (key: string, initial: boolean): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    const v = storage.getJSON<boolean>(key);
    return v === null ? initial : v;
  });
  useEffect(() => storage.setJSON(key, value), [key, value]);
  return [value, setValue];
}

export function UIProvider ({ children }: { children: ReactNode }) {
  const prefersDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const [nightMode, setNightMode] = usePersisted('pt:night', Boolean(prefersDark));
  const wide = typeof window !== 'undefined' && window.innerWidth > 750;
  // En escritorio se recuerda si la ficha estaba abierta. En el móvil la ficha
  // ocupa toda la pantalla, así que siempre empieza cerrada y no se guarda.
  const [showInfoWide, setShowInfoWide] = usePersisted('pt:info', true);
  const [showInfoNarrow, setShowInfoNarrow] = useState(false);
  const showInfo = wide ? showInfoWide : showInfoNarrow;
  const setShowInfo = wide ? setShowInfoWide : setShowInfoNarrow;
  const value = useMemo(() => ({ nightMode, setNightMode, showInfo, setShowInfo }), [nightMode, showInfo]);
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI () {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI fuera de UIProvider');
  return ctx;
}

/**
 * Momento de la última pulsación larga (móvil). La ficha ignora los toques
 * justo después, por si el navegador entrega el «clic» al soltar el dedo
 * encima de la ficha que se acaba de abrir.
 */
let lastLongPress = 0;
export const markLongPress = () => { lastLongPress = Date.now(); };
export const justLongPressed = (ms = 600) => Date.now() - lastLongPress < ms;

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
  const [showInfo, setShowInfo] = usePersisted('pt:info', wide);
  const value = useMemo(() => ({ nightMode, setNightMode, showInfo, setShowInfo }), [nightMode, showInfo]);
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI () {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI fuera de UIProvider');
  return ctx;
}

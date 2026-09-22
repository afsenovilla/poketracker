import { useEffect, useState } from 'react';

import type { DexConfig, Entry, PokedexData, Slot } from './types';

const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';

export const BOX_SIZE = 30;
export const BOX_COLUMNS = 6;
export const TOTAL_SPECIES = 1025;

export function spriteUrl (entry: Entry, shiny: boolean) {
  return SPRITES + (shiny ? entry.spriteShiny : entry.sprite);
}

export function homeUrl (entry: Entry, shiny: boolean) {
  return `${SPRITES}other/home/${shiny ? entry.homeShiny : entry.home}`;
}

let cache: Promise<PokedexData> | null = null;

export interface LocationsData {
  games: Record<string, string>;
  /** id de entrada -> [[juego, [lugares]]] */
  locations: Record<string, [string, string[]][]>;
}

let locCache: Promise<LocationsData> | null = null;

export function useLocations () {
  const [data, setData] = useState<LocationsData | null>(null);
  useEffect(() => {
    let alive = true;
    if (!locCache) {
      locCache = fetch(`${import.meta.env.BASE_URL}data/locations.json`).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      });
      locCache.catch(() => { locCache = null; });
    }
    locCache.then((d) => alive && setData(d)).catch(() => {});
    return () => { alive = false; };
  }, []);
  return data;
}

export function loadPokedex () {
  if (!cache) {
    const base = import.meta.env.BASE_URL;
    const dex = fetch(`${base}data/pokedex.json`).then((r) => {
      if (!r.ok) throw new Error(`No se pudo cargar la Pokédex (${r.status})`);
      return r.json() as Promise<PokedexData>;
    });
    // lista de shinies imposibles; si falla, simplemente no se marca ninguno
    const noShiny = fetch(`${base}data/shiny-unavailable.json`)
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((d: { entries?: { id: string }[] }) => new Set((d.entries || []).map((x) => x.id)))
      .catch(() => new Set<string>());
    cache = Promise.all([dex, noShiny]).then(([d, ids]) => {
      for (const e of d.entries) {
        if (ids.has(e.id)) e.noShiny = true;
      }
      return d;
    });
    cache.catch(() => { cache = null; });
  }
  return cache;
}

export function usePokedex () {
  const [data, setData] = useState<PokedexData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    loadPokedex().then((d) => alive && setData(d)).catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, []);
  return { data, error };
}

export function includeEntry (dex: Pick<DexConfig, 'regional' | 'forms' | 'gender'>, e: Entry) {
  switch (e.category) {
    case 'base': return true;
    case 'regional': return dex.regional;
    // Las formas alternativas y de género existen en los datos pero no se usan en las dex
    case 'forma': return false;
    case 'genero': return false;
    default: return false;
  }
}

/** Devuelve las casillas de la dex en el orden de las cajas de HOME. */
export function buildSlots (dex: DexConfig, entries: Entry[]): Slot[] {
  const list = entries.filter((e) => includeEntry(dex, e));
  let ordered = list;
  if (dex.layout === 'separado') {
    const rank: Record<string, number> = { base: 0, regional: 1, forma: 2, genero: 3 };
    // estable: dentro de cada bloque se mantiene el orden nacional
    ordered = [...list].sort((a, b) => rank[a.category] - rank[b.category]);
  }
  let index = 0;
  let prevBase = true;
  return ordered.map((entry) => {
    const isBase = entry.category === 'base';
    // Con las formas al final, empiezan en una caja nueva
    if (dex.layout === 'separado' && prevBase && !isBase && index % BOX_SIZE !== 0) {
      index += BOX_SIZE - (index % BOX_SIZE);
    }
    prevBase = isBase;
    const slot: Slot = {
      entry,
      unavailable: Boolean(dex.shiny && entry.noShiny),
      index,
      box: Math.floor(index / BOX_SIZE) + 1,
      row: Math.floor((index % BOX_SIZE) / BOX_COLUMNS) + 1,
      col: (index % BOX_COLUMNS) + 1,
    };
    index++;
    return slot;
  });
}

export function groupBoxes (slots: Slot[]) {
  const boxes: Slot[][] = [];
  for (const s of slots) {
    (boxes[s.box - 1] ||= []).push(s);
  }
  return boxes;
}

export function countEntries (dex: Pick<DexConfig, 'regional' | 'forms' | 'gender'>, entries: Entry[]) {
  return entries.reduce((n, e) => n + (includeEntry(dex, e) ? 1 : 0), 0);
}

/** En una dex shiny, los Pokémon que no existen variocolor no cuentan. */
export const isUnavailable = (dex: Pick<DexConfig, 'shiny'>, e: Entry) => Boolean(dex.shiny && e.noShiny);

export const pad = (n: number, digits = 4) => String(n).padStart(digits, '0');

export const normalize = (s: string) => s
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .trim();

export const CATEGORY_LABEL: Record<Entry['category'], string> = {
  base: 'Especie',
  regional: 'Forma regional',
  forma: 'Forma alternativa',
  genero: 'Diferencia de género',
};

export const TYPE_COLORS: Record<string, string> = {
  Normal: '#9fa19f', Lucha: '#ff8000', Volador: '#81b9ef', Veneno: '#9141cb',
  Tierra: '#915121', Roca: '#afa981', Bicho: '#91a119', Fantasma: '#704170',
  Acero: '#60a1b8', Fuego: '#e62829', Agua: '#2980ef', Planta: '#3fa129',
  'Eléctrico': '#fac000', 'Psíquico': '#ef4179', Hielo: '#3dcef3', 'Dragón': '#5060e1',
  Siniestro: '#624d4e', Hada: '#ef70ef',
};

import { useEffect, useState } from 'react';

import type { DexConfig, Entry, PokedexData, Slot } from './types';

const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';

// Los datos se actualizan solos cada mes: se revalidan con el servidor
// para que el navegador no se quede con una copia vieja en caché.
const FRESH: RequestInit = { cache: 'no-cache' };

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
      locCache = fetch(`${import.meta.env.BASE_URL}data/locations.json`, FRESH).then((r) => {
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

/** juego -> ids de las entradas que se pueden conseguir ahí (incluye evolución y crianza) */
export function availabilityByGame (data: LocationsData | null) {
  const map = new Map<string, Set<string>>();
  if (!data) return map;
  for (const [id, list] of Object.entries(data.locations)) {
    for (const [game] of list) {
      if (!map.has(game)) map.set(game, new Set());
      map.get(game)!.add(id);
    }
  }
  return map;
}

export function loadPokedex () {
  if (!cache) {
    const base = import.meta.env.BASE_URL;
    const dex = fetch(`${base}data/pokedex.json`, FRESH).then((r) => {
      if (!r.ok) throw new Error(`No se pudo cargar la Pokédex (${r.status})`);
      return r.json() as Promise<PokedexData>;
    });
    // lista de shinies imposibles; si falla, simplemente no se marca ninguno
    const noShiny = fetch(`${base}data/shiny-unavailable.json`, FRESH)
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

/** Nombre tal y como se muestra: «Vulpix de Alola», «Basculin (Estilo Blanco)». */
export function entryLabel (e: Entry) {
  const region = e.category === 'regional'
    ? /^(?:Forma de )?(Alola|Galar|Hisui|Paldea)/.exec(e.form || '')?.[1]
    : null;
  if (region) return `${e.name} de ${region}`;
  if (e.category === 'forma' && e.form) return `${e.name} (${e.form})`;
  return e.name;
}

/** Etiqueta -> id, para enlazar los textos de «Evolución de X» / «Crianza con Y». */
export function labelIndex (entries: Entry[]) {
  const map = new Map<string, string>();
  for (const e of entries) if (!map.has(entryLabel(e))) map.set(entryLabel(e), e.id);
  return map;
}

export const UNOWN = 201;
export const isUnown = (e: Pick<Entry, 'species'>) => e.species === UNOWN;

export function includeEntry (dex: Pick<DexConfig, 'regional' | 'forms' | 'gender' | 'unown'>, e: Entry) {
  switch (e.category) {
    case 'base': return true;
    case 'regional': return dex.regional;
    // De las formas alternativas solo se usan las de Unown, y solo si la dex las pide
    case 'forma': return Boolean(dex.unown) && isUnown(e);
    case 'genero': return false;
    default: return false;
  }
}

/** Grupo de cajas: 0 especies, 1 formas regionales, 2 Unown (solo si la dex tiene su caja) */
const groupOf = (e: Entry, unown: boolean) => (unown && isUnown(e) ? 2 : e.category === 'base' ? 0 : 1);

/** Devuelve las casillas de la dex en el orden de las cajas de HOME. */
export function buildSlots (dex: DexConfig, entries: Entry[]): Slot[] {
  const list = entries.filter((e) => includeEntry(dex, e));
  let ordered = list;
  if (dex.layout === 'separado') {
    // estable: dentro de cada bloque se mantiene el orden nacional
    ordered = [...list].sort((a, b) => groupOf(a, Boolean(dex.unown)) - groupOf(b, Boolean(dex.unown)));
  }
  let index = 0;
  let prevGroup = 0;
  return ordered.map((entry) => {
    const group = dex.layout === 'separado' ? groupOf(entry, Boolean(dex.unown)) : 0;
    // Cada bloque (regionales, Unown) empieza en una caja nueva
    if (group !== prevGroup && index % BOX_SIZE !== 0) {
      index += BOX_SIZE - (index % BOX_SIZE);
    }
    prevGroup = group;
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

export function countEntries (dex: Pick<DexConfig, 'regional' | 'forms' | 'gender' | 'unown'>, entries: Entry[]) {
  return entries.reduce((n, e) => n + (includeEntry(dex, e) ? 1 : 0), 0);
}

/** En una dex shiny, los Pokémon que no existen variocolor no cuentan. */
export const isUnavailable = (dex: Pick<DexConfig, 'shiny'>, e: Entry) => Boolean(dex.shiny && e.noShiny);

/**
 * Página de WikiDex del Pokémon (opcionalmente, una sección como «Localización»).
 * Las formas regionales tienen su propia página: «Lilligant de Hisui».
 */
export function wikidexUrl (entry: Pick<Entry, 'name' | 'form' | 'category'>, section?: string) {
  const region = entry.category === 'regional'
    ? /^(?:Forma de )?(Alola|Galar|Hisui|Paldea)/.exec(entry.form || '')?.[1]
    : undefined;
  const title = region ? `${entry.name} de ${region}` : entry.name;
  const page = title.replace(/[’‘]/g, "'").replace(/ /g, '_');
  return `https://www.wikidex.net/wiki/${encodeURIComponent(page)}${section ? `#${encodeURIComponent(section)}` : ''}`;
}

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

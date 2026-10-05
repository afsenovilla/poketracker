/**
 * Pokédex de un juego concreto (no la living dex de HOME): las Pokédex del
 * propio juego (regional, DLC, nacional), con «visto» y «capturado». Para
 * añadir otro juego basta con otra entrada en GAME_DEXES; si usa una Pokédex
 * regional nueva, hay que añadir su identificador de PokéAPI a GAME_POKEDEXES
 * en scripts/build-data.py.
 */

/** Una Pokédex del juego (lo que se elige en el selector de arriba) */
export interface GameDexScope {
  /** se guarda (en el navegador y en los enlaces): no cambiarlo */
  id: string;
  /** «Kanto», «Isla de la Armadura», «Nacional»… */
  label: string;
  /** título completo, si no es «Pokédex de <label>» */
  title?: string;
  /** identificador en `regionalDexes` de pokedex.json */
  pokedex?: string;
  /** Pokédex nacional hasta esta especie */
  national?: number;
  /** todas las demás Pokédex del juego juntas, una sección por Pokédex */
  all?: boolean;
}

/** Lugares: los de RF/VH (locations-frlg.json) o los de los juegos de HOME (locations.json) */
export type GameLocationsSource =
  | { file: string; version: string }
  | { home: string; version: string };

export interface GameDexDef {
  /** se guarda en DexConfig.game */
  id: string;
  /** nombre del juego (título por defecto de la dex) */
  name: string;
  /** familia de juegos, para agruparlos en el formulario */
  family: string;
  /** Pokédex del juego, en el orden del selector (la primera es la que se abre) */
  scopes: GameDexScope[];
  /** cifras del número en el juego (#001) */
  digits: number;
  locations?: GameLocationsSource;
}

const KANTO_FRLG: GameDexScope[] = [
  { id: 'regional', label: 'Kanto', pokedex: 'kanto' },
  { id: 'national', label: 'Nacional', national: 386 },
];
const GALAR: GameDexScope[] = [
  { id: 'all', label: 'Todas', all: true },
  { id: 'galar', label: 'Galar', pokedex: 'galar' },
  { id: 'armadura', label: 'Isla de la Armadura', title: 'Pokédex de la Isla de la Armadura', pokedex: 'isle-of-armor' },
  { id: 'corona', label: 'Nieves de la Corona', title: 'Pokédex de las Nieves de la Corona', pokedex: 'crown-tundra' },
];
const SINNOH: GameDexScope[] = [
  { id: 'regional', label: 'Sinnoh', pokedex: 'original-sinnoh' },
  { id: 'national', label: 'Nacional', national: 493 },
];
const PALDEA: GameDexScope[] = [
  { id: 'all', label: 'Todas', all: true },
  { id: 'paldea', label: 'Paldea', pokedex: 'paldea' },
  { id: 'noroteo', label: 'Noroteo', pokedex: 'kitakami' },
  { id: 'arandano', label: 'Arándano', title: 'Pokédex del Instituto Arándano', pokedex: 'blueberry' },
];

export const GAME_DEXES: GameDexDef[] = [
  { id: 'fr', name: 'Rojo Fuego', family: 'Rojo Fuego / Verde Hoja', scopes: KANTO_FRLG, digits: 3, locations: { file: 'frlg', version: 'fr' } },
  { id: 'lg', name: 'Verde Hoja', family: 'Rojo Fuego / Verde Hoja', scopes: KANTO_FRLG, digits: 3, locations: { file: 'frlg', version: 'lg' } },
  {
    id: 'lgp', name: "Let's Go, Pikachu!", family: "Let's Go", digits: 3,
    scopes: [{ id: 'regional', label: 'Kanto', pokedex: 'letsgo-kanto' }], locations: { home: 'lgpe', version: 'GP' },
  },
  {
    id: 'lge', name: "Let's Go, Eevee!", family: "Let's Go", digits: 3,
    scopes: [{ id: 'regional', label: 'Kanto', pokedex: 'letsgo-kanto' }], locations: { home: 'lgpe', version: 'GE' },
  },
  { id: 'sw', name: 'Espada', family: 'Espada / Escudo', scopes: GALAR, digits: 3, locations: { home: 'swsh', version: 'SW' } },
  { id: 'sh', name: 'Escudo', family: 'Espada / Escudo', scopes: GALAR, digits: 3, locations: { home: 'swsh', version: 'SH' } },
  { id: 'bd', name: 'Diamante Brillante', family: 'Diamante Brillante / Perla Reluciente', scopes: SINNOH, digits: 3, locations: { home: 'bdsp', version: 'BD' } },
  { id: 'sp', name: 'Perla Reluciente', family: 'Diamante Brillante / Perla Reluciente', scopes: SINNOH, digits: 3, locations: { home: 'bdsp', version: 'SP' } },
  {
    id: 'pla', name: 'Leyendas: Arceus', family: 'Leyendas: Arceus', digits: 3,
    scopes: [{ id: 'regional', label: 'Hisui', pokedex: 'hisui' }], locations: { home: 'pla', version: 'pla' },
  },
  { id: 'sl', name: 'Escarlata', family: 'Escarlata / Púrpura', scopes: PALDEA, digits: 3, locations: { home: 'sv', version: 'SL' } },
  { id: 'vl', name: 'Púrpura', family: 'Escarlata / Púrpura', scopes: PALDEA, digits: 3, locations: { home: 'sv', version: 'VL' } },
  {
    id: 'za', name: 'Leyendas: Z-A', family: 'Leyendas: Z-A', digits: 3,
    scopes: [
      { id: 'all', label: 'Todas', all: true },
      { id: 'luminalia', label: 'Luminalia', pokedex: 'lumiose-city' },
      { id: 'dimensional', label: 'Dimensional', title: 'Pokédex Dimensional', pokedex: 'hyperspace' },
    ],
    locations: { home: 'za', version: 'za' },
  },
];

export const GAME_DEX_BY_ID: Record<string, GameDexDef> = Object.fromEntries(GAME_DEXES.map((g) => [g.id, g]));

/** id de una de las Pokédex del juego (`GameDexScope.id`) */
export type DexScope = string;

export const gameDexOf = (dex: { game?: string }) => (dex.game ? GAME_DEX_BY_ID[dex.game] : undefined);

/** Pokédex que se pueden mostrar con los datos cargados (sin las regionales que falten en pokedex.json) */
export function availableScopes (def: GameDexDef, regionalDexes?: Record<string, number[]>) {
  const ok = def.scopes.filter((s) => s.all || s.national || (s.pokedex && regionalDexes?.[s.pokedex]?.length));
  // «Todas» solo tiene sentido con dos o más Pokédex
  return ok.filter((s) => !s.all || ok.filter((x) => !x.all).length > 1);
}

/** «Pokédex de Kanto», «Pokédex nacional», «Todas las Pokédex» */
export const scopeTitle = (s: GameDexScope) => s.title || (s.all ? 'Todas las Pokédex' : s.national ? 'Pokédex nacional' : `Pokédex de ${s.label}`);

/** Elige la Pokédex a partir del enlace (?pokedex=nacional / kanto / isla-de-la-armadura…) */
export function scopeFromName (def: GameDexDef, value: string | null | undefined): DexScope | null {
  if (!value) return null;
  const norm = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-');
  const v = norm(value);
  if (v === 'nacional' || v === 'national') return def.scopes.find((s) => s.national)?.id ?? null;
  if (v === 'todas' || v === 'all') return def.scopes.find((s) => s.all)?.id ?? null;
  return def.scopes.find((s) => s.id === v || norm(s.label) === v || s.pokedex === v)?.id ?? null;
}

/** Valor del enlace para una Pokédex */
export const scopeParam = (s: GameDexScope) => (s.national ? 'nacional' : s.all ? 'todas' : s.label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-'));

/** La Pokédex con todas las especies del juego: la nacional, «Todas» o la única que haya */
export const widestScope = (def: GameDexDef) => (def.scopes.find((s) => s.national) || def.scopes.find((s) => s.all) || def.scopes[0]).id;

/** Todas las especies del juego: las de sus Pokédex regionales y la nacional */
export function gameSpecies (def: GameDexDef, regionalDexes?: Record<string, number[]>) {
  const set = new Set<number>();
  for (const s of def.scopes) {
    if (s.national) for (let n = 1; n <= s.national; n++) set.add(n);
    if (s.pokedex) for (const n of regionalDexes?.[s.pokedex] || []) set.add(n);
  }
  return set;
}

/** Lugares de un juego clásico (scripts/build-locations-frlg.py) */
export interface GameLocationsData {
  /** versión -> nombre («fr» -> «Rojo Fuego») */
  versions: Record<string, string>;
  /** otros juegos -> nombre («e» -> «Esmeralda») */
  other: Record<string, string>;
  /**
   * id de entrada -> { «fr»: [lugares], «lg»: [lugares], other: [[juego, [lugares]]] }.
   * `other` solo está si no se consigue en ninguna de las versiones.
   */
  locations: Record<string, Record<string, unknown>>;
  /** juegos de HOME: lo que no sale se marca con un único color (el de HOME) */
  outsideSource?: string;
}

/** Lugares de un Pokémon en una versión («Ruta 1», «Evolución de Pidgey»…) */
export function placesIn (data: GameLocationsData, version: string, entryId: string) {
  return (data.locations[entryId]?.[version] as string[] | undefined) || [];
}

/** Otros juegos donde se consigue, si no está en ninguna de las versiones */
export function otherSources (data: GameLocationsData, entryId: string) {
  return (data.locations[entryId]?.other as [string, string[]][] | undefined) || [];
}

/**
 * Dónde se consigue un Pokémon desde una partida concreta:
 * - here: en esta versión (capturándolo, evolucionando, criando, regalo…)
 * - version: solo en la otra versión del par (hay que intercambiarlo)
 * - outside: en ninguna de las dos (otros juegos o eventos)
 */
export type GameAvailability = 'here' | 'version' | 'outside';

export const AVAILABILITY_KEYS: GameAvailability[] = ['here', 'version', 'outside'];

export function gameAvailability (data: GameLocationsData, version: string, entryId: string): GameAvailability {
  if (placesIn(data, version, entryId).length) return 'here';
  const elsewhere = Object.keys(data.versions).some((v) => v !== version && placesIn(data, v, entryId).length);
  return elsewhere ? 'version' : 'outside';
}

/** La otra versión del par (Rojo Fuego <-> Verde Hoja) */
export const pairedVersion = (data: GameLocationsData, version: string) => Object.keys(data.versions).find((v) => v !== version);

/** Textos de cada disponibilidad, para filtros y estadísticas */
export function availabilityLabels (data: GameLocationsData, version: string): Record<GameAvailability, string> {
  const other = pairedVersion(data, version);
  const names = Object.values(data.versions);
  return {
    here: `En ${data.versions[version]}`,
    version: other ? `Solo en ${data.versions[other]} (intercambio)` : 'En la otra versión',
    outside: `Fuera de ${names.join(' / ')}`,
  };
}

/** juego -> ids, como `availabilityByGame`, pero con las tres disponibilidades de una partida */
export function gameAvailabilityMap (data: GameLocationsData | null, version: string | undefined, ids: string[]) {
  const map = new Map<string, Set<string>>();
  if (!data || !version) return map;
  for (const k of AVAILABILITY_KEYS) map.set(k, new Set());
  for (const id of ids) map.get(gameAvailability(data, version, id))!.add(id);
  return map;
}

/**
 * Color de cada juego (los mismos que usa WikiDex), para el borde de las
 * casillas que no se consiguen en tu versión y para los nombres de la ficha.
 */
export const GAME_COLORS: Record<string, string> = {
  fr: '#FF7200',
  lg: '#4B9C0A',
  r: '#B80000',
  s: '#0D00B8',
  e: '#11B800',
  colo: '#DE983C',
  xd: '#AA6DE3',
  event: '#9e9e9e',
  // juegos de Switch (versiones de cada uno)
  GP: '#C7B800',
  GE: '#9E6237',
  SW: '#00A0E9',
  SH: '#E5005A',
  BD: '#6077FF',
  SP: '#EFA7B9',
  SL: '#9E2A22',
  VL: '#552277',
  za: '#89c97b',
  home: '#3CB371',
};

/** Juegos de los que hay que traerlo (los que dan color al borde), por orden de preferencia */
export function tradeSources (data: GameLocationsData, version: string, entryId: string): string[] {
  const availability = gameAvailability(data, version, entryId);
  if (availability === 'here') return [];
  if (availability === 'version') return Object.keys(data.versions).filter((v) => v !== version && placesIn(data, v, entryId).length);
  if (data.outsideSource) return [data.outsideSource];
  const games = otherSources(data, entryId).map(([g]) => g);
  const rse = games.filter((g) => g === 'r' || g === 's' || g === 'e');
  if (rse.length) return rse;
  const gc = games.filter((g) => g === 'colo' || g === 'xd');
  if (gc.length) return gc;
  return ['event'];
}

/**
 * Fondo del borde: un color, o un tramo del marco por juego si son varios
 * (Rubí, Zafiro y Esmeralda: un tercio cada uno, en el sentido de las agujas
 * del reloj desde la esquina de arriba a la izquierda).
 */
export function sourcesBackground (sources: string[]) {
  const colors = sources.map((g) => GAME_COLORS[g] || GAME_COLORS.event);
  if (colors.length <= 1) return colors[0] || GAME_COLORS.event;
  const step = 360 / colors.length;
  const stops = colors.map((c, i) => `${c} ${Math.round(i * step)}deg ${Math.round((i + 1) * step)}deg`);
  return `conic-gradient(from -45deg, ${stops.join(', ')})`;
}

/** Versiones de cada juego de HOME (las claves de la ficha y de los colores) y su nombre en «(solo …)» */
const HOME_VERSIONS: Record<string, Record<string, string>> = {
  lgpe: { GP: "Let's Go, Pikachu!", GE: "Let's Go, Eevee!" },
  swsh: { SW: 'Espada', SH: 'Escudo' },
  bdsp: { BD: 'Diamante Brillante', SP: 'Perla Reluciente' },
  pla: { pla: 'Leyendas: Arceus' },
  sv: { SL: 'Escarlata', VL: 'Púrpura' },
  za: { za: 'Leyendas: Z-A' },
};

/**
 * Exclusivas de Escarlata y Púrpura (juego base y DLC), por número de especie:
 * las tablas salvajes de PKHeX no distinguen la versión. Fuente: Serebii. No
 * se incluyen Vulpix, Sandshrew ni Tauros, que salen en las dos con otra forma.
 */
const SV_EXCLUSIVE: Record<string, number[]> = {
  SL: [207, 246, 247, 248, 408, 409, 425, 426, 434, 435, 472, 633, 634, 635, 690, 691, 765, 845, 874, 936, 984, 985, 986, 987, 988, 989, 1005, 1007, 1009, 1020, 1021],
  VL: [190, 200, 316, 317, 371, 372, 373, 410, 411, 424, 429, 692, 693, 766, 875, 877, 885, 886, 887, 937, 990, 991, 992, 993, 994, 995, 1006, 1008, 1010, 1022, 1023],
};

/** Clave del borde para lo que no sale en el juego: se trae de otro juego por HOME */
export const HOME_SOURCE = 'home';

/**
 * Convierte los lugares de un juego de HOME (locations.json, por casilla) al
 * formato de las Pokédex de juego: por especie (juntando sus formas: el
 * Growlithe de Hisui cuenta para Growlithe) y por versión, según «(solo …)».
 * Lo que no sale en el juego lleva en `other` los demás juegos de HOME donde sí.
 */
export function homeGameLocations (
  loc: { games: Record<string, string>; locations: Record<string, [string, string[]][]> },
  game: string,
  entries: { id: string; species: number; category: string }[],
): GameLocationsData {
  const versions = HOME_VERSIONS[game] || { [game]: loc.games[game] || game };
  const labelToKey = Object.fromEntries(Object.entries(versions).map(([k, v]) => [v, k]));
  const byId = new Map(entries.map((e) => [e.id, e]));
  // especie -> juego -> lugares
  const perSpecies = new Map<number, Map<string, Set<string>>>();
  for (const [id, list] of Object.entries(loc.locations)) {
    const e = byId.get(id);
    if (!e || e.category === 'genero') continue;
    let m = perSpecies.get(e.species);
    if (!m) perSpecies.set(e.species, (m = new Map()));
    for (const [g, places] of list) {
      if (!m.has(g)) m.set(g, new Set());
      places.forEach((p) => m!.get(g)!.add(p));
    }
  }
  const exclusive = new Map<number, string>();
  if (game === 'sv') for (const [v, list] of Object.entries(SV_EXCLUSIVE)) list.forEach((n) => exclusive.set(n, v));

  const out: GameLocationsData['locations'] = {};
  for (const e of entries) {
    if (e.category !== 'base') continue;
    const m = perSpecies.get(e.species);
    const item: Record<string, unknown> = {};
    const here = m?.get(game);
    if (m && m.has(game)) {
      for (const key of Object.keys(versions)) {
        const places: string[] = [];
        for (const p of here || []) {
          const solo = /^(.*) \(solo ([^)]+)\)$/.exec(p);
          if (solo && labelToKey[solo[2]] && labelToKey[solo[2]] !== key) continue;
          places.push(solo ? solo[1] : p);
        }
        const only = exclusive.get(e.species);
        // en Pokémon GO no hay lugares: basta con que esté disponible
        item[key] = only && only !== key ? [] : (here && here.size === 0 ? ['Disponible'] : places);
      }
    }
    const inGame = Object.keys(versions).some((k) => (item[k] as string[] | undefined)?.length);
    if (!inGame && m) {
      item.other = [...m.entries()].filter(([g]) => g !== game).map(([g, places]) => [g, [...places]]);
    }
    out[e.id] = item;
  }
  return {
    versions,
    other: { ...loc.games, [HOME_SOURCE]: 'Pokémon HOME' },
    locations: out,
    outsideSource: HOME_SOURCE,
  };
}

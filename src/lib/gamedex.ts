/**
 * Dex de un juego concreto (no de HOME): la Pokédex del propio juego, con su
 * Pokédex regional y la nacional. Para añadir otro juego basta con otra entrada
 * en GAME_DEXES; si su Pokédex regional no sigue el orden nacional, hay que
 * añadir su identificador de PokéAPI a GAME_POKEDEXES en scripts/build-data.py.
 */
export interface GameDexDef {
  /** se guarda en DexConfig.game */
  id: string;
  /** nombre del juego (título por defecto de la dex) */
  name: string;
  /** familia de juegos, para agruparlos en el formulario */
  family: string;
  /** Pokédex regional */
  regional: {
    /** identificador en `regionalDexes` de pokedex.json */
    dex: string;
    label: string;
  };
  /** la nacional llega hasta esta especie */
  nationalMax: number;
  /** cajas del PC del juego */
  boxes: number;
  /** cifras del número en el juego (#001) */
  digits: number;
  /** lugares de captura: public/data/locations-<locations>.json, con esta versión */
  locations?: { file: string; version: string };
}

export const GAME_DEXES: GameDexDef[] = [
  {
    id: 'lg', name: 'Verde Hoja', family: 'Rojo Fuego / Verde Hoja', regional: { dex: 'kanto', label: 'Kanto' },
    nationalMax: 386, boxes: 14, digits: 3, locations: { file: 'frlg', version: 'lg' },
  },
  {
    id: 'fr', name: 'Rojo Fuego', family: 'Rojo Fuego / Verde Hoja', regional: { dex: 'kanto', label: 'Kanto' },
    nationalMax: 386, boxes: 14, digits: 3, locations: { file: 'frlg', version: 'fr' },
  },
];

export const GAME_DEX_BY_ID: Record<string, GameDexDef> = Object.fromEntries(GAME_DEXES.map((g) => [g.id, g]));

export type DexScope = 'regional' | 'national';

export const gameDexOf = (dex: { game?: string }) => (dex.game ? GAME_DEX_BY_ID[dex.game] : undefined);

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

/** Nombre corto de cada versión, para la casilla */
const VERSION_SHORT: Record<string, string> = { fr: 'RF', lg: 'VH' };
export const versionShort = (id: string, name: string) => VERSION_SHORT[id] || name.split(/\s+/).map((w) => w[0]).join('').toUpperCase();

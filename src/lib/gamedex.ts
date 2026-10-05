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
}

export const GAME_DEXES: GameDexDef[] = [
  { id: 'lg', name: 'Verde Hoja', family: 'Rojo Fuego / Verde Hoja', regional: { dex: 'kanto', label: 'Kanto' }, nationalMax: 386, boxes: 14, digits: 3 },
  { id: 'fr', name: 'Rojo Fuego', family: 'Rojo Fuego / Verde Hoja', regional: { dex: 'kanto', label: 'Kanto' }, nationalMax: 386, boxes: 14, digits: 3 },
];

export const GAME_DEX_BY_ID: Record<string, GameDexDef> = Object.fromEntries(GAME_DEXES.map((g) => [g.id, g]));

export type DexScope = 'regional' | 'national';

export const gameDexOf = (dex: { game?: string }) => (dex.game ? GAME_DEX_BY_ID[dex.game] : undefined);

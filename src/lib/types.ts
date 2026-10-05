export type Category = 'base' | 'regional' | 'forma' | 'genero';

/** Una entrada de la Pokédex (especie o forma) generada por scripts/build-data.py */
export interface Entry {
  id: string;
  species: number;
  /** identificador inglés de la especie */
  slug: string;
  /** nombre de la preevolución (con región: «Vulpix de Alola»), si la tiene */
  evo: string | null;
  /** id de la casilla de la preevolución */
  evoId?: string | null;
  name: string;
  form: string | null;
  category: Category;
  gen: number;
  /** nunca se ha podido conseguir variocolor (lista de Serebii) */
  noShiny?: boolean;
  types: string[];
  /** clases del sprite sheet (icono de caja) */
  icon: string | null;
  iconShiny: string | null;
  sprite: string;
  spriteShiny: string;
  home: string;
  homeShiny: string;
}

export interface PokedexData {
  entries: Entry[];
  flavor: Record<string, string>;
  /** Pokédex regionales de los juegos: identificador de PokéAPI -> especies en orden */
  regionalDexes?: Record<string, number[]>;
}

export type Layout = 'junto' | 'separado';

export interface DexConfig {
  id: string;
  title: string;
  shiny: boolean;
  /** Formas regionales (Alola, Galar, Hisui, Paldea) */
  regional: boolean;
  /** Diferencias de género */
  gender: boolean;
  /** Caja con las 28 formas de Unown */
  unown?: boolean;
  /** Formas «sueltas»: ni regionales ni Unown ni Vivillon/Alcremie (Lycanroc, Oricorio, Zygarde 10%, gorras de Pikachu…) */
  otherForms?: boolean;
  /** Los 18 patrones de Vivillon */
  vivillon?: boolean;
  /** Las combinaciones de sabor de Alcremie */
  alcremie?: boolean;
  /** 'junto': cada forma va tras su especie; 'separado': primero las 1025 especies y luego las formas */
  layout: Layout;
  /**
   * Dex de un juego concreto (id de src/lib/gamedex.ts, p. ej. 'lg' = Verde Hoja)
   * en vez de una Living Dex de HOME: solo especies, con su Pokédex regional y la
   * nacional del juego, y los estados «visto» y «capturado».
   */
  game?: string;
  createdAt: string;
}

/** Estado de una casilla. Claves cortas para que el JSON ocupe poco. */
export interface SlotState {
  /** capturado (en una dex de HOME: está en HOME) */
  c?: 1;
  /** visto (solo en las dex de juego) */
  v?: 1;
  /** excluido / no disponible (no cuenta para el total) */
  x?: 1;
  /** juego del que viene: si no está marcado en HOME, es que sigue ahí pendiente */
  g?: string;
  /** nota libre (versiones antiguas) */
  n?: string;
  /** última modificación (epoch ms) */
  t: number;
}

export interface ProgressDoc {
  version: 1;
  updatedAt: string;
  dexes: DexConfig[];
  captures: Record<string, Record<string, SlotState>>;
  /** Energía de transporte de Pokémon GO: lo apuntado y cuándo */
  go?: { energy: number; at: number };
}

export interface SlotPatch {
  c?: boolean;
  /** visto (dex de juego) */
  v?: boolean;
  x?: boolean;
  /** juego donde está pendiente; cadena vacía para quitarlo */
  g?: string;
  /** nota libre; cadena vacía para borrarla */
  n?: string;
}

export type Op =
  | { type: 'slot'; dex: string; entries: string[]; patch: SlotPatch }
  | { type: 'dex-upsert'; dex: DexConfig }
  | { type: 'dex-delete'; id: string }
  | { type: 'go-energy'; energy: number }
  | { type: 'replace'; doc: ProgressDoc };

export interface Slot {
  entry: Entry;
  /** número en la Pokédex que se está viendo (dex de juego); si no, el nacional */
  number?: number;
  /** dex de juego con «Todas»: Pokédex a la que pertenece la casilla */
  section?: string;
  index: number;
  box: number;
  row: number;
  col: number;
  /** en una dex shiny: no se puede conseguir variocolor */
  unavailable?: boolean;
}

import {
  faBoxArchive, faCity, faGamepad, faGem, faGraduationCap, faLocationDot, faMountainSun, faShieldHalved,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

export interface Game {
  id: string;
  name: string;
  short: string;
  color: string;
  /** Icono de reserva si no hay marca de origen */
  icon: IconDefinition;
  /** Marca de origen en PokéSprite (misc/origin-marks/home) */
  mark?: string;
  /** Marca de origen propia, dentro de public/origin-marks/ (sin extensión) */
  localMark?: string;
}

/** Nombres cortos para sitios con poco espacio (estadísticas) */
const SHORT_NAME: Record<string, string> = {
  bdsp: 'DBPR',
  lgpe: "Let's Go",
  sm: 'Sol / Luna · USUL',
  bank: 'X / Y · ROZA',
  frlg: 'Rojo Fuego / Verde Hoja',
};

export const shortName = (g: Pick<Game, 'id' | 'name'>) => SHORT_NAME[g.id] || g.name;

const POKESPRITE = 'https://raw.githubusercontent.com/msikma/pokesprite/master/misc/origin-marks/home/';

/**
 * Marcas de origen a probar, en orden. En `public/origin-marks/` hay dos
 * versiones de cada una: la oscura (la de los juegos) para el modo día y la
 * blanca (la de HOME) para el modo noche. Si falta alguna, se prueba la otra y
 * después la de PokéSprite; en último caso se usa el icono de reserva.
 */
export interface MarkSource {
  url: string;
  /** true si la imagen es de la variante contraria y hay que invertirla */
  invert: boolean;
}

export function markUrls (game: Game, night = false): MarkSource[] {
  const base = import.meta.env.BASE_URL;
  const urls: MarkSource[] = [];
  if (game.localMark) {
    const wanted = night ? `${game.localMark}-night` : game.localMark;
    const other = night ? game.localMark : `${game.localMark}-night`;
    for (const ext of ['png', 'webp']) urls.push({ url: `${base}origin-marks/${wanted}.${ext}`, invert: false });
    for (const ext of ['png', 'webp']) urls.push({ url: `${base}origin-marks/${other}.${ext}`, invert: true });
  }
  // las de PokéSprite son blancas
  if (game.mark) urls.push({ url: `${POKESPRITE}${game.mark}.png`, invert: !night });
  return urls;
}

/** Juegos desde los que se puede mandar Pokémon a HOME */
export const GAMES: Game[] = [
  // Del más reciente al más antiguo
  { id: 'za', name: 'Leyendas: Z-A', short: 'ZA', color: '#1f8f8a', icon: faCity, localMark: 'plza' },
  { id: 'sv', name: 'Escarlata / Púrpura', short: 'EP', color: '#c0392b', icon: faGraduationCap, localMark: 'sv' },
  { id: 'pla', name: 'Leyendas: Arceus', short: 'LA', color: '#b06d1f', icon: faMountainSun, mark: 'hisui', localMark: 'pla' },
  { id: 'bdsp', name: 'Diamante Brillante / Perla Reluciente', short: 'DB', color: '#8e5bd0', icon: faGem, mark: 'sinnoh-gen8', localMark: 'bdsp' },
  { id: 'swsh', name: 'Espada / Escudo', short: 'EE', color: '#0d7ab5', icon: faShieldHalved, mark: 'galar', localMark: 'swsh' },
  { id: 'lgpe', name: "Let's Go, Pikachu! / Eevee!", short: 'LG', color: '#e0a800', icon: faGamepad, mark: 'lets-go', localMark: 'lgpe' },
  { id: 'sm', name: 'Sol / Luna · Ultrasol / Ultraluna (Bank)', short: 'SL', color: '#e67e22', icon: faBoxArchive, mark: 'clover', localMark: 'sm' },
  { id: 'go', name: 'Pokémon GO', short: 'GO', color: '#2e7d32', icon: faLocationDot, mark: 'go', localMark: 'go' },
  // Juegos de 3DS a través de Pokémon Bank (el id «bank» se mantiene por compatibilidad con el progreso guardado)
  { id: 'bank', name: 'X / Y · Rubí Omega / Zafiro Alfa (Bank)', short: 'XY', color: '#6d4c41', icon: faBoxArchive, mark: 'pentagon', localMark: 'xy' },
  // Rojo Fuego / Verde Hoja: la marca es la de GBA. Compatibilidad prevista para octubre de 2026
  { id: 'frlg', name: 'Rojo Fuego / Verde Hoja (Switch)', short: 'FRVH', color: '#6b5bbd', icon: faGamepad, localMark: 'gba' },
];

export const GAME_BY_ID: Record<string, Game> = Object.fromEntries(GAMES.map((g) => [g.id, g]));

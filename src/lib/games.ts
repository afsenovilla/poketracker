import {
  faBoxArchive, faCity, faGamepad, faGem, faGraduationCap, faLocationDot, faMountainSun, faQuestion, faShieldHalved,
  faTrophy,
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

const POKESPRITE = 'https://raw.githubusercontent.com/msikma/pokesprite/master/misc/origin-marks/home/';

/**
 * Marcas de origen a probar, en orden. En `public/origin-marks/` hay dos
 * versiones de cada una: la oscura (la de los juegos) para el modo día y la
 * blanca (la de HOME) para el modo noche. Si falta alguna, se prueba la otra y
 * después la de PokéSprite; en último caso se usa el icono de reserva.
 */
export function markUrls (game: Game, night = false) {
  const base = import.meta.env.BASE_URL;
  const urls: string[] = [];
  if (game.localMark) {
    const variants = night ? [`${game.localMark}-night`, game.localMark] : [game.localMark, `${game.localMark}-night`];
    for (const v of variants) {
      urls.push(`${base}origin-marks/${v}.png`);
      urls.push(`${base}origin-marks/${v}.webp`);
    }
  }
  if (game.mark) urls.push(`${POKESPRITE}${game.mark}.png`);
  return urls;
}

/** Juegos desde los que se puede mandar Pokémon a HOME */
export const GAMES: Game[] = [
  { id: 'go', name: 'Pokémon GO', short: 'GO', color: '#2e7d32', icon: faLocationDot, mark: 'go', localMark: 'go' },
  { id: 'lgpe', name: "Let's Go, Pikachu! / Eevee!", short: 'LG', color: '#e0a800', icon: faGamepad, mark: 'lets-go', localMark: 'lgpe' },
  { id: 'swsh', name: 'Espada / Escudo', short: 'EE', color: '#0d7ab5', icon: faShieldHalved, mark: 'galar', localMark: 'swsh' },
  { id: 'bdsp', name: 'Diamante Brillante / Perla Reluciente', short: 'DB', color: '#8e5bd0', icon: faGem, mark: 'sinnoh-gen8', localMark: 'bdsp' },
  { id: 'pla', name: 'Leyendas: Arceus', short: 'LA', color: '#b06d1f', icon: faMountainSun, mark: 'hisui', localMark: 'pla' },
  { id: 'sv', name: 'Escarlata / Púrpura', short: 'EP', color: '#c0392b', icon: faGraduationCap, localMark: 'sv' },
  { id: 'za', name: 'Leyendas: Z-A', short: 'ZA', color: '#1f8f8a', icon: faCity, localMark: 'plza' },
  // Compatibilidad prevista para octubre de 2026
  { id: 'frlg', name: 'Rojo Fuego / Verde Hoja (Switch)', short: 'FRVH', color: '#6b5bbd', icon: faGamepad, localMark: 'gba' },
  { id: 'champions', name: 'Pokémon Champions', short: 'CH', color: '#455a64', icon: faTrophy },
  { id: 'bank', name: 'Pokémon Bank (juegos de 3DS)', short: '3DS', color: '#6d4c41', icon: faBoxArchive, mark: 'pentagon', localMark: 'xy' },
  { id: 'otro', name: 'Otro', short: '?', color: '#78909c', icon: faQuestion },
];

export const GAME_BY_ID: Record<string, Game> = Object.fromEntries(GAMES.map((g) => [g.id, g]));

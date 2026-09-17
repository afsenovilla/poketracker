/** Juegos desde los que se puede mandar Pokémon a HOME */
export const GAMES: { id: string; name: string; short: string }[] = [
  { id: 'go', name: 'Pokémon GO', short: 'GO' },
  { id: 'lgpe', name: "Let's Go, Pikachu! / Eevee!", short: 'LG' },
  { id: 'swsh', name: 'Espada / Escudo', short: 'EE' },
  { id: 'bdsp', name: 'Diamante Brillante / Perla Reluciente', short: 'DBPR' },
  { id: 'pla', name: 'Leyendas: Arceus', short: 'LA' },
  { id: 'sv', name: 'Escarlata / Púrpura', short: 'EP' },
  { id: 'za', name: 'Leyendas: Z-A', short: 'ZA' },
  { id: 'champions', name: 'Pokémon Champions', short: 'CH' },
  { id: 'bank', name: 'Pokémon Bank (juegos de 3DS)', short: '3DS' },
  { id: 'otro', name: 'Otro', short: '?' },
];

export const GAME_BY_ID: Record<string, (typeof GAMES)[number]> = Object.fromEntries(GAMES.map((g) => [g.id, g]));

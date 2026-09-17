/**
 * Fichero de progreso público. Sin token, la web lo muestra en modo lectura.
 * Deja PUBLIC_PROGRESS en null si no quieres modo lectura (la web funcionaría solo en local).
 */
export const PUBLIC_PROGRESS: { owner: string; repo: string; branch: string; path: string } | null = {
  owner: 'afsenovilla',
  repo: 'poketracker',
  branch: 'main',
  path: 'data/progreso.json',
};

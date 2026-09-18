import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faTimes } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export interface Filters {
  query: string;
  hideCaught: boolean;
  gen: number;
  onlyPending: boolean;
  /** id de juego, o '' para todos */
  game: string;
}

interface Props {
  filters: Filters;
  setFilters: Dispatch<SetStateAction<Filters>>;
  /** juegos con Pokémon asignados en esta dex, con su número */
  gameCounts: { id: string; name: string; count: number }[];
}

const GENS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function SearchBar ({ filters, gameCounts, setFilters }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as Element)?.tagName?.toLowerCase();
      if (e.key === '/' && tag !== 'input' && tag !== 'textarea') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const update = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <div className="dex-search-bar">
      <div className="wrapper">
        <div className="form-group">
          <FontAwesomeIcon icon={faSearch} />
          <input
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            className="form-control"
            id="search"
            onChange={(e) => update({ query: e.target.value })}
            placeholder="Busca por nombre, forma o nº (atajo: /)"
            ref={inputRef}
            spellCheck={false}
            type="text"
            value={filters.query}
          />
          {filters.query.length > 0 && (
            <a className="clear-btn" onClick={() => { update({ query: '' }); inputRef.current?.focus(); }}>
              <FontAwesomeIcon className="input-icon" icon={faTimes} />
            </a>
          )}
        </div>
        <div className="dex-search-bar-filters">
          <div className="form-group">
            <div className="checkbox">
              <label>
                <input checked={filters.hideCaught} onChange={(e) => update({ hideCaught: e.target.checked })} type="checkbox" />
                <span className="checkbox-custom"><span /></span>Solo los que me faltan
              </label>
            </div>
            <div className="checkbox">
              <label>
                <input checked={filters.onlyPending} onChange={(e) => update({ onlyPending: e.target.checked })} type="checkbox" />
                <span className="checkbox-custom"><span /></span>Pendientes de pasar a HOME
              </label>
            </div>
            {gameCounts.length > 0 && (
              <select
                aria-label="Juego"
                className="game-select"
                onChange={(e) => update({ game: e.target.value })}
                value={filters.game}
              >
                <option value="">Todos los juegos</option>
                {gameCounts.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.count})</option>)}
              </select>
            )}
            <select
              aria-label="Generación"
              className="gen-select"
              onChange={(e) => update({ gen: Number(e.target.value) })}
              value={filters.gen}
            >
              <option value={0}>Todas las generaciones</option>
              {GENS.map((g) => <option key={g} value={g}>Generación {g}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

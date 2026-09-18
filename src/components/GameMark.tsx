import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';

import { markUrls } from '../lib/games';
import { useUI } from '../lib/ui';
import type { Game } from '../lib/games';

interface Props {
  game: Game;
  title?: string;
  /** fuerza la versión blanca (por ejemplo, sobre el fondo azul de la ficha) */
  onDark?: boolean;
}

/**
 * Marca de origen del juego (la misma que muestra HOME).
 * Si no hay imagen para ese juego, se usa un icono genérico.
 */
export function GameMark ({ game, onDark, title }: Props) {
  const { nightMode } = useUI();
  const night = onDark ?? nightMode;
  const urls = markUrls(game, night);
  const [index, setIndex] = useState(0);

  useEffect(() => setIndex(0), [game.id, night]);

  const url = urls[index];
  if (!url) {
    return <FontAwesomeIcon icon={game.icon} title={title} />;
  }

  return (
    <img
      alt=""
      className="game-mark"
      key={url}
      onError={() => setIndex((i) => i + 1)}
      src={url}
      title={title}
    />
  );
}

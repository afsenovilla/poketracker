import { Link } from 'react-router-dom';

import { Nav } from './Nav';

export function NotFound () {
  return (
    <div className="not-found-container">
      <Nav />
      <div className="not-found">
        <img alt="MissingNo." src={`${import.meta.env.BASE_URL}missingno.svg`} />
        <div className="not-found-caption">
          <h1>404</h1>
          <p>Un MissingNo. salvaje ha aparecido. Esta página no existe.</p>
          <p><Link className="link" to="/">Volver al inicio</Link></p>
        </div>
      </div>
    </div>
  );
}

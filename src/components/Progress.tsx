interface Props {
  caught: number;
  pending?: number;
  total: number;
}

export function Progress ({ caught, pending = 0, total }: Props) {
  const percent = total ? (100 * caught) / total : 0;
  const pendingPercent = total ? (100 * pending) / total : 0;
  const shown = percent === 100 || percent === 0 ? percent.toFixed(0) : percent.toFixed(1);

  return (
    <div className="progress-container">
      <div className="progress-outer">
        <div className="progress-numbers">
          <b>{shown.replace('.', ',')}%</b> completado
          <span className="mobile"> (<b>{caught}</b> de <b>{total}</b>)</span>
        </div>
        <div className="progress-bars">
          <div className="progress-inner" style={{ width: `${percent}%` }} />
          <div className="progress-pending" style={{ width: `${pendingPercent}%` }} />
        </div>
      </div>
      <h3>
        (<b>{caught}</b> en HOME
        {pending > 0 && <>, <b>{pending}</b> por pasar</>}
        , faltan <b>{total - caught - pending}</b>)
      </h3>
    </div>
  );
}

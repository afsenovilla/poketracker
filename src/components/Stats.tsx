import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { GameMark } from './GameMark';
import { availabilityByGame, includeEntry, isUnavailable, isUnown, useLocations } from '../lib/data';
import { GAME_BY_ID, GAMES, shortName } from '../lib/games';
import { GO_ENERGY_PER_HOUR, GO_MAX_ENERGY, goEnergyFromCoins, goEnergyFromTime, goEnergyNow } from '../lib/doc';
import { useStore } from '../lib/store';
import type { DexConfig, Entry, SlotState } from '../lib/types';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
const KEY_TAB = 'pt:stats-dex';

interface Row {
  key: string;
  label: React.ReactNode;
  /** en HOME */
  home: number;
  /** en otro juego, por pasar */
  pending: number;
  /** total de referencia (para el texto); la barra se escala con `scale` */
  total?: number;
  link: string;
  tip: string;
  /** grupo completo al 100 % */
  done?: boolean;
}

const pct = (n: number, d: number) => (d ? `${(100 * n) / d}%` : '0%');

/** Barras horizontales: una fila por categoría, HOME + por pasar apilados sobre una pista gris. */
function Bars ({ missing, rows, scale, valueText }: {
  rows: Row[];
  /** denominador común; si no se da, cada fila se mide contra su propio total */
  scale?: number;
  /** una sola serie: los que faltan */
  missing?: boolean;
  valueText: (r: Row) => React.ReactNode;
}) {
  return (
    <ul className="stats-bars">
      {rows.map((r) => {
        const d = scale ?? r.total ?? 1;
        return (
        <li key={r.key}>
          <Link className={classNames('stats-row', { done: r.done })} title={r.tip} to={r.link}>
            <span className="stats-label">
              {r.label}
              {r.done && <FontAwesomeIcon className="stats-done-icon" icon={faCircleCheck} />}
            </span>
            <span className="stats-track">
              {r.home > 0 && <span className="stats-seg home" style={{ width: pct(r.home, d) }} />}
              {r.pending > 0 && <span className={`stats-seg ${missing ? 'missing' : 'pending'}`} style={{ width: pct(r.pending, d) }} />}
            </span>
            <span className="stats-value">{valueText(r)}</span>
          </Link>
        </li>
        );
      })}
    </ul>
  );
}

function Legend ({ pending = true, missing = false }: { pending?: boolean; missing?: boolean }) {
  return (
    <div className="stats-legend">
      {missing ? (
        <span><i className="stats-swatch missing" /> Te faltan</span>
      ) : (
        <>
          <span><i className="stats-swatch home" /> En HOME</span>
          {pending && <span><i className="stats-swatch pending" /> Por pasar a HOME</span>}
        </>
      )}
    </div>
  );
}

/** «2 días y 3 h», «5 h», «menos de 1 h»… a partir de minutos */
function formatDuration (minutes: number) {
  if (minutes <= 0) return 'menos de 1 h';
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  if (d > 0) return `${d} día${d === 1 ? '' : 's'}${h ? ` y ${h} h` : ''}`;
  if (h > 0) return `${h} h`;
  return 'menos de 1 h';
}

/** Cuánto falta para llenarse, en texto */
function fullIn (energy: number) {
  const minutes = Math.ceil(((GO_MAX_ENERGY - energy) / GO_ENERGY_PER_HOUR) * 60);
  return minutes <= 0 ? 'está al máximo' : `se llena en ${formatDuration(minutes)}`;
}

/** Cuánto se tarda en recargar una cantidad de energía dada (no lo que queda para llenarse del todo) */
function rechargeTime (energyCost: number) {
  return formatDuration(Math.ceil((energyCost / GO_ENERGY_PER_HOUR) * 60));
}

/** Costes de transferencia del Transportador GO (Bulbapedia): categoría base y su variante shiny */
const GO_COSTS: { key: string; label: string; energy: number; shinyEnergy: number }[] = [
  { key: 'normal', label: 'Normal (menos de 1000 PC)', energy: 10, shinyEnergy: 2000 },
  { key: 'legendary', label: 'Legendario / Ultraente', energy: 1000, shinyEnergy: 10000 },
  { key: 'mythical', label: 'Mítico', energy: 2000, shinyEnergy: 10000 },
];

/** Tabla de referencia: cuánta energía (y tiempo de recarga equivalente) cuesta cada transferencia */
function GoCosts () {
  return (
    <details className="go-costs">
      <summary>Ver costes de transferencia</summary>
      <div className="go-costs-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col" />
              <th scope="col">Normal</th>
              <th scope="col">Shiny</th>
            </tr>
          </thead>
          <tbody>
            {GO_COSTS.map((c) => (
              <tr key={c.key}>
                <th scope="row">{c.label}</th>
                <td>
                  {c.energy.toLocaleString('es-ES')}
                  <span className="stats-muted"> · {rechargeTime(c.energy)}</span>
                </td>
                <td>
                  {c.shinyEnergy.toLocaleString('es-ES')}
                  <span className="stats-muted"> · {rechargeTime(c.shinyEnergy)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="stats-sub go-costs-note">
        La energía se recupera a 60 por hora; el tiempo es lo que tardarías en recargar esa cantidad desde 0, no lo que te queda a ti ahora.
      </p>
    </details>
  );
}

/** Energía del Transportador GO y cuántos te quedan por pasar desde GO */
function GoCard ({ base, pendingGo }: { base: string; pendingGo: number }) {
  const { doc, dispatch, readOnly } = useStore();
  const [, tick] = useState(0);
  const [coinsDraft, setCoinsDraft] = useState('');
  const [daysDraft, setDaysDraft] = useState('');
  const [hoursDraft, setHoursDraft] = useState('');

  // se actualiza sola cada minuto
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 60000);
    return () => window.clearInterval(t);
  }, []);

  const energy = goEnergyNow(doc.go);
  const save = (value: number) => dispatch({ type: 'go-energy', energy: value });

  const saveFromCoins = () => {
    const coins = Number(coinsDraft);
    if (!Number.isFinite(coins) || coins < 0) return;
    save(goEnergyFromCoins(coins));
    setCoinsDraft('');
  };

  const saveFromTime = () => {
    const d = daysDraft.trim() === '' ? 0 : Number(daysDraft);
    const h = hoursDraft.trim() === '' ? 0 : Number(hoursDraft);
    if (!Number.isFinite(d) || !Number.isFinite(h) || (d === 0 && h === 0)) return;
    save(goEnergyFromTime(d * 24 + h));
    setDaysDraft('');
    setHoursDraft('');
  };

  return (
    <section className="stats-card go wide stacked">
      <h3>Transferencias desde Pokémon GO</h3>

      <p className="stats-sub go-from">
        <GameMark game={GAME_BY_ID.go} />
        <span>
          Te quedan <b>{pendingGo}</b> por pasar a HOME{' '}
          {pendingGo > 0
            ? <Link to={`${base}?origen=go&pendientes=1`} title="Ver los que tienes pendientes en GO">desde GO</Link>
            : 'desde GO'}.
        </span>
      </p>

      {energy === null ? (
        <p className="stats-sub">
          El juego no enseña la energía en bruto: dime las monedas o el tiempo que pide para cargarla del todo y la calculo yo (luego la voy sumando sola, 60 por hora).
        </p>
      ) : (
        <>
          <div className="go-energy">
            <b>{energy.toLocaleString('es-ES')}</b> / {GO_MAX_ENERGY.toLocaleString('es-ES')} de energía
            <span className="stats-muted"> · {fullIn(energy)}</span>
          </div>
          <span className="stats-track go-track">
            <span className="stats-seg home" style={{ width: `${(100 * energy) / GO_MAX_ENERGY}%` }} />
          </span>
          <p className="stats-sub go-hint">
            Te llegaría para <b>{Math.floor(energy / 10)}</b> normales de menos de 1000 PC (10 cada uno),
            o <b>{Math.floor(energy / 1000)}</b> legendarios (1000).
          </p>
        </>
      )}

      <GoCosts />

      {!readOnly && (
        <div className="go-actions">
          {energy === null ? (
            <GoCalcFields
              coinsDraft={coinsDraft}
              daysDraft={daysDraft}
              hoursDraft={hoursDraft}
              onSaveCoins={saveFromCoins}
              onSaveTime={saveFromTime}
              setCoinsDraft={setCoinsDraft}
              setDaysDraft={setDaysDraft}
              setHoursDraft={setHoursDraft}
            />
          ) : (
            <details className="go-manual">
              <summary>Corregir con monedas o tiempo restante</summary>
              <GoCalcFields
                coinsDraft={coinsDraft}
                daysDraft={daysDraft}
                hoursDraft={hoursDraft}
                onSaveCoins={saveFromCoins}
                onSaveTime={saveFromTime}
                setCoinsDraft={setCoinsDraft}
                setDaysDraft={setDaysDraft}
                setHoursDraft={setHoursDraft}
              />
            </details>
          )}
        </div>
      )}
    </section>
  );
}

/** Los dos campos para calcular la energía (monedas o tiempo restante), reutilizados abiertos o plegados. */
function GoCalcFields ({
  coinsDraft, daysDraft, hoursDraft, onSaveCoins, onSaveTime, setCoinsDraft, setDaysDraft, setHoursDraft,
}: {
  coinsDraft: string;
  daysDraft: string;
  hoursDraft: string;
  onSaveCoins: () => void;
  onSaveTime: () => void;
  setCoinsDraft: (v: string) => void;
  setDaysDraft: (v: string) => void;
  setHoursDraft: (v: string) => void;
}) {
  return (
    <>
      <div className="go-calc">
        <label>
          Monedas de «Cargar ahora»
          <input
            aria-label="Monedas para cargar del todo"
            inputMode="numeric"
            min={0}
            onChange={(e) => setCoinsDraft(e.target.value)}
            placeholder="p. ej. 976"
            type="number"
            value={coinsDraft}
          />
        </label>
        <button disabled={coinsDraft.trim() === ''} onClick={onSaveCoins} type="button">Calcular y guardar</button>
      </div>

      <div className="go-calc">
        <label>
          Tiempo para completarse
          <span className="go-calc-time">
            <input
              aria-label="Días para completarse"
              inputMode="numeric"
              min={0}
              onChange={(e) => setDaysDraft(e.target.value)}
              placeholder="días"
              type="number"
              value={daysDraft}
            />
            <input
              aria-label="Horas para completarse"
              inputMode="numeric"
              max={23}
              min={0}
              onChange={(e) => setHoursDraft(e.target.value)}
              placeholder="horas"
              type="number"
              value={hoursDraft}
            />
          </span>
        </label>
        <button
          disabled={daysDraft.trim() === '' && hoursDraft.trim() === ''}
          onClick={onSaveTime}
          type="button"
        >
          Calcular y guardar
        </button>
      </div>
    </>
  );
}

function DexStats ({ captures, dex, entries }: { captures: Record<string, SlotState>; dex: DexConfig; entries: Entry[] }) {
  const locations = useLocations();
  const availability = useMemo(() => availabilityByGame(locations), [locations]);
  const base = `/dex/${dex.id}`;

  // Solo lo que cuenta para completar: ni excluidos ni shinies imposibles
  const counted = useMemo(
    () => entries.filter((e) => includeEntry(dex, e) && !isUnavailable(dex, e) && !captures[e.id]?.x),
    [entries, dex, captures],
  );

  const byGen = useMemo(() => {
    const rows: Row[] = [];
    const groups: { key: string; label: string; list: Entry[]; link: string; name: string }[] = ROMAN.map((r, i) => ({
      key: `g${i + 1}`,
      label: `Gen. ${r}`,
      name: `Generación ${i + 1}`,
      list: counted.filter((e) => e.gen === i + 1 && e.category === 'base'),
      link: `${base}?gen=${i + 1}`,
    }));
    const regional = counted.filter((e) => e.category === 'regional');
    if (regional.length) groups.push({ key: 'reg', label: 'Regionales', name: 'Formas regionales', list: regional, link: `${base}?cat=regional` });
    // El Unown «A» cuenta en su generación; aquí van las otras letras
    const unown = counted.filter((e) => isUnown(e) && e.category === 'forma');
    if (unown.length) groups.push({ key: 'unown', label: 'Unown', name: 'Unown', list: unown, link: `${base}?cat=unown` });
    for (const g of groups) {
      if (!g.list.length) continue;
      let home = 0;
      let pending = 0;
      for (const e of g.list) {
        const s = captures[e.id];
        if (s?.c) home++;
        else if (s?.g) pending++;
      }
      const total = g.list.length;
      rows.push({
        key: g.key,
        label: g.label,
        home,
        pending,
        total,
        link: g.link,
        done: home === total,
        tip: home === total
          ? `${g.name}: ¡completa! (${total} de ${total})`
          : `${g.name}: ${home} en HOME${pending ? `, ${pending} por pasar` : ''}, faltan ${total - home - pending} de ${total}`,
      });
    }
    return rows;
  }, [counted, captures, base]);

  const byOrigin = useMemo(() => {
    const home = new Map<string, number>();
    const pending = new Map<string, number>();
    let noGame = 0;
    for (const e of counted) {
      const s = captures[e.id];
      if (!s) continue;
      if (s.c && !s.g) noGame++;
      else if (s.g) (s.c ? home : pending).set(s.g, ((s.c ? home : pending).get(s.g) || 0) + 1);
    }
    const rows: Row[] = GAMES
      .filter((g) => home.has(g.id) || pending.has(g.id))
      .map((g) => {
        const h = home.get(g.id) || 0;
        const p = pending.get(g.id) || 0;
        return {
          key: g.id,
          label: <><GameMark game={g} /> <span>{shortName(g)}</span></>,
          home: h,
          pending: p,
          link: `${base}?origen=${g.id}`,
          tip: `${g.name}: ${h} ya en HOME${p ? `, ${p} por pasar` : ''}`,
        };
      })
      .sort((a, b) => (b.home + b.pending) - (a.home + a.pending));
    if (noGame) {
      rows.push({ key: 'none', label: <span className="stats-muted">Sin juego indicado</span>, home: noGame, pending: 0, link: base, tip: `${noGame} en HOME sin juego de origen indicado` });
    }
    return rows;
  }, [counted, captures, base]);

  const missing = useMemo(() => counted.filter((e) => !captures[e.id]?.c), [counted, captures]);

  const byAvailable = useMemo(() => {
    if (!locations) return { rows: [] as Row[], nowhere: 0 };
    const rows: Row[] = Object.entries(locations.games).map(([id, name]) => {
      const set = availability.get(id);
      const n = set ? missing.filter((e) => set.has(e.id)).length : 0;
      const g = GAME_BY_ID[id];
      return {
        key: id,
        label: <>{g && <GameMark game={g} />} <span>{shortName({ id, name })}</span></>,
        home: 0,
        pending: n,
        link: `${base}?faltan=${id}`,
        tip: `${n} de los que te faltan se consiguen en ${name}`,
      };
    }).filter((r) => r.pending > 0).sort((a, b) => b.pending - a.pending);
    const nowhere = missing.filter((e) => ![...availability.values()].some((s) => s.has(e.id))).length;
    return { rows, nowhere };
  }, [locations, availability, missing, base]);

  const pendingGo = useMemo(
    () => counted.filter((e) => captures[e.id]?.g === 'go' && !captures[e.id]?.c).length,
    [counted, captures],
  );
  const doneCount = byGen.filter((r) => r.done).length;
  const maxOrigin = Math.max(1, ...byOrigin.map((r) => r.home + r.pending));
  const pendingTotal = missing.filter((e) => captures[e.id]?.g).length;

  return (
    <div className="stats-grid">
      <section className="stats-card gen stacked">
        <h3>
          Progreso por generación
          {doneCount > 0 && (
            <span className="stats-done-count">
              <FontAwesomeIcon icon={faCircleCheck} /> {doneCount === byGen.length ? '¡Todas completas!' : `${doneCount} completa${doneCount === 1 ? '' : 's'}`}
            </span>
          )}
        </h3>
        <Legend />
        <Bars rows={byGen} valueText={(r) => (r.done ? <b>¡Completa!</b> : <><b>{r.home}</b>/{r.total}</>)} />
      </section>

      <section className="stats-card stacked">
        <h3>De dónde vienen</h3>
        <Legend />
        {byOrigin.length ? (
          <Bars
            rows={byOrigin}
            scale={maxOrigin}
            valueText={(r) => <><b>{r.home}</b>{r.pending > 0 && <span className="stats-muted"> +{r.pending}</span>}</>}
          />
        ) : (
          <p className="stats-empty">Aún no has indicado de qué juego viene ninguno.</p>
        )}
      </section>

      <GoCard base={base} pendingGo={pendingGo} />

      <section className="stats-card wide stacked">
        <h3>Dónde conseguir lo que te falta</h3>
        <p className="stats-sub">
          Te faltan <b>{missing.length}</b>
          {pendingTotal > 0 && <> ({pendingTotal} ya los tienes en otro juego)</>}.
          Cada juego cuenta los que se pueden conseguir ahí, también evolucionando o criando; un mismo Pokémon puede salir en varios.
        </p>
        <Legend missing />
        {!locations && <p className="stats-empty">Cargando…</p>}
        {locations && byAvailable.rows.length === 0 && <p className="stats-empty">¡No te falta ninguno que se pueda conseguir!</p>}
        {byAvailable.rows.length > 0 && (
          <Bars
            missing
            rows={byAvailable.rows}
            scale={Math.max(1, missing.length)}
            valueText={(r) => <b>{r.pending}</b>}
          />
        )}
        {byAvailable.nowhere > 0 && (
          <p className="stats-sub">
            <b>{byAvailable.nowhere}</b> no se pueden conseguir en ningún juego actual (eventos, regalos antiguos o intercambio).
          </p>
        )}
      </section>
    </div>
  );
}

export function Stats ({ dexes, entries }: { dexes: DexConfig[]; entries: Entry[] }) {
  const { doc } = useStore();
  const [tab, setTab] = useState<string>(() => {
    try { return localStorage.getItem(KEY_TAB) || ''; } catch { return ''; }
  });
  const dex = dexes.find((d) => d.id === tab) || dexes[0];
  if (!dex) return null;

  const choose = (id: string) => {
    setTab(id);
    try { localStorage.setItem(KEY_TAB, id); } catch { /* sin almacenamiento */ }
  };

  return (
    <div className="stats">
      <div className="stats-header">
        <h2>Estadísticas</h2>
        {dexes.length > 1 && (
          <div className="stats-tabs" role="tablist">
            {dexes.map((d) => (
              <button
                aria-selected={d.id === dex.id}
                className={classNames({ active: d.id === dex.id })}
                key={d.id}
                onClick={() => choose(d.id)}
                role="tab"
                type="button"
              >
                {d.title}
              </button>
            ))}
          </div>
        )}
      </div>
      <DexStats captures={doc.captures[dex.id] || {}} dex={dex} entries={entries} />
      <p className="stats-hint">Pulsa una fila para ver esos Pokémon en la dex.</p>
    </div>
  );
}

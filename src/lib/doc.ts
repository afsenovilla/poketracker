import type { Op, ProgressDoc, SlotState } from './types';

export const emptyDoc = (): ProgressDoc => ({
  version: 1,
  updatedAt: new Date().toISOString(),
  dexes: [],
  captures: {},
});

/** Energía máxima del Transportador GO y cuánta se recupera por hora */
export const GO_MAX_ENERGY = 10000;
export const GO_ENERGY_PER_HOUR = 60;

/** Energía estimada ahora mismo a partir de lo último apuntado. */
export function goEnergyNow (go: ProgressDoc['go'], now = Date.now()) {
  if (!go) return null;
  const hours = Math.max(0, now - go.at) / 3600000;
  return Math.min(GO_MAX_ENERGY, Math.floor(go.energy + hours * GO_ENERGY_PER_HOUR));
}

export function isProgressDoc (value: unknown): value is ProgressDoc {
  const v = value as ProgressDoc;
  return Boolean(v) && v.version === 1 && Array.isArray(v.dexes) && typeof v.captures === 'object';
}

/**
 * Arreglos al cargar un progreso guardado antes de algún cambio de datos.
 * Ahora mismo: la casilla de Unown del orden nacional pasó de «unown-a» a «unown»
 * (la letra A vive en la caja de Unown).
 */
export function migrateDoc (doc: ProgressDoc): ProgressDoc {
  let changed = false;
  const captures: ProgressDoc['captures'] = {};
  for (const [dexId, slots] of Object.entries(doc.captures)) {
    if (slots['unown-a'] && !slots.unown) {
      captures[dexId] = { ...slots, unown: slots['unown-a'] };
      changed = true;
    } else {
      captures[dexId] = slots;
    }
  }
  return changed ? { ...doc, captures } : doc;
}

/** Aplica una operación de forma inmutable. */
export function applyOp (doc: ProgressDoc, op: Op, now = Date.now()): ProgressDoc {
  switch (op.type) {
    case 'replace':
      return op.doc;
    case 'dex-upsert': {
      const exists = doc.dexes.some((d) => d.id === op.dex.id);
      return {
        ...doc,
        updatedAt: new Date(now).toISOString(),
        dexes: exists ? doc.dexes.map((d) => (d.id === op.dex.id ? op.dex : d)) : [...doc.dexes, op.dex],
      };
    }
    case 'dex-delete': {
      const captures = { ...doc.captures };
      delete captures[op.id];
      return {
        ...doc,
        updatedAt: new Date(now).toISOString(),
        dexes: doc.dexes.filter((d) => d.id !== op.id),
        captures,
      };
    }
    case 'go-energy':
      return {
        ...doc,
        updatedAt: new Date(now).toISOString(),
        go: { energy: Math.max(0, Math.min(GO_MAX_ENERGY, Math.round(op.energy))), at: now },
      };
    case 'slot': {
      if (!doc.dexes.some((d) => d.id === op.dex)) return doc;
      const dexCaptures = { ...(doc.captures[op.dex] || {}) };
      for (const id of op.entries) {
        const prev: SlotState = dexCaptures[id] || { t: now };
        const next: SlotState = { ...prev, t: now };
        if (op.patch.c !== undefined) {
          if (op.patch.c) {
            next.c = 1; // el juego (g) se conserva: es de dónde viene
          } else {
            delete next.c;
          }
        }
        if (op.patch.g !== undefined) {
          // el juego es solo el origen: no cambia por sí mismo si está en HOME
          if (op.patch.g) next.g = op.patch.g; else delete next.g;
        }
        if (op.patch.x !== undefined) {
          if (op.patch.x) next.x = 1; else delete next.x;
        }
        if (op.patch.n !== undefined) {
          if (op.patch.n.trim()) next.n = op.patch.n.slice(0, 1000); else delete next.n;
        }
        if (!next.c && !next.x && !next.g && !next.n) {
          delete dexCaptures[id];
        } else {
          dexCaptures[id] = next;
        }
      }
      return {
        ...doc,
        updatedAt: new Date(now).toISOString(),
        captures: { ...doc.captures, [op.dex]: dexCaptures },
      };
    }
    default:
      return doc;
  }
}

export function applyOps (doc: ProgressDoc, ops: Op[]): ProgressDoc {
  return ops.reduce((acc, op) => applyOp(acc, op), doc);
}

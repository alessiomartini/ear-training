/**
 * srs.js — ripetizione spaziata su localStorage.
 *
 * Un "item" non e' un accordo: e' un *campo sbagliabile*, cosi' come lo produce
 * `harmony.itemKeyFor` (`degree:bVI`, `extensions:9`, `seventh:min7`, ...).
 * Lo stesso accordo alimenta quindi piu' item contemporaneamente, e la
 * debolezza su un campo emerge indipendentemente dagli altri.
 *
 * Il peso di campionamento e':
 *
 *     peso = (FLOOR + (1 - accuratezza)) * recency(lastSeen)
 *
 * dove `recency` cresce da MIN_RECENCY a 1 con costante di tempo TAU_HOURS:
 * un item appena visto e' temporaneamente meno probabile, uno lasciato da parte
 * torna a galla da solo. FLOOR tiene in circolo anche gli item padroneggiati.
 */

const STORAGE_KEY = 'eartraining.srs.v1';

const NEW_WEIGHT = 1.25;   // item mai visto: esplorazione prioritaria
const FLOOR = 0.12;        // gli item perfetti non spariscono del tutto
const MIN_RECENCY = 0.25;  // penalita' massima subito dopo averlo visto
const TAU_HOURS = 6;       // tempo di ritorno a piena probabilita'

/** @typedef {{seen:number, correct:number, lastSeen:number}} Item */

let state = null;

function blank() {
  return { version: 1, items: {}, totals: { seen: 0, correct: 0 }, updated: 0 };
}

/** Carica (una volta) lo stato da localStorage. Tollerante a dati corrotti. */
export function load() {
  if (state) return state;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    state = parsed && parsed.items ? { ...blank(), ...parsed } : blank();
  } catch {
    state = blank();
  }
  return state;
}

function save() {
  state.updated = Date.now();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota piena o storage disabilitato: l'app continua a funzionare in RAM */
  }
}

/**
 * Registra l'esito di un singolo campo.
 * Va chiamato per **tutti** i campi valutati, non solo per quelli sbagliati:
 * senza i `seen` dei campi giusti l'accuratezza non esiste.
 */
export function record(itemKey, correct) {
  const s = load();
  const it = s.items[itemKey] ?? (s.items[itemKey] = { seen: 0, correct: 0, lastSeen: 0 });
  it.seen += 1;
  if (correct) it.correct += 1;
  it.lastSeen = Date.now();
  s.totals.seen += 1;
  if (correct) s.totals.correct += 1;
  save();
}

/** Registra in blocco l'esito di un esercizio. `results` e' `gradeAnswer().results`. */
export function recordExercise(results, keyOf) {
  for (const [field, ok] of Object.entries(results)) record(keyOf(field), ok);
}

/** Peso di campionamento di un item. Vedi la formula in testa al file. */
export function weight(itemKey, now = Date.now()) {
  const it = load().items[itemKey];
  if (!it || it.seen === 0) return NEW_WEIGHT;
  const accuracy = it.correct / it.seen;
  const error = FLOOR + (1 - accuracy);
  const hours = Math.max(0, now - it.lastSeen) / 3_600_000;
  const recency = MIN_RECENCY + (1 - MIN_RECENCY) * (1 - Math.exp(-hours / TAU_HOURS));
  return error * recency;
}

/** Peso di un candidato: somma dei pesi degli item che metterebbe alla prova. */
export function weightOfKeys(itemKeys, now = Date.now()) {
  return itemKeys.reduce((sum, k) => sum + weight(k, now), 0);
}

/**
 * Campionamento proporzionale al peso.
 * @param {T[]} candidates
 * @param {(c:T)=>number} weightOf
 * @param {()=>number} rng
 * @template T
 */
export function pickWeighted(candidates, weightOf, rng = Math.random) {
  if (candidates.length === 0) return null;
  const weights = candidates.map((c) => Math.max(1e-6, weightOf(c)));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

/** Riepilogo per la UI: accuratezza globale e gli item piu' deboli. */
export function summary({ limit = 6 } = {}) {
  const s = load();
  const now = Date.now();
  const entries = Object.entries(s.items)
    .filter(([, it]) => it.seen > 0)
    .map(([key, it]) => ({
      key,
      seen: it.seen,
      correct: it.correct,
      accuracy: it.correct / it.seen,
      weight: weight(key, now),
    }));

  const weakest = entries
    .filter((e) => e.accuracy < 1 && e.seen >= 2)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit);

  return {
    totalSeen: s.totals.seen,
    totalCorrect: s.totals.correct,
    accuracy: s.totals.seen ? s.totals.correct / s.totals.seen : null,
    tracked: entries.length,
    weakest,
  };
}

export function reset() {
  state = blank();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* niente da fare */
  }
}

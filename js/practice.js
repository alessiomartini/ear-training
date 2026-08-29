/**
 * practice.js — controller della pagina Practice.
 *
 * Ciclo: (se serve) stabilisci la tonalita' → suona il bersaglio → raccogli la
 * risposta → correggi campo per campo → aggiorna la ripetizione spaziata.
 *
 * Il controller non sa cosa sia una triade o un metro: chiede al tipo di
 * esercizio un item, traduce il descrittore `sound` in chiamate ad `audio.js`, e
 * gira la correzione a chi di dovere. Aggiungere un ottavo esercizio significa
 * aggiungere una voce a `exercises.js`, non toccare questo file.
 */

import * as audio from './audio.js';
import * as srs from './srs.js';
import * as notes from './notes.js';
import { EXERCISES, exerciseById } from './exercises.js';
import { createQuiz } from './quiz-ui.js';

const $ = (sel) => document.querySelector(sel);
const NOTE_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

const ITEM_FIELD_LABELS = {
  degree: 'degree', quality: 'quality', seventh: 'seventh', extensions: 'extensions',
  outOfKey: 'key relation', inversion: 'inversion', triad: 'triad', interval: 'interval',
  upper: 'upper degree', meter: 'metre', mod: 'modulation', 'quad-triad': 'triad',
  'quad-7th': 'seventh',
};

const remembered = (k, fallback) => localStorage.getItem(`eartraining.${k}`) ?? fallback;

const state = {
  type: exerciseById(remembered('type', 'function')),
  variant: null,
  context: remembered('context', 'piece'),
  modes: remembered('modes', 'major'),
  item: null,
  lastSignature: null,
  running: false,
  session: { asked: 0, perfect: 0 },
};
state.variant = remembered(`variant.${state.type.id}`, state.type.variants[0].id);

let quiz;

// ---------------------------------------------------------------------------
// Avvio
// ---------------------------------------------------------------------------

function init() {
  fillSelect($('#exercise'), EXERCISES.map((e) => [e.id, e.label]));
  fillVariants();
  $('#exercise').value = state.type.id;
  $('#variant').value = state.variant;
  $('#context').value = state.context;
  $('#modes').value = state.modes;

  quiz = createQuiz($('#quiz'), {
    onGraded: handleGraded,
    onNext: nextExercise,
    onReplay: handleReplay,
  });

  $('#start').addEventListener('click', start);
  $('#replay-chord').addEventListener('click', () => handleReplay('chord'));
  $('#replay-context').addEventListener('click', () => handleReplay('context'));
  $('#skip').addEventListener('click', nextExercise);
  $('#reset-stats').addEventListener('click', resetStats);

  $('#exercise').addEventListener('change', (e) => {
    state.type = exerciseById(e.target.value);
    state.variant = remembered(`variant.${state.type.id}`, state.type.variants[0].id);
    localStorage.setItem('eartraining.type', state.type.id);
    fillVariants();
    $('#variant').value = state.variant;
    syncControls();
    if (state.running) nextExercise();
    renderStats();
  });

  $('#variant').addEventListener('change', (e) => {
    state.variant = e.target.value;
    localStorage.setItem(`eartraining.variant.${state.type.id}`, state.variant);
    renderHelp();
    if (state.running) nextExercise();
  });

  $('#context').addEventListener('change', (e) => {
    state.context = e.target.value;
    localStorage.setItem('eartraining.context', state.context);
    if (state.context !== 'drone') audio.stopDrone();
  });

  $('#modes').addEventListener('change', (e) => {
    state.modes = e.target.value;
    localStorage.setItem('eartraining.modes', state.modes);
    if (state.running) nextExercise();
  });

  document.addEventListener('keydown', (ev) => {
    if (state.running) quiz.handleKey(ev);
  });

  notes.setContextProvider(describeSituation);
  syncControls();
  renderStats();
}

function fillSelect(sel, pairs) {
  sel.replaceChildren();
  for (const [value, text] of pairs) {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = text;
    sel.append(o);
  }
}

function fillVariants() {
  fillSelect($('#variant'), state.type.variants.map((v) => [v.id, v.label]));
}

/** Contesto e modo hanno senso solo dove c'e' una tonalita' da stabilire. */
function syncControls() {
  const needsKey = state.type.needsKey;
  $('#context-control').hidden = !needsKey;
  $('#modes-control').hidden = !needsKey;
  $('#replay-context').hidden = !needsKey;
  $('#context-note').hidden = !needsKey;
  renderHelp();
}

function renderHelp() {
  const v = state.type.variants.find((x) => x.id === state.variant);
  $('#level-help').textContent = v?.help ?? '';
  // Da chiuse, le impostazioni devono comunque dire cosa si sta facendo.
  $('#setup-now').textContent = `${state.type.label} · ${v?.label ?? state.variant}`;
}

/** Cosa c'e' a schermo adesso, per allegarlo a una nota. */
function describeSituation() {
  const v = state.type.variants.find((x) => x.id === state.variant);
  const where = `${state.type.label} — ${v?.label ?? state.variant}`;
  if (!state.item) return where;
  if (state.item.key) {
    return `${where} · ${NOTE_NAMES[state.item.key.tonic]} ${state.item.key.mode} · context ${state.context}`;
  }
  return where;
}

async function start() {
  const btn = $('#start');
  const error = $('#start-error');
  btn.disabled = true;
  btn.textContent = 'Loading samples…';
  error.hidden = true;

  let engine;
  try {
    engine = await audio.init();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Retry';
    error.textContent = err.message;
    error.hidden = false;
    return;
  }

  $('#engine').textContent = engine === 'sampler'
    ? 'sampled piano'
    : 'synthesizer (samples unavailable)';

  state.running = true;
  $('#start-row').hidden = true;
  $('#session').hidden = false;
  // Su telefono le impostazioni si richiudono: lo schermo e' poco, e da li' in
  // avanti serve la risposta, non i menu.
  if (window.matchMedia('(max-width: 620px)').matches) $('#setup').open = false;
  nextExercise();
}

// ---------------------------------------------------------------------------
// Ciclo di esercizio
// ---------------------------------------------------------------------------

async function nextExercise() {
  const type = state.type;
  state.item = type.generate({
    variant: state.variant,
    modes: state.modes === 'both' ? ['major', 'minor'] : ['major'],
    avoid: state.lastSignature,
    rng: Math.random,
  });
  state.lastSignature = state.item.signature ?? null;

  renderKey();
  quiz.setExercise({
    fields: type.fields({ variant: state.variant }),
    grade: (answer) => type.grade(answer, state.item),
    canReplayContext: type.needsKey,
  });
  await playItem({ withContext: true });
}

/** Stabilisce la tonalita' se il tipo la richiede, poi suona il bersaglio. */
async function playItem({ withContext }) {
  const { item, type } = { item: state.item, type: state.type };
  if (!item) return;
  if (withContext && type.needsKey && item.key) {
    const lead = await audio.establishKey(item.key, state.context);
    await new Promise((r) => setTimeout(r, lead * 1000));
  }
  playSound(item.sound);
}

/** Unico punto in cui un descrittore di suono diventa audio. */
function playSound(sound) {
  switch (sound.kind) {
    case 'chord':
      if (sound.arpeggio) {
        const step = 0.34;
        audio.playSequence([
          ...sound.notes.map((n, i) => ({ notes: [n], at: i * step, dur: step * 1.6, velocity: 0.7 })),
          { notes: sound.notes, at: sound.notes.length * step + 0.2, dur: 2.4, velocity: 0.72 },
        ]);
      } else {
        audio.playNotes(sound.notes, { duration: 3.0, velocity: 0.72 });
      }
      break;

    case 'interval': {
      const [low, high] = sound.notes;
      const seq = {
        harmonic: [{ notes: [low, high], at: 0, dur: 2.6, velocity: 0.72 }],
        up: [{ notes: [low], at: 0, dur: 1.2, velocity: 0.72 },
             { notes: [high], at: 0.85, dur: 2.0, velocity: 0.72 }],
        down: [{ notes: [high], at: 0, dur: 1.2, velocity: 0.72 },
               { notes: [low], at: 0.85, dur: 2.0, velocity: 0.72 }],
        // La radice resta sotto: senza, non c'e' nessun grado da riferire.
        'root-then-note': [{ notes: [low], at: 0, dur: 3.4, velocity: 0.6 },
                           { notes: [high], at: 0.75, dur: 2.4, velocity: 0.75 }],
      }[sound.mode];
      audio.playSequence(seq);
      break;
    }

    case 'groove':
      audio.playGroove(sound);
      break;

    case 'sequence':
      audio.playSequence(sound.events);
      break;
  }
}

function handleReplay(what) {
  if (!state.item) return;
  if (what === 'context' && state.type.needsKey) playItem({ withContext: true });
  else playSound(state.item.sound);
}

function handleGraded(grade) {
  for (const [field, ok] of Object.entries(grade.results)) {
    const key = grade.keys?.[field];
    if (key) srs.record(key, ok);
  }
  state.session.asked += 1;
  if (Object.values(grade.results).every(Boolean)) state.session.perfect += 1;
  renderStats();
}

function renderKey() {
  const key = state.item?.key;
  const badge = $('#current-key');
  if (!key) {
    badge.textContent = state.type.label;
    return;
  }
  badge.textContent = `${NOTE_NAMES[key.tonic]} ${key.mode}`;
}

// ---------------------------------------------------------------------------
// Statistiche
// ---------------------------------------------------------------------------

function renderStats() {
  const s = srs.summary();
  const pct = (x) => `${Math.round(x * 100)}%`;

  $('#session-count').textContent = String(state.session.asked);
  $('#session-accuracy').textContent = state.session.asked
    ? pct(state.session.perfect / state.session.asked)
    : '—';
  $('#overall-accuracy').textContent = s.accuracy === null ? '—' : pct(s.accuracy);
  $('#tracked-items').textContent = String(s.tracked);

  renderByExercise();

  const list = $('#weakest');
  list.replaceChildren();
  if (s.weakest.length === 0) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'Nothing yet: an item needs at least two attempts to show up here.';
    list.append(li);
    return;
  }
  for (const item of s.weakest) {
    const [field, value] = splitItemKey(item.key);
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'item-name';
    name.append(`${ITEM_FIELD_LABELS[field] ?? field} · `);
    const strong = document.createElement('b');
    strong.textContent = value;
    name.append(strong);
    const score = document.createElement('span');
    score.className = 'item-score';
    score.textContent = `${Math.round(item.accuracy * 100)}% of ${item.seen}`;
    li.append(name, score);
    list.append(li);
  }
}

/**
 * Una riga per esercizio. Con sette tipi diversi un'accuratezza globale non
 * dice piu' niente: puoi essere solidissimo sulle triadi e non aver mai
 * toccato il metro, e il numero unico non lo distingue. Gli esercizi mai
 * provati restano in elenco proprio per rendere visibile il buco.
 */
function renderByExercise() {
  const box = $('#by-exercise');
  box.replaceChildren();

  for (const type of EXERCISES) {
    const st = srs.statsFor(type.keyPrefixes ?? []);
    const row = document.createElement('div');
    row.className = 'ex-row' + (type.id === state.type.id ? ' is-current' : '')
      + (st.seen === 0 ? ' is-untouched' : '');

    const name = document.createElement('span');
    name.className = 'ex-name';
    name.textContent = type.label;

    const count = document.createElement('span');
    count.className = 'ex-count';
    count.textContent = st.seen === 0 ? 'not tried yet' : `${st.seen} answer${st.seen === 1 ? '' : 's'}`;

    const bar = document.createElement('span');
    bar.className = 'ex-bar';
    if (st.accuracy !== null) {
      const fill = document.createElement('span');
      fill.className = 'ex-bar-fill';
      fill.style.width = `${Math.round(st.accuracy * 100)}%`;
      bar.append(fill);
    }

    const score = document.createElement('span');
    score.className = 'ex-score';
    score.textContent = st.accuracy === null ? '—' : `${Math.round(st.accuracy * 100)}%`;

    const weak = document.createElement('span');
    weak.className = 'ex-weak';
    if (st.weakest) {
      const [field, value] = splitItemKey(st.weakest.key);
      weak.textContent = `weakest: ${ITEM_FIELD_LABELS[field] ?? field} ${value}`;
    }

    row.append(name, count, bar, score, weak);
    box.append(row);
  }
}

/** Le chiavi sono `campo:valore`, e il valore puo' contenere ':'. */
function splitItemKey(key) {
  const i = key.indexOf(':');
  return [key.slice(0, i), key.slice(i + 1)];
}

function resetStats() {
  if (!confirm('Reset the spaced-repetition statistics? This cannot be undone.')) return;
  srs.reset();
  state.session = { asked: 0, perfect: 0 };
  renderStats();
}

init();

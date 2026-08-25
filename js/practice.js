/**
 * practice.js — controller della pagina Practice.
 *
 * Ciclo: stabilisci la tonalita' → suona il bersaglio → raccogli la risposta →
 * correggi campo per campo → aggiorna la ripetizione spaziata → ripeti.
 */

import * as audio from './audio.js';
import * as srs from './srs.js';
import { LEVELS, levelById, generateExercise } from './generator.js';
import { createQuiz } from './quiz-ui.js';
import * as notes from './notes.js';
import { itemKeyFor, formatHarte } from './harmony.js';

const $ = (sel) => document.querySelector(sel);

const NOTE_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const ITEM_FIELD_LABELS = {
  degree: 'degree', quality: 'quality', seventh: 'seventh',
  extensions: 'extensions', outOfKey: 'key relation', inversion: 'inversion',
};

const state = {
  level: levelById(Number(localStorage.getItem('eartraining.level')) || 1),
  context: localStorage.getItem('eartraining.context') || 'authentic',
  modes: localStorage.getItem('eartraining.modes') || 'major',
  exercise: null,
  lastSignature: null,
  running: false,
  session: { asked: 0, perfect: 0 },
};

let quiz;

// ---------------------------------------------------------------------------
// Avvio
// ---------------------------------------------------------------------------

function init() {
  buildLevelSelect();
  restoreControls();

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

  $('#level').addEventListener('change', (e) => {
    state.level = levelById(e.target.value);
    localStorage.setItem('eartraining.level', String(state.level.id));
    renderLevelHelp();
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
    if (!state.running) return;
    quiz.handleKey(ev);
  });

  notes.setContextProvider(describeSituation);

  renderLevelHelp();
  renderStats();
}

/**
 * Cosa c'e' a schermo adesso, per allegarlo a una nota. Senza questo una nota
 * come "questo accordo suonava sbagliato" non e' azionabile: serve sapere quale.
 */
function describeSituation() {
  const where = `Level ${state.level.id} (${state.level.label})`;
  if (!state.exercise) return where;
  const { key, target, fn } = state.exercise;
  return `${where} · ${NOTE_NAMES[key.tonic]} ${key.mode} · `
    + `target ${formatHarte(target)} = ${fn.degree} · context ${state.context}`;
}

function buildLevelSelect() {
  const sel = $('#level');
  for (const level of LEVELS) {
    const opt = document.createElement('option');
    opt.value = String(level.id);
    opt.textContent = `${level.id}. ${level.label}`;
    sel.append(opt);
  }
}

function restoreControls() {
  $('#level').value = String(state.level.id);
  $('#context').value = state.context;
  $('#modes').value = state.modes;
}

function renderLevelHelp() {
  $('#level-help').textContent = state.level.help;
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
    // Senza audio non c'e' esercizio: meglio dirlo che restare in caricamento.
    btn.disabled = false;
    btn.textContent = 'Retry';
    error.textContent = err.message;
    error.hidden = false;
    return;
  }

  $('#engine').textContent = engine === 'sampler'
    ? 'sampled piano'
    : 'synthesizer (samples unavailable)';

  // Le impostazioni restano visibili: livello, contesto e modo si cambiano
  // durante la sessione, senza ricaricare la pagina.
  state.running = true;
  $('#start-row').hidden = true;
  $('#session').hidden = false;
  nextExercise();
}

// ---------------------------------------------------------------------------
// Ciclo di esercizio
// ---------------------------------------------------------------------------

async function nextExercise() {
  const modes = state.modes === 'both' ? ['major', 'minor'] : ['major'];
  state.exercise = generateExercise({
    level: state.level,
    modes,
    avoid: state.lastSignature,
  });
  state.lastSignature = state.exercise.signature;

  renderKey();
  quiz.setExercise(state.exercise);
  await playExercise({ withContext: true });
}

/** Contesto tonale, poi il bersaglio. Con il drone il contesto resta acceso sotto. */
async function playExercise({ withContext }) {
  const { key, audio: source } = state.exercise;
  if (withContext) {
    const lead = await audio.establishKey(key, state.context);
    await new Promise((r) => setTimeout(r, lead * 1000));
  }
  audio.playNotes(source.voicing, { duration: 3.0, velocity: 0.72 });
}

function handleReplay(what) {
  if (!state.exercise) return;
  if (what === 'context') playExercise({ withContext: true });
  else audio.playNotes(state.exercise.audio.voicing, { duration: 3.0, velocity: 0.72 });
}

function handleGraded(grade, exercise) {
  const fn = grade.target.function;
  srs.recordExercise(grade.results, (field) => itemKeyFor(field, exercise.target, fn));

  state.session.asked += 1;
  if (grade.allCorrect) state.session.perfect += 1;
  renderStats();
}

function renderKey() {
  const { tonic, mode } = state.exercise.key;
  $('#current-key').textContent =
    `${NOTE_NAMES[tonic]} ${mode === 'major' ? 'major' : 'minor'}`;
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

  const list = $('#weakest');
  list.innerHTML = '';
  if (s.weakest.length === 0) {
    list.append(Object.assign(document.createElement('li'), {
      className: 'muted',
      textContent: 'Nothing yet: an item needs at least two attempts to show up here.',
    }));
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

/** Le chiavi sono `campo:valore`, e il valore puo' contenere ':' — separa solo il primo. */
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

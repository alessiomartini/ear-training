/**
 * quiz-ui.js — interfaccia di risposta, condivisa fra Practice e Songs.
 *
 * Non sa niente di come si produce il suono: riceve un Exercise, mostra i campi
 * previsti dal livello, e richiama i callback per riascoltare e per proseguire.
 * L'unica differenza fra le due pagine e' il campo `audio` dell'esercizio, e
 * quello lo gestisce chi ha costruito l'esercizio, non questa UI.
 *
 * Risposta a piu' campi, mai a scelta multipla su tutto l'accordo: sbagliare la
 * settima ma indovinare il grado deve contare come mezzo successo, altrimenti
 * non si sa su cosa insistere.
 */

import { gradeAnswer, formatHarte } from './harmony.js';

const NOTE_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

const DEGREE_OPTIONS = [
  ['I', 'I'], ['bII', '♭II'], ['II', 'II'], ['bIII', '♭III'], ['III', 'III'], ['IV', 'IV'],
  ['#IV', '♯IV'], ['V', 'V'], ['bVI', '♭VI'], ['VI', 'VI'], ['bVII', '♭VII'], ['VII', 'VII'],
];

const QUALITY_OPTIONS = [
  ['maj', 'major'], ['min', 'minor'], ['dim', 'diminished'], ['aug', 'augmented'],
  ['hdim', 'half-diminished'], ['sus2', 'sus2'], ['sus4', 'sus4'],
];

const SEVENTH_OPTIONS = [
  ['', 'none'], ['maj7', 'major'], ['min7', 'minor'], ['dim7', 'diminished'],
];

const EXTENSION_OPTIONS = [['9', '9'], ['11', '11'], ['#11', '♯11'], ['13', '13']];

const INVERSION_OPTIONS = [
  ['0', 'root position'], ['1', '1st inversion'], ['2', '2nd inversion'], ['3', '3rd inversion'],
];

const OUT_OF_KEY_OPTIONS = [
  ['false', 'diatonic or borrowed'], ['true', 'outside the key'],
];

const FIELD_LABELS = {
  degree: 'Degree', quality: 'Quality', seventh: 'Seventh',
  extensions: 'Extensions', outOfKey: 'Relation to the key', inversion: 'Inversion',
};

// ---------------------------------------------------------------------------
// Descrizioni leggibili
// ---------------------------------------------------------------------------

const QUALITY_NAMES = {
  maj: 'major', min: 'minor', dim: 'diminished', aug: 'augmented',
  hdim: 'half-diminished', sus2: 'sus2', sus4: 'sus4',
};
const SEVENTH_NAMES = {
  maj7: 'major seventh', min7: 'minor seventh', dim7: 'diminished seventh',
};

/**
 * Descrizione a parole di un accordo. Serve accanto all'etichetta Harte perche'
 * la notazione abbreviata non sa esprimere tutto (una `maj13` sottintende la
 * nona e l'undicesima anche quando l'accordo generato ha solo 9 e 13).
 */
export function describeChord(chord) {
  if (!chord) return 'no chord';
  const parts = [`${NOTE_NAMES[chord.root]} ${QUALITY_NAMES[chord.quality] ?? chord.quality}`];
  if (chord.seventh) parts.push(SEVENTH_NAMES[chord.seventh]);
  if (chord.extensions.length) parts.push(`with ${chord.extensions.join(', ')}`);
  if (chord.bass !== null && chord.bass !== undefined) parts.push(`${NOTE_NAMES[chord.bass]} in the bass`);
  return parts.join(', ');
}

const formatAnswerValue = (field, value) => {
  if (value === null || value === undefined || value === '') return '—';
  switch (field) {
    case 'quality': return QUALITY_NAMES[value] ?? value;
    case 'seventh': return SEVENTH_NAMES[value] ?? 'none';
    case 'extensions': return value.length ? value.join(', ') : 'none';
    case 'inversion': return INVERSION_OPTIONS[Number(value)]?.[1] ?? String(value);
    case 'outOfKey': return value === true || value === 'true' ? 'outside the key' : 'diatonic or borrowed';
    default: return String(value);
  }
};

function correctValueFor(field, chord, fn) {
  switch (field) {
    case 'degree': return fn.degree;
    case 'quality': return QUALITY_NAMES[chord.quality] ?? chord.quality;
    case 'seventh': return chord.seventh ? SEVENTH_NAMES[chord.seventh] : 'none';
    case 'extensions': return chord.extensions.length ? chord.extensions.join(', ') : 'none';
    case 'inversion': return INVERSION_OPTIONS[fn.inversion]?.[1] ?? 'bass not in the chord';
    case 'outOfKey': return fn.outOfKey ? 'outside the key' : 'diatonic or borrowed';
    default: return '?';
  }
}

// ---------------------------------------------------------------------------
// Costruzione DOM
// ---------------------------------------------------------------------------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function buildField(field, options, { multi = false } = {}) {
  const wrap = el('div', 'field');
  wrap.dataset.field = field;
  wrap.append(el('div', 'field-label', FIELD_LABELS[field]));

  const opts = el('div', `options${multi ? ' options-multi' : ''}`);
  for (const [value, label] of options) {
    const b = el('button', 'chip', label);
    b.type = 'button';
    b.dataset.value = value;
    opts.append(b);
  }
  if (multi) {
    const none = el('button', 'chip chip-none', 'none');
    none.type = 'button';
    none.dataset.value = '__none__';
    opts.prepend(none);
  }
  wrap.append(opts);
  return wrap;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

/**
 * @param {HTMLElement} root  contenitore vuoto
 * @param {object} handlers
 * @param {(grade:object, exercise:object)=>void} handlers.onGraded
 * @param {()=>void} handlers.onNext
 * @param {(what:'chord'|'context')=>void} handlers.onReplay
 */
export function createQuiz(root, { onGraded, onNext, onReplay } = {}) {
  root.classList.add('quiz');
  root.innerHTML = '';

  const fieldNodes = {
    degree: buildField('degree', DEGREE_OPTIONS),
    quality: buildField('quality', QUALITY_OPTIONS),
    seventh: buildField('seventh', SEVENTH_OPTIONS),
    extensions: buildField('extensions', EXTENSION_OPTIONS, { multi: true }),
    outOfKey: buildField('outOfKey', OUT_OF_KEY_OPTIONS),
    inversion: buildField('inversion', INVERSION_OPTIONS),
  };
  for (const node of Object.values(fieldNodes)) root.append(node);

  const actions = el('div', 'quiz-actions');
  const submitBtn = el('button', 'btn btn-primary', 'Check');
  submitBtn.type = 'button';
  const hint = el('span', 'hint', 'Enter to check');
  actions.append(submitBtn, hint);
  root.append(actions);

  const feedback = el('div', 'feedback');
  feedback.hidden = true;
  root.append(feedback);

  let exercise = null;
  let answer = {};
  let answered = new Set();
  let locked = false;

  // --- selezione -----------------------------------------------------------

  root.addEventListener('click', (ev) => {
    const chip = ev.target.closest('.chip');
    if (!chip || locked) return;
    const field = chip.closest('.field').dataset.field;
    const value = chip.dataset.value;

    if (field === 'extensions') {
      const current = new Set(answer.extensions ?? []);
      if (value === '__none__') current.clear();
      else if (current.has(value)) current.delete(value);
      else current.add(value);
      answer.extensions = [...current];
      answered.add('extensions');
      paintExtensions();
    } else {
      answer[field] = value;
      answered.add(field);
      for (const c of chip.parentElement.querySelectorAll('.chip')) c.classList.remove('selected');
      chip.classList.add('selected');
    }
    updateSubmitState();
  });

  function paintExtensions() {
    const chosen = new Set(answer.extensions ?? []);
    const node = fieldNodes.extensions;
    for (const c of node.querySelectorAll('.chip')) {
      const isNone = c.dataset.value === '__none__';
      c.classList.toggle('selected', isNone ? chosen.size === 0 && answered.has('extensions')
                                            : chosen.has(c.dataset.value));
    }
  }

  const activeFields = () => exercise?.fields ?? [];

  function updateSubmitState() {
    submitBtn.disabled = locked || !exercise || !activeFields().every((f) => answered.has(f));
  }

  // --- ciclo ---------------------------------------------------------------

  function setExercise(next) {
    exercise = next;
    answer = {};
    answered = new Set();
    locked = false;
    feedback.hidden = true;
    feedback.innerHTML = '';

    for (const [field, node] of Object.entries(fieldNodes)) {
      node.hidden = !activeFields().includes(field);
      for (const c of node.querySelectorAll('.chip')) c.classList.remove('selected');
    }
    submitBtn.textContent = 'Check';
    updateSubmitState();
  }

  function submit() {
    if (locked || submitBtn.disabled || !exercise) return;

    const payload = {
      degree: answer.degree,
      quality: answer.quality,
      seventh: answer.seventh === '' ? null : answer.seventh,
      extensions: answer.extensions ?? [],
      inversion: answer.inversion === undefined ? 0 : Number(answer.inversion),
      outOfKey: answer.outOfKey === 'true',
    };

    const grade = gradeAnswer(payload, exercise.target, exercise.key, activeFields());
    locked = true;
    submitBtn.disabled = true;
    renderFeedback(grade, payload);
    onGraded?.(grade, exercise);
  }

  function renderFeedback(grade, payload) {
    const { chord, function: fn } = grade.target;
    feedback.innerHTML = '';
    feedback.hidden = false;
    feedback.classList.toggle('all-correct', grade.allCorrect);

    feedback.append(el('div', 'feedback-title',
      grade.allCorrect ? 'Correct' : 'Check the marked fields'));

    const table = el('div', 'grade-table');
    for (const field of activeFields()) {
      const ok = grade.results[field];
      const row = el('div', `grade-row ${ok ? 'ok' : 'ko'}`);
      row.append(el('span', 'grade-mark', ok ? '✓' : '✗'));
      row.append(el('span', 'grade-field', FIELD_LABELS[field]));
      row.append(el('span', 'grade-given', formatAnswerValue(field, payload[field])));
      row.append(el('span', 'grade-correct', ok ? '' : correctValueFor(field, chord, fn)));
      table.append(row);
    }
    feedback.append(table);

    const analysis = el('div', 'analysis');
    analysis.append(el('div', 'analysis-chord', describeChord(chord)));
    analysis.append(el('code', 'analysis-harte', formatHarte(chord)));
    const notes = [];
    if (fn.secondary) notes.push(`secondary dominant: ${fn.secondary}`);
    if (fn.borrowed) notes.push(`borrowed from the parallel ${fn.borrowed === 'parallel-minor' ? 'minor' : 'major'}`);
    if (fn.diatonic) notes.push('diatonic');
    else if (fn.outOfKey) notes.push('outside the key');
    if (notes.length) analysis.append(el('div', 'analysis-notes', notes.join(' · ')));
    feedback.append(analysis);

    const replay = el('div', 'replay-bar');
    for (const [what, label] of [['chord', 'Replay chord'], ['context', 'In context']]) {
      const b = el('button', 'btn btn-ghost', label);
      b.type = 'button';
      b.addEventListener('click', () => onReplay?.(what));
      replay.append(b);
    }
    const nextBtn = el('button', 'btn btn-primary', 'Next');
    nextBtn.type = 'button';
    nextBtn.addEventListener('click', () => onNext?.());
    replay.append(nextBtn);
    feedback.append(replay);
    nextBtn.focus();
  }

  submitBtn.addEventListener('click', submit);

  /** Invio: verifica, poi avanza. Spazio: riascolta l'accordo. */
  function handleKey(ev) {
    if (ev.target.matches('input, textarea')) return;
    if (ev.key === 'Enter') {
      ev.preventDefault();
      if (locked) onNext?.();
      else submit();
    } else if (ev.key === ' ' && !ev.repeat) {
      ev.preventDefault();
      onReplay?.('chord');
    }
  }

  return { setExercise, submit, handleKey, get locked() { return locked; } };
}

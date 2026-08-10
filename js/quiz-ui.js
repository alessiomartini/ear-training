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

const NOTE_NAMES = ['Do', 'Re♭', 'Re', 'Mi♭', 'Mi', 'Fa', 'Sol♭', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];

const DEGREE_OPTIONS = [
  ['I', 'I'], ['bII', '♭II'], ['II', 'II'], ['bIII', '♭III'], ['III', 'III'], ['IV', 'IV'],
  ['#IV', '♯IV'], ['V', 'V'], ['bVI', '♭VI'], ['VI', 'VI'], ['bVII', '♭VII'], ['VII', 'VII'],
];

const QUALITY_OPTIONS = [
  ['maj', 'maggiore'], ['min', 'minore'], ['dim', 'diminuita'], ['aug', 'aumentata'],
  ['hdim', 'semidiminuita'], ['sus2', 'sus2'], ['sus4', 'sus4'],
];

const SEVENTH_OPTIONS = [
  ['', 'nessuna'], ['maj7', 'maggiore'], ['min7', 'minore'], ['dim7', 'diminuita'],
];

const EXTENSION_OPTIONS = [['9', '9'], ['11', '11'], ['#11', '♯11'], ['13', '13']];

const INVERSION_OPTIONS = [
  ['0', 'fondamentale'], ['1', '1º rivolto'], ['2', '2º rivolto'], ['3', '3º rivolto'],
];

const OUT_OF_KEY_OPTIONS = [
  ['false', 'diatonico o prestito'], ['true', 'estraneo alla tonalità'],
];

const FIELD_LABELS = {
  degree: 'Grado', quality: 'Qualità', seventh: 'Settima',
  extensions: 'Estensioni', outOfKey: 'Rapporto con la tonalità', inversion: 'Rivolto',
};

// ---------------------------------------------------------------------------
// Descrizioni leggibili
// ---------------------------------------------------------------------------

const QUALITY_IT = {
  maj: 'maggiore', min: 'minore', dim: 'diminuita', aug: 'aumentata',
  hdim: 'semidiminuita', sus2: 'sus2', sus4: 'sus4',
};
const SEVENTH_IT = { maj7: 'settima maggiore', min7: 'settima minore', dim7: 'settima diminuita' };

/**
 * Descrizione in italiano di un accordo. Serve accanto all'etichetta Harte
 * perche' la notazione abbreviata non sa esprimere tutto (una `maj13` sottintende
 * la nona e l'undicesima anche quando l'accordo generato ha solo 9 e 13).
 */
export function describeChord(chord) {
  if (!chord) return 'nessun accordo';
  const parts = [`${NOTE_NAMES[chord.root]} ${QUALITY_IT[chord.quality] ?? chord.quality}`];
  if (chord.seventh) parts.push(SEVENTH_IT[chord.seventh]);
  if (chord.extensions.length) parts.push(`con ${chord.extensions.join(', ')}`);
  if (chord.bass !== null && chord.bass !== undefined) parts.push(`basso ${NOTE_NAMES[chord.bass]}`);
  return parts.join(', ');
}

const formatAnswerValue = (field, value) => {
  if (value === null || value === undefined || value === '') return '—';
  switch (field) {
    case 'quality': return QUALITY_IT[value] ?? value;
    case 'seventh': return SEVENTH_IT[value] ?? 'nessuna';
    case 'extensions': return value.length ? value.join(', ') : 'nessuna';
    case 'inversion': return INVERSION_OPTIONS[Number(value)]?.[1] ?? String(value);
    case 'outOfKey': return value === true || value === 'true' ? 'estraneo' : 'diatonico o prestito';
    default: return String(value);
  }
};

function correctValueFor(field, chord, fn) {
  switch (field) {
    case 'degree': return fn.degree;
    case 'quality': return QUALITY_IT[chord.quality] ?? chord.quality;
    case 'seventh': return chord.seventh ? SEVENTH_IT[chord.seventh] : 'nessuna';
    case 'extensions': return chord.extensions.length ? chord.extensions.join(', ') : 'nessuna';
    case 'inversion': return INVERSION_OPTIONS[fn.inversion]?.[1] ?? `basso estraneo`;
    case 'outOfKey': return fn.outOfKey ? 'estraneo' : 'diatonico o prestito';
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
    const none = el('button', 'chip chip-none', 'nessuna');
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
  const submitBtn = el('button', 'btn btn-primary', 'Verifica');
  submitBtn.type = 'button';
  const hint = el('span', 'hint', 'Invio per verificare');
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
    submitBtn.textContent = 'Verifica';
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
      grade.allCorrect ? 'Corretto' : 'Rivedi i campi segnati'));

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
    if (fn.secondary) notes.push(`dominante secondaria: ${fn.secondary}`);
    if (fn.borrowed) notes.push(`prestito dal modo ${fn.borrowed === 'parallel-minor' ? 'minore' : 'maggiore'}`);
    if (fn.diatonic) notes.push('diatonico');
    else if (fn.outOfKey) notes.push('estraneo alla tonalità');
    if (notes.length) analysis.append(el('div', 'analysis-notes', notes.join(' · ')));
    feedback.append(analysis);

    const replay = el('div', 'replay-bar');
    for (const [what, label] of [['chord', 'Riascolta accordo'], ['context', 'Nel contesto']]) {
      const b = el('button', 'btn btn-ghost', label);
      b.type = 'button';
      b.addEventListener('click', () => onReplay?.(what));
      replay.append(b);
    }
    const nextBtn = el('button', 'btn btn-primary', 'Prossimo');
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

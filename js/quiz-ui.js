/**
 * quiz-ui.js — interfaccia di risposta, condivisa da tutti i tipi di esercizio.
 *
 * Non sa niente di armonia ne' di come si produce il suono: riceve una lista di
 * campi (`{id, label, options, multi}`) e una funzione `grade`, mostra il
 * modulo, e rende il verdetto. Prima i campi erano cablati sugli accordi, il che
 * andava benissimo finche' l'esercizio era uno solo; con sette tipi diversi —
 * intervalli, metro, modulazioni — dovevano diventare dati.
 *
 * Risposta a piu' campi, mai a scelta multipla sull'intero esercizio: sbagliare
 * la settima ma indovinare la triade e' mezzo successo, e la ripetizione
 * spaziata deve poterlo distinguere.
 */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const NONE = '__none__';

/**
 * @param {HTMLElement} root contenitore vuoto
 * @param {object} handlers onGraded(grade) · onNext() · onReplay('chord'|'context')
 */
export function createQuiz(root, { onGraded, onNext, onReplay } = {}) {
  root.classList.add('quiz');
  root.innerHTML = '';

  const fieldsBox = el('div', 'quiz-fields');
  root.append(fieldsBox);

  const actions = el('div', 'quiz-actions');
  const submitBtn = el('button', 'btn btn-primary', 'Check');
  submitBtn.type = 'button';
  actions.append(submitBtn, el('span', 'hint', 'Enter to check'));
  root.append(actions);

  const feedback = el('div', 'feedback');
  feedback.hidden = true;
  root.append(feedback);

  let spec = [];          // campi dell'esercizio corrente
  let gradeFn = null;
  let answer = {};
  let answered = new Set();
  let locked = false;
  let replayable = true;

  // --- costruzione dei campi ----------------------------------------------

  function buildFields() {
    fieldsBox.replaceChildren();
    for (const field of spec) {
      const wrap = el('div', 'field');
      wrap.dataset.field = field.id;
      wrap.append(el('div', 'field-label', field.label));

      const opts = el('div', `options${field.multi ? ' options-multi' : ''}`);
      if (field.multi) {
        const none = el('button', 'chip chip-none', 'none');
        none.type = 'button';
        none.dataset.value = NONE;
        opts.append(none);
      }
      for (const [value, text] of field.options) {
        const b = el('button', 'chip', text);
        b.type = 'button';
        b.dataset.value = value;
        opts.append(b);
      }
      wrap.append(opts);
      fieldsBox.append(wrap);
    }
  }

  fieldsBox.addEventListener('click', (ev) => {
    const chip = ev.target.closest('.chip');
    if (!chip || locked) return;
    const id = chip.closest('.field').dataset.field;
    const field = spec.find((f) => f.id === id);
    const value = chip.dataset.value;

    if (field.multi) {
      const current = new Set(answer[id] ?? []);
      if (value === NONE) current.clear();
      else if (current.has(value)) current.delete(value);
      else current.add(value);
      answer[id] = [...current];
      answered.add(id);
      paintMulti(field);
    } else {
      answer[id] = value;
      answered.add(id);
      for (const c of chip.parentElement.querySelectorAll('.chip')) c.classList.remove('selected');
      chip.classList.add('selected');
    }
    updateSubmitState();
  });

  function paintMulti(field) {
    const node = fieldsBox.querySelector(`.field[data-field="${field.id}"]`);
    const chosen = new Set(answer[field.id] ?? []);
    for (const c of node.querySelectorAll('.chip')) {
      const isNone = c.dataset.value === NONE;
      c.classList.toggle('selected', isNone
        ? chosen.size === 0 && answered.has(field.id)
        : chosen.has(c.dataset.value));
    }
  }

  function updateSubmitState() {
    submitBtn.disabled = locked || spec.length === 0 || !spec.every((f) => answered.has(f.id));
  }

  // --- ciclo ---------------------------------------------------------------

  function setExercise({ fields, grade, canReplayContext = true }) {
    spec = fields ?? [];
    gradeFn = grade;
    answer = {};
    answered = new Set();
    locked = false;
    replayable = canReplayContext;
    feedback.hidden = true;
    feedback.replaceChildren();
    submitBtn.textContent = 'Check';
    buildFields();
    updateSubmitState();
  }

  function submit() {
    if (locked || submitBtn.disabled || !gradeFn) return;
    const payload = {};
    for (const f of spec) payload[f.id] = f.multi ? (answer[f.id] ?? []) : answer[f.id];

    const grade = gradeFn(payload);
    locked = true;
    submitBtn.disabled = true;
    renderFeedback(grade, payload);
    onGraded?.(grade);
  }

  function shown(field, value) {
    if (field.multi) return value.length ? value.map((v) => optionLabel(field, v)).join(', ') : 'none';
    return optionLabel(field, value);
  }
  const optionLabel = (field, value) =>
    field.options.find(([v]) => v === value)?.[1] ?? (value === '' ? 'none' : String(value ?? '—'));

  function renderFeedback(grade, payload) {
    feedback.replaceChildren();
    feedback.hidden = false;
    const allCorrect = Object.values(grade.results).every(Boolean);
    feedback.classList.toggle('all-correct', allCorrect);
    feedback.append(el('div', 'feedback-title', allCorrect ? 'Correct' : 'Check the marked fields'));

    const table = el('div', 'grade-table');
    for (const field of spec) {
      const ok = grade.results[field.id];
      const row = el('div', `grade-row ${ok ? 'ok' : 'ko'}`);
      row.append(
        el('span', 'grade-mark', ok ? '✓' : '✗'),
        el('span', 'grade-field', field.label),
        el('span', 'grade-given', shown(field, payload[field.id])),
        el('span', 'grade-correct', ok ? '' : String(grade.correct?.[field.id] ?? '')),
      );
      table.append(row);
    }
    feedback.append(table);

    if (grade.explain) {
      const box = el('div', 'analysis');
      if (grade.explain.title) box.append(el('div', 'analysis-chord', grade.explain.title));
      if (grade.explain.code) box.append(el('code', 'analysis-harte', grade.explain.code));
      if (grade.explain.notes) box.append(el('div', 'analysis-notes', grade.explain.notes));
      feedback.append(box);
    }

    const bar = el('div', 'replay-bar');
    const buttons = replayable
      ? [['chord', 'Replay'], ['context', 'In context']]
      : [['chord', 'Replay']];
    for (const [what, text] of buttons) {
      const b = el('button', 'btn btn-ghost', text);
      b.type = 'button';
      b.addEventListener('click', () => onReplay?.(what));
      bar.append(b);
    }
    const next = el('button', 'btn btn-primary', 'Next');
    next.type = 'button';
    next.addEventListener('click', () => onNext?.());
    bar.append(next);
    feedback.append(bar);
    next.focus();
  }

  submitBtn.addEventListener('click', submit);

  /** Invio: verifica, poi avanza. Spazio: riascolta. */
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

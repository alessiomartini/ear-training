/**
 * notes.js — appunti, idee e segnalazioni raccolti mentre si usa il sito.
 *
 * Il sito e' statico e non ha backend: le note vivono in `localStorage` e non
 * escono dal browser da sole. Il pezzo che conta davvero e' quindi l'**export**,
 * perche' e' l'unico modo per farle arrivare a chi poi implementa le modifiche:
 * un pulsante che copia tutto negli appunti come Markdown, e uno che lo scarica
 * come file.
 *
 * Ogni nota si porta dietro il contesto in cui e' stata scritta. Una nota come
 * "questo accordo suonava sbagliato" e' inutile senza sapere quale accordo era
 * a schermo; con `setContextProvider` la pagina Practice allega livello,
 * tonalita' e accordo bersaglio del momento.
 */

const STORAGE_KEY = 'eartraining.notes.v1';

/** @typedef {{id:string, text:string, at:number, page:string, context:string|null, done:boolean}} Note */

let contextProvider = null;
let state = null;
let ui = null;

/**
 * Registra una funzione che descrive cosa c'e' a schermo adesso.
 * @param {() => (string|null)} fn
 */
export function setContextProvider(fn) {
  contextProvider = fn;
}

// ---------------------------------------------------------------------------
// Persistenza
// ---------------------------------------------------------------------------

function load() {
  if (state) return state;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    state = Array.isArray(parsed?.notes) ? parsed : { version: 1, notes: [] };
  } catch {
    state = { version: 1, notes: [] };
  }
  return state;
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota piena o storage disabilitato: le note restano almeno in memoria */
  }
}

export const allNotes = () => load().notes;

export function addNote(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return null;
  let context = null;
  try {
    context = contextProvider?.() ?? null;
  } catch {
    context = null;
  }
  const note = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    text: trimmed,
    at: Date.now(),
    page: location.pathname.split('/').pop() || 'index.html',
    context,
    done: false,
  };
  load().notes.push(note);
  save();
  return note;
}

export function removeNote(id) {
  const s = load();
  s.notes = s.notes.filter((n) => n.id !== id);
  save();
}

export function toggleDone(id) {
  const note = load().notes.find((n) => n.id === id);
  if (note) { note.done = !note.done; save(); }
}

export function clearAll() {
  state = { version: 1, notes: [] };
  save();
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

const stamp = (ms) => {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} `
    + `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Markdown pensato per essere incollato in una conversazione: ogni nota e' una
 * richiesta a se' stante, con il contesto accanto.
 */
export function toMarkdown() {
  const notes = allNotes();
  const open = notes.filter((n) => !n.done);
  const done = notes.filter((n) => n.done);

  const lines = [
    '# Harmonic Ear Training — notes',
    '',
    `Exported ${stamp(Date.now())} · ${open.length} open, ${done.length} done`,
    '',
  ];

  const section = (title, list) => {
    if (list.length === 0) return;
    lines.push(`## ${title}`, '');
    list.forEach((n, i) => {
      lines.push(`**${i + 1}.** ${n.text}`);
      const meta = [stamp(n.at), n.page];
      if (n.context) meta.push(n.context);
      lines.push(`> ${meta.join(' · ')}`, '');
    });
  };

  section('Open', open);
  section('Done', done);

  if (notes.length === 0) lines.push('_No notes._');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Interfaccia
// ---------------------------------------------------------------------------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function build() {
  const toggle = el('button', 'notes-toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Notes and ideas');
  toggle.append(el('span', 'notes-toggle-icon', '✎'));
  const label = el('span', 'notes-toggle-label', 'Notes');
  const badge = el('span', 'notes-badge', '0');
  toggle.append(label, badge);

  const panel = el('section', 'notes-panel');
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Notes and ideas');

  const head = el('div', 'notes-head');
  head.append(el('h2', 'notes-title', 'Notes & ideas'));
  const close = el('button', 'notes-close', '✕');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close');
  head.append(close);
  panel.append(head);

  panel.append(el('p', 'notes-hint',
    'Jot down anything you want changed. Nothing leaves your browser — use '
    + '“Copy all” and paste the result into Claude to have it implemented.'));

  const form = el('div', 'notes-form');
  const textarea = el('textarea', 'notes-input');
  textarea.rows = 3;
  textarea.placeholder = 'The drone is too quiet compared to the chord…';
  const addBtn = el('button', 'btn btn-primary notes-add', 'Add note');
  addBtn.type = 'button';
  form.append(textarea, addBtn);
  panel.append(form);

  const contextLine = el('div', 'notes-context');
  contextLine.hidden = true;
  panel.append(contextLine);

  const list = el('ul', 'notes-list');
  panel.append(list);

  const foot = el('div', 'notes-foot');
  const copyBtn = el('button', 'btn btn-ghost', 'Copy all');
  const dlBtn = el('button', 'btn btn-ghost', 'Download .md');
  const clearBtn = el('button', 'btn btn-ghost notes-clear', 'Clear');
  for (const b of [copyBtn, dlBtn, clearBtn]) b.type = 'button';
  foot.append(copyBtn, dlBtn, clearBtn);
  panel.append(foot);

  const status = el('div', 'notes-status');
  status.setAttribute('role', 'status');
  panel.append(status);

  document.body.append(toggle, panel);
  return { toggle, badge, panel, close, textarea, addBtn, contextLine, list, copyBtn, dlBtn, clearBtn, status };
}

let statusTimer = null;
function flash(message) {
  ui.status.textContent = message;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { ui.status.textContent = ''; }, 2600);
}

function renderContext() {
  let context = null;
  try {
    context = contextProvider?.() ?? null;
  } catch {
    context = null;
  }
  ui.contextLine.hidden = !context;
  ui.contextLine.textContent = context ? `Will be filed under: ${context}` : '';
}

function render() {
  const notes = allNotes();
  const open = notes.filter((n) => !n.done).length;
  ui.badge.textContent = String(open);
  ui.badge.hidden = open === 0;

  ui.list.innerHTML = '';
  if (notes.length === 0) {
    ui.list.append(el('li', 'notes-empty', 'No notes yet.'));
    return;
  }

  // Le piu' recenti in cima, quelle chiuse in fondo.
  const ordered = [...notes].sort((a, b) => (a.done - b.done) || (b.at - a.at));
  for (const note of ordered) {
    const li = el('li', `notes-item${note.done ? ' is-done' : ''}`);

    const doneBtn = el('button', 'notes-item-done', note.done ? '↺' : '✓');
    doneBtn.type = 'button';
    doneBtn.title = note.done ? 'Reopen' : 'Mark as done';
    doneBtn.addEventListener('click', () => { toggleDone(note.id); render(); });

    const body = el('div', 'notes-item-body');
    body.append(el('div', 'notes-item-text', note.text));
    const meta = [stamp(note.at), note.page];
    if (note.context) meta.push(note.context);
    body.append(el('div', 'notes-item-meta', meta.join(' · ')));

    const del = el('button', 'notes-item-del', '✕');
    del.type = 'button';
    del.title = 'Delete';
    del.addEventListener('click', () => { removeNote(note.id); render(); });

    li.append(doneBtn, body, del);
    ui.list.append(li);
  }
}

/** Fallback quando `navigator.clipboard` non c'e' o viene rifiutato. */
function manualCopy(text) {
  const ta = el('textarea', 'notes-fallback');
  ta.value = text;
  ui.panel.append(ta);
  ta.select();
  let copied = false;
  try { copied = document.execCommand('copy'); } catch { copied = false; }
  if (copied) ta.remove();
  else flash('Copy failed — select the text below and copy it by hand.');
  return copied;
}

async function copyAll() {
  const text = toMarkdown();
  try {
    await navigator.clipboard.writeText(text);
    flash('Copied. Paste it into Claude.');
  } catch {
    if (manualCopy(text)) flash('Copied. Paste it into Claude.');
  }
}

function download() {
  const blob = new Blob([toMarkdown()], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = el('a');
  a.href = url;
  a.download = `ear-training-notes-${new Date().toISOString().slice(0, 10)}.md`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function open() {
  ui.panel.hidden = false;
  ui.toggle.classList.add('is-open');
  renderContext();
  render();
  ui.textarea.focus();
}

function closePanel() {
  ui.panel.hidden = true;
  ui.toggle.classList.remove('is-open');
  ui.panel.querySelector('.notes-fallback')?.remove();
}

function submit() {
  const note = addNote(ui.textarea.value);
  if (!note) return;
  ui.textarea.value = '';
  render();
  flash('Saved.');
}

function init() {
  ui = build();

  ui.toggle.addEventListener('click', () => (ui.panel.hidden ? open() : closePanel()));
  ui.close.addEventListener('click', closePanel);
  ui.addBtn.addEventListener('click', submit);
  ui.copyBtn.addEventListener('click', copyAll);
  ui.dlBtn.addEventListener('click', download);
  ui.clearBtn.addEventListener('click', () => {
    if (!allNotes().length) return;
    if (!confirm('Delete all notes? This cannot be undone — export them first if you want to keep them.')) return;
    clearAll();
    render();
    flash('All notes deleted.');
  });

  // Ctrl/Cmd+Invio salva senza staccare le mani dalla tastiera.
  ui.textarea.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) {
      ev.preventDefault();
      submit();
    }
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !ui.panel.hidden) closePanel();
  });

  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}

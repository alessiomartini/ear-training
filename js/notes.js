/**
 * notes.js — appunti, idee e segnalazioni raccolti mentre si usa il sito.
 *
 * Due modi di conservarli, e il primo funziona sempre:
 *
 *  1. `localStorage`, sempre. E' la copia di lavoro: le note non si perdono se
 *     la rete cade, se il Worker e' giu' o se la sincronizzazione non e'
 *     configurata affatto.
 *  2. Il database D1 unico delle note di tutti i siti, via il Worker `site-notes`
 *     (repo alessiomartini/site-notes): ogni nota nuova ci viene inviata (solo
 *     scrittura, nessun token). Claude legge D1 direttamente e porta le note nel
 *     ROADMAP; il sito non rilegge niente da li'. Spuntare o cancellare una nota
 *     qui cambia solo la copia locale.
 *
 * Ogni nota si porta dietro il contesto in cui e' stata scritta: una nota come
 * "questo accordo suonava sbagliato" e' inutile senza sapere quale accordo era
 * a schermo. `setContextProvider` lo fornisce.
 */

const STORAGE_KEY = 'eartraining.notes.v1';
const ENDPOINT = 'https://site-notes.alemarti-2001.workers.dev/ear-training';

/** @typedef {{id:string, text:string, at:number, page:string, context:string|null, done:boolean, pending:boolean}} Note */

let contextProvider = null;
let state = null;
let ui = null;

export function setContextProvider(fn) {
  contextProvider = fn;
}

// ---------------------------------------------------------------------------
// Persistenza locale
// ---------------------------------------------------------------------------

const blank = () => ({ version: 2, notes: [] });

function load() {
  if (state) return state;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && Array.isArray(parsed.notes)) {
      state = { ...blank(), ...parsed };
      // v1 non aveva `pending`: le note gia' presenti vanno caricate su D1.
      if (!parsed.version || parsed.version < 2) {
        state.notes = state.notes.map((n) => ({ ...n, pending: true }));
        state.version = 2;
      }
    } else {
      state = blank();
    }
  } catch {
    state = blank();
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
    pending: true,
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
  const s = load();
  s.notes = [];
  save();
}

// ---------------------------------------------------------------------------
// Sincronizzazione con D1 (via Worker)
// ---------------------------------------------------------------------------

/**
 * Invia a site-notes le note non ancora inviate. Quelle che non partono restano
 * `pending` e riprovano alla prossima occasione: non si perde niente.
 * @returns {Promise<{pushed:number}>}
 */
export async function syncNow() {
  let pushed = 0;
  for (const note of load().notes.filter((n) => n.pending)) {
    const res = await fetch(ENDPOINT + '/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: note.text, page: note.page, context: note.context }),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text().catch(() => '')).slice(0, 140)}`);
    note.pending = false;
    pushed += 1;
    save();
  }
  return { pushed };
}

// ---------------------------------------------------------------------------
// Export testuale
// ---------------------------------------------------------------------------

const stamp = (ms) => {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} `
    + `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

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
  toggle.append(el('span', 'notes-toggle-icon', '✎'), el('span', 'notes-toggle-label', 'Notes'));
  const badge = el('span', 'notes-badge', '0');
  toggle.append(badge);

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

  const hint = el('p', 'notes-hint');
  panel.append(hint);

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
  return {
    toggle, badge, panel, close, textarea, addBtn, contextLine, list, hint,
    copyBtn, dlBtn, clearBtn, status,
  };
}

let statusTimer = null;
function flash(message, kind = 'ok') {
  ui.status.textContent = message;
  ui.status.className = `notes-status is-${kind}`;
  clearTimeout(statusTimer);
  if (kind !== 'error') statusTimer = setTimeout(() => { ui.status.textContent = ''; }, 3000);
}

function renderHint() {
  ui.hint.textContent = 'Jot down anything you want changed. New notes are sent to the notes '
    + 'database, where Claude reads them and turns them into roadmap items.';
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
    if (note.pending) meta.push('not sent yet');
    body.append(el('div', 'notes-item-meta', meta.join(' · ')));

    const del = el('button', 'notes-item-del', '✕');
    del.type = 'button';
    del.title = 'Delete';
    del.addEventListener('click', () => { removeNote(note.id); render(); });

    li.append(doneBtn, body, del);
    ui.list.append(li);
  }
}

/** Sincronizza in sottofondo senza mai bloccare la scrittura di una nota. */
async function trySync() {
  try {
    const { pushed } = await syncNow();
    render();
    if (pushed) flash(`Sent ${pushed} note${pushed === 1 ? '' : 's'}.`);
  } catch (err) {
    flash(`Sending failed: ${err.message}. Notes are safe in this browser.`, 'error');
  }
}

function manualCopy(text) {
  const ta = el('textarea', 'notes-fallback');
  ta.value = text;
  ui.panel.append(ta);
  ta.select();
  let copied = false;
  try { copied = document.execCommand('copy'); } catch { copied = false; }
  if (copied) ta.remove();
  else flash('Copy failed — select the text below and copy it by hand.', 'error');
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

function openPanel() {
  ui.panel.hidden = false;
  ui.toggle.classList.add('is-open');
  renderHint();
  renderContext();
  render();
  ui.textarea.focus();
  trySync();
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
  flash('Saved, sending…');
  trySync();
}

function init() {
  ui = build();

  ui.toggle.addEventListener('click', () => (ui.panel.hidden ? openPanel() : closePanel()));
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

  ui.textarea.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) {
      ev.preventDefault();
      submit();
    }
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !ui.panel.hidden) closePanel();
  });

  renderHint();
  render();
  trySync(); // note rimaste in sospeso da una visita precedente
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}

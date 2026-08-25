/**
 * notes.js — appunti, idee e segnalazioni raccolti mentre si usa il sito.
 *
 * Due modi di conservarli, e il primo funziona sempre:
 *
 *  1. `localStorage`, sempre. E' la copia di lavoro: le note non si perdono se
 *     la rete cade, se il Worker e' giu' o se la sincronizzazione non e'
 *     configurata affatto.
 *  2. Un database D1 su Cloudflare, se configurato. Serve perche' le note
 *     possano essere lette *da fuori* senza copiarle a mano — chi implementa le
 *     modifiche interroga D1 direttamente.
 *
 * D1 non e' scrivibile dal browser (l'API vuole un token d'account, che su un
 * sito pubblico sarebbe in chiaro), quindi si passa da un Worker: vedi
 * `worker/src/index.js`. Il token di scrittura si incolla una volta per browser
 * e resta in `localStorage`, non nel sorgente del sito.
 *
 * Ogni nota si porta dietro il contesto in cui e' stata scritta: una nota come
 * "questo accordo suonava sbagliato" e' inutile senza sapere quale accordo era
 * a schermo. `setContextProvider` lo fornisce.
 */

const STORAGE_KEY = 'eartraining.notes.v1';
const SYNC_KEY = 'eartraining.notes.sync.v1';

/** @typedef {{id:string, text:string, at:number, page:string, context:string|null, done:boolean, pending:boolean}} Note */

let contextProvider = null;
let state = null;
let sync = null;
let ui = null;

export function setContextProvider(fn) {
  contextProvider = fn;
}

// ---------------------------------------------------------------------------
// Persistenza locale
// ---------------------------------------------------------------------------

const blank = () => ({ version: 2, notes: [], pendingDeletes: [] });

function load() {
  if (state) return state;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && Array.isArray(parsed.notes)) {
      state = { ...blank(), ...parsed };
      state.pendingDeletes ??= [];
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
  const note = s.notes.find((n) => n.id === id);
  s.notes = s.notes.filter((n) => n.id !== id);
  // Se non era mai arrivata su D1, non c'e' niente da cancellare da remoto.
  if (note && !note.pending && !s.pendingDeletes.includes(id)) s.pendingDeletes.push(id);
  save();
}

export function toggleDone(id) {
  const note = load().notes.find((n) => n.id === id);
  if (note) { note.done = !note.done; note.pending = true; save(); }
}

export function clearAll() {
  const s = load();
  for (const n of s.notes) {
    if (!n.pending && !s.pendingDeletes.includes(n.id)) s.pendingDeletes.push(n.id);
  }
  s.notes = [];
  save();
}

// ---------------------------------------------------------------------------
// Sincronizzazione con D1 (via Worker)
// ---------------------------------------------------------------------------

function loadSync() {
  if (sync) return sync;
  try {
    sync = JSON.parse(localStorage.getItem(SYNC_KEY) ?? 'null') ?? { endpoint: '', token: '', device: '' };
  } catch {
    sync = { endpoint: '', token: '', device: '' };
  }
  return sync;
}

function saveSync(next) {
  sync = { ...loadSync(), ...next };
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify(sync));
  } catch { /* niente da fare */ }
  return sync;
}

export const syncConfigured = () => Boolean(loadSync().endpoint && loadSync().token);

async function api(path, options = {}) {
  const cfg = loadSync();
  const res = await fetch(cfg.endpoint.replace(/\/+$/, '') + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.token}`,
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 140);
    const err = new Error(`${res.status} ${detail || res.statusText}`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

const toRemote = (note) => ({
  id: note.id,
  text: note.text,
  at: note.at,
  page: note.page,
  context: note.context,
  done: note.done,
  device: loadSync().device || null,
});

const fromRemote = (row) => ({
  id: row.id,
  text: row.text,
  at: row.created_at,
  page: row.page ?? '',
  context: row.context ?? null,
  done: Boolean(row.done),
  pending: false,
});

/**
 * Spinge le modifiche locali, poi riallinea la copia locale a quella remota.
 * Le note che non sono riuscite a partire restano `pending` e non vengono perse.
 * @returns {Promise<{pushed:number, deleted:number, total:number}>}
 */
export async function syncNow() {
  if (!syncConfigured()) throw new Error('Sync is not configured.');
  const s = load();
  let pushed = 0;
  let deleted = 0;

  for (const id of [...s.pendingDeletes]) {
    try {
      await api(`/notes/${encodeURIComponent(id)}`, { method: 'DELETE' });
      deleted += 1;
    } catch (err) {
      if (err.status !== 404) throw err;   // 404 = gia' sparita, va bene cosi'
    }
    s.pendingDeletes = s.pendingDeletes.filter((x) => x !== id);
    save();
  }

  for (const note of s.notes.filter((n) => n.pending)) {
    await api('/notes', { method: 'POST', body: JSON.stringify(toRemote(note)) });
    note.pending = false;
    pushed += 1;
    save();
  }

  const remote = (await api('/notes')).notes ?? [];
  const remoteIds = new Set(remote.map((r) => r.id));
  const orphans = s.notes.filter((n) => n.pending && !remoteIds.has(n.id));
  s.notes = [...remote.map(fromRemote), ...orphans];
  save();

  return { pushed, deleted, total: s.notes.length };
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

function field(labelText, placeholder, type = 'text') {
  const wrap = el('label', 'notes-field');
  wrap.append(el('span', 'notes-field-label', labelText));
  const input = el('input', 'notes-field-input');
  input.type = type;
  input.placeholder = placeholder;
  input.autocomplete = 'off';
  wrap.append(input);
  return { wrap, input };
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

  // --- impostazioni di sincronizzazione, ripiegate ---
  const settings = el('details', 'notes-settings');
  const summary = el('summary', 'notes-settings-summary', 'Cloud sync');
  settings.append(summary);
  settings.append(el('p', 'notes-settings-hint',
    'Send notes to a Cloudflare D1 database through your Worker, so they can be '
    + 'read without copy-paste. Leave empty to keep everything in this browser.'));

  const endpoint = field('Worker URL', 'https://ear-training-notes.<you>.workers.dev');
  const token = field('Write token', 'the NOTES_TOKEN secret', 'password');
  const device = field('Device label', 'laptop, phone…');
  settings.append(endpoint.wrap, token.wrap, device.wrap);

  const settingsActions = el('div', 'notes-settings-actions');
  const saveBtn = el('button', 'btn btn-primary', 'Save');
  const syncBtn = el('button', 'btn btn-ghost', 'Sync now');
  for (const b of [saveBtn, syncBtn]) b.type = 'button';
  settingsActions.append(saveBtn, syncBtn);
  settings.append(settingsActions);
  panel.append(settings);

  const status = el('div', 'notes-status');
  status.setAttribute('role', 'status');
  panel.append(status);

  document.body.append(toggle, panel);
  return {
    toggle, badge, panel, close, textarea, addBtn, contextLine, list, hint,
    copyBtn, dlBtn, clearBtn, status, settings, endpoint, token, device, saveBtn, syncBtn,
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
  ui.hint.textContent = syncConfigured()
    ? 'Jot down anything you want changed. Notes sync to your D1 database, so '
      + 'Claude can read them directly — no copy-paste needed.'
    : 'Jot down anything you want changed. Nothing leaves your browser — use '
      + '“Copy all” and paste the result into Claude, or set up cloud sync below.';
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
    doneBtn.addEventListener('click', () => { toggleDone(note.id); render(); trySync(); });

    const body = el('div', 'notes-item-body');
    body.append(el('div', 'notes-item-text', note.text));
    const meta = [stamp(note.at), note.page];
    if (note.context) meta.push(note.context);
    if (note.pending && syncConfigured()) meta.push('not synced');
    body.append(el('div', 'notes-item-meta', meta.join(' · ')));

    const del = el('button', 'notes-item-del', '✕');
    del.type = 'button';
    del.title = 'Delete';
    del.addEventListener('click', () => { removeNote(note.id); render(); trySync(); });

    li.append(doneBtn, body, del);
    ui.list.append(li);
  }
}

/** Sincronizza in sottofondo senza mai bloccare la scrittura di una nota. */
async function trySync({ quiet = true } = {}) {
  if (!syncConfigured()) return;
  try {
    const { pushed, deleted, total } = await syncNow();
    render();
    if (!quiet || pushed || deleted) {
      flash(`Synced · ${total} note${total === 1 ? '' : 's'} in D1.`);
    }
  } catch (err) {
    flash(`Sync failed: ${err.message}. Notes are safe in this browser.`, 'error');
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
  flash(syncConfigured() ? 'Saved, syncing…' : 'Saved.');
  trySync();
}

function init() {
  ui = build();

  const cfg = loadSync();
  ui.endpoint.input.value = cfg.endpoint ?? '';
  ui.token.input.value = cfg.token ?? '';
  ui.device.input.value = cfg.device ?? '';

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
    trySync();
  });

  ui.saveBtn.addEventListener('click', () => {
    saveSync({
      endpoint: ui.endpoint.input.value.trim(),
      token: ui.token.input.value.trim(),
      device: ui.device.input.value.trim(),
    });
    renderHint();
    render();
    flash(syncConfigured() ? 'Sync settings saved.' : 'Sync turned off — notes stay in this browser.');
    trySync({ quiet: false });
  });

  ui.syncBtn.addEventListener('click', () => {
    if (!syncConfigured()) return flash('Fill in the Worker URL and token first.', 'error');
    flash('Syncing…');
    trySync({ quiet: false });
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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}

/**
 * test-parser.js — verifica del parser Harte su dati veri.
 *
 * Primo passo dell'ordine di sviluppo: prima di costruirci sopra, si guarda
 * cosa fa `parseHarte` su ogni etichetta di un `.lab` reale. La pagina mostra
 * per ogni riga il risultato del parsing, le pitch class, l'analisi funzionale
 * nella tonalita' scelta e — soprattutto — l'esito del giro
 * `parseHarte → formatHarte → parseHarte`, che e' il modo piu' rapido di
 * scoprire i casi che la notazione abbreviata non sa riesprimere.
 */

import { parseHarte, formatHarte, chordPitchClasses, functionOf, parseLab } from './harmony.js';

const $ = (s) => document.querySelector(s);
const PC = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const ORDINALS = ['root', '1st', '2nd', '3rd'];

let segments = [];

// ---------------------------------------------------------------------------
// Confronto strutturale per il giro di andata e ritorno
// ---------------------------------------------------------------------------

const sameSet = (a, b) =>
  a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');

function sameChord(a, b) {
  if (!a || !b) return a === b;
  return a.root === b.root
    && a.quality === b.quality
    && (a.seventh ?? null) === (b.seventh ?? null)
    && sameSet(a.extensions, b.extensions)
    && (a.bass ?? null) === (b.bass ?? null);
}

/**
 * @returns {{status:'ok'|'lossy'|'error', label:string, detail:string}}
 * `lossy` = riparsando si ottiene un accordo diverso. Non e' per forza un bug:
 * `C:maj7(13)` non ha un'abbreviazione Harte che significhi "13 senza 9", e
 * `maj13` sottintende anche la nona. Va comunque saputo.
 */
function roundTrip(chord) {
  try {
    const label = formatHarte(chord);
    const back = parseHarte(label);
    if (sameChord(chord, back)) return { status: 'ok', label, detail: '' };
    const before = chord.extensions.join(',') || '—';
    const after = back ? back.extensions.join(',') || '—' : '—';
    return {
      status: 'lossy',
      label,
      detail: back && back.quality !== chord.quality
        ? `quality ${chord.quality} → ${back.quality}`
        : `extensions ${before} → ${after}`,
    };
  } catch (err) {
    return { status: 'error', label: '—', detail: err.message };
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function currentKey() {
  return { tonic: Number($('#tonic').value), mode: $('#mode').value };
}

function render() {
  const key = currentKey();
  const tbody = $('#rows');
  tbody.innerHTML = '';

  const counts = { total: 0, chords: 0, silence: 0, errors: 0, lossy: 0 };

  for (const seg of segments) {
    counts.total += 1;
    const tr = document.createElement('tr');

    const isSilence = seg.raw === 'N' || seg.raw === 'X' || seg.raw === '';
    let parsed = txt('—');
    let pcs = '—';
    let fnText = '—';
    let roundTripCell = txt('—');

    if (seg.chord) {
      counts.chords += 1;
      const rt = roundTrip(seg.chord);
      if (rt.status === 'error') { counts.errors += 1; tr.className = 'row-fail'; }
      else if (rt.status === 'lossy') { counts.lossy += 1; tr.className = 'row-warn'; }

      const c = seg.chord;
      parsed = txt(`${PC[c.root]} · ${c.quality}${c.seventh ? ' · ' + c.seventh : ''}`
        + (c.extensions.length ? ` · (${c.extensions.join(',')})` : '')
        + (c.omitted.length ? ` · omits ${c.omitted.join(',')}` : '')
        + (c.bass !== null ? ` · bass ${PC[c.bass]}` : ''));

      pcs = chordPitchClasses(c).map((p) => PC[p]).join(' ');

      const fn = functionOf(c, key);
      fnText = fn.degree
        + (fn.secondary ? ` (${fn.secondary})` : '')
        + (fn.borrowed ? ' · borrowed' : '')
        + (fn.outOfKey ? ' · outside the key' : '')
        + (fn.inversion > 0 ? ` · ${ORDINALS[fn.inversion]} inversion` : '')
        + (fn.inversion === -1 ? ' · bass not in the chord' : '');

      roundTripCell = frag(el('code', null, rt.label));
      if (rt.status !== 'ok') roundTripCell.append(' ', el('span', 'badge fail', rt.detail));
    } else if (isSilence) {
      counts.silence += 1;
      parsed = el('span', 'muted', 'silence / unidentified');
    } else {
      counts.errors += 1;
      tr.className = 'row-fail';
      parsed = el('span', 'badge fail', 'not parsed');
    }

    tr.append(
      cell(el('code', null, `${seg.start.toFixed(2)}–${seg.end.toFixed(2)}`)),
      cell(el('code', null, seg.raw)),
      cell(parsed),
      cell(txt(pcs)),
      cell(txt(fnText)),
      cell(roundTripCell),
    );
    tbody.append(tr);
  }

  const summary = $('#summary');
  summary.replaceChildren(
    el('span', 'badge', `${counts.total} rows`), ' ',
    el('span', 'badge ok', `${counts.chords} chords`), ' ',
    el('span', 'badge', `${counts.silence} N/X`), ' ',
    el('span', `badge ${counts.lossy ? 'fail' : 'ok'}`, `${counts.lossy} round-trip mismatches`), ' ',
    el('span', `badge ${counts.errors ? 'fail' : 'ok'}`, `${counts.errors} errors`),
  );
}

/**
 * Le celle si costruiscono come nodi, mai come stringhe HTML: le etichette
 * arrivano da un file scelto dall'utente e `parseHarte` non valida cosa segue
 * un `*`, quindi un `.lab` costruito ad arte potrebbe iniettare markup.
 */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
const txt = (s) => document.createTextNode(s);
const frag = (...nodes) => { const f = document.createDocumentFragment(); f.append(...nodes); return f; };
const cell = (child) => { const td = document.createElement('td'); td.append(child); return td; };

// ---------------------------------------------------------------------------
// Sorgenti
// ---------------------------------------------------------------------------

async function loadSample() {
  const res = await fetch('data/songs/sample.lab');
  if (!res.ok) throw new Error(`could not read the sample file (${res.status})`);
  setText(await res.text(), 'data/songs/sample.lab');
}

function setText(text, name) {
  segments = parseLab(text);
  $('#source-name').textContent = name;
  render();
}

function init() {
  const tonic = $('#tonic');
  PC.forEach((n, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = n;
    tonic.append(o);
  });

  tonic.addEventListener('change', render);
  $('#mode').addEventListener('change', render);

  $('#file').addEventListener('change', async (ev) => {
    const file = ev.target.files?.[0];
    if (file) setText(await file.text(), file.name);
  });

  loadSample().catch((err) => {
    $('#summary').replaceChildren(el('span', 'badge fail', err.message));
    $('#source-name').textContent = 'none';
  });
}

init();

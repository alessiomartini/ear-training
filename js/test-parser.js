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
    let parsedCell = '—';
    let pcCell = '—';
    let fnCell = '—';
    let rtCell = '—';

    if (seg.chord) {
      counts.chords += 1;
      const rt = roundTrip(seg.chord);
      if (rt.status === 'error') { counts.errors += 1; tr.className = 'row-fail'; }
      else if (rt.status === 'lossy') { counts.lossy += 1; tr.className = 'row-warn'; }

      const c = seg.chord;
      parsedCell = `${PC[c.root]} · ${c.quality}${c.seventh ? ' · ' + c.seventh : ''}`
        + (c.extensions.length ? ` · (${c.extensions.join(',')})` : '')
        + (c.omitted.length ? ` · omits ${c.omitted.join(',')}` : '')
        + (c.bass !== null ? ` · bass ${PC[c.bass]}` : '');

      pcCell = chordPitchClasses(c).map((p) => PC[p]).join(' ');

      const fn = functionOf(c, key);
      fnCell = fn.degree
        + (fn.secondary ? ` (${fn.secondary})` : '')
        + (fn.borrowed ? ' · borrowed' : '')
        + (fn.outOfKey ? ' · outside the key' : '')
        + (fn.inversion > 0 ? ` · ${ORDINALS[fn.inversion]} inversion` : '')
        + (fn.inversion === -1 ? ' · bass not in the chord' : '');

      rtCell = rt.status === 'ok'
        ? `<code>${rt.label}</code>`
        : `<code>${rt.label}</code> <span class="badge fail">${rt.detail}</span>`;
    } else if (isSilence) {
      counts.silence += 1;
      parsedCell = '<span class="muted">silence / unidentified</span>';
    } else {
      counts.errors += 1;
      tr.className = 'row-fail';
      parsedCell = '<span class="badge fail">not parsed</span>';
    }

    tr.innerHTML = `
      <td><code>${seg.start.toFixed(2)}–${seg.end.toFixed(2)}</code></td>
      <td><code>${escapeHtml(seg.raw)}</code></td>
      <td>${parsedCell}</td>
      <td>${pcCell}</td>
      <td>${fnCell}</td>
      <td>${rtCell}</td>`;
    tbody.append(tr);
  }

  $('#summary').innerHTML =
    `<span class="badge">${counts.total} rows</span> `
    + `<span class="badge ok">${counts.chords} chords</span> `
    + `<span class="badge">${counts.silence} N/X</span> `
    + `<span class="badge ${counts.lossy ? 'fail' : 'ok'}">${counts.lossy} round-trip mismatches</span> `
    + `<span class="badge ${counts.errors ? 'fail' : 'ok'}">${counts.errors} errors</span>`;
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

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
    $('#summary').innerHTML = `<span class="badge fail">${escapeHtml(err.message)}</span>`;
    $('#source-name').textContent = 'none';
  });
}

init();

// Test di formatHarte: node tests/format-harte.test.mjs  (nessuna dipendenza)
import assert from 'node:assert/strict';
import { parseHarte, formatHarte, chordPitchClasses } from '../js/harmony.js';
import { LEVELS, candidatesFor } from '../js/generator.js';

let n = 0;
const fails = [];
const check = (cond, msg) => { n++; if (!cond) fails.push(msg); };
const sorted = (a) => [...a].sort().join(',');
const mk = (quality, seventh, extensions = [], omitted = [], bass = null, root = 0) =>
  ({ root, quality, seventh, extensions, omitted, bass });

// 1. Tabella verificata a mano: [chord, stringa attesa]
const TABLE = [
  [mk('maj', 'maj7', ['9', '#11']), 'C:maj9(#11)'],
  [mk('maj', 'maj7', ['9']), 'C:maj9'],
  [mk('maj', 'maj7', ['13']), 'C:maj7(13)'],
  [mk('maj', 'maj7', ['9', '13']), 'C:maj9(13)'],
  [mk('maj', 'maj7', ['9', '11', '13']), 'C:maj13'],
  [mk('maj', 'min7', ['b9', '13']), 'C:7(b9,13)'],
  [mk('maj', 'min7', ['#9']), 'C:7(#9)'],
  [mk('maj', 'min7', ['9', 'b13']), 'C:9(b13)'],
  [mk('maj', 'min7', ['9', '13']), 'C:9(13)'],
  [mk('maj', 'min7', ['9', '#11']), 'C:9(#11)'],
  [mk('maj', 'min7', ['b5', 'b9']), 'C:7(b5,b9)'],
  [mk('maj', 'min7', ['#5', '#9']), 'C:7(#5,#9)'],
  [mk('min', 'min7', ['9', '11']), 'C:min11'],
  [mk('min', 'min7', ['9', '13']), 'C:min9(13)'],
  [mk('min', 'maj7', ['9']), 'C:minmaj7(9)'],
  [mk('hdim', 'min7', ['9', '11']), 'C:hdim7(9,11)'],
  [mk('dim', 'min7'), 'C:dim(b7)'],
  [mk('dim', 'dim7'), 'C:dim7'],
  [mk('aug', 'min7'), 'C:aug(b7)'],
  [mk('aug', 'maj7'), 'C:aug(7)'],
  [mk('sus4', 'min7', ['9']), 'C:sus4(b7,9)'],
  [mk('sus2', null), 'C:sus2'],
  [mk('maj', null, ['9']), 'C:maj(9)'],
  [mk('maj', null, ['6', '9']), 'C:maj6(9)'],
  [mk('maj', 'maj7', [], ['5']), 'C:maj7(*5)'],
  [mk('maj', 'min7', ['9'], ['3']), 'C:9(*3)'],
  [mk('min', 'min7', [], [], 9, 2), 'D:min7/5'],
  [mk('maj', null, [], [], 7, 3), 'Eb:maj/3'],
];
for (const [c, want] of TABLE) {
  const got = formatHarte(c);
  check(got === want, `tabella: atteso ${want}, ottenuto ${got}`);
}
check(formatHarte(null) === 'N', 'null → N');
check(formatHarte(mk('maj', 'min7', [], [], null, 1), { flats: false }) === 'C#:7', 'diesis');

// 2. Spazio esaustivo: ogni combinazione qualita' x settima x tensioni x omissioni x basso
const QUALITIES = ['maj', 'min', 'dim', 'aug', 'hdim', 'sus2', 'sus4'];
const SEVENTHS = [null, 'maj7', 'min7', 'dim7'];
const POOL = ['6', 'b9', '9', '#9', '11', '#11', 'b13', '13', 'b5', '#5'];
const OMITS = [[], ['3'], ['5'], ['3', '5']];
const BASSES = [null, 4, 7]; // intervalli dalla fondamentale (semitoni)
let space = 0;
for (const quality of QUALITIES) for (const seventh of SEVENTHS)
  for (let mask = 0; mask < 1 << POOL.length; mask++) {
    const extensions = POOL.filter((_, i) => mask & (1 << i));
    for (const omitted of OMITS) for (const bass of BASSES) {
      space++;
      const c = mk(quality, seventh, extensions, omitted, bass);
      let label;
      try { label = formatHarte(c); } catch (e) { check(false, `eccezione ${e.message}`); continue; }
      let back;
      try { back = parseHarte(label); } catch (e) { check(false, `non parsabile: ${label} (${e.message})`); continue; }
      // Le stesse note: lo shorthand non deve aggiungere ne' togliere nulla.
      check(sorted(chordPitchClasses(back)) === sorted(chordPitchClasses(c)),
        `note diverse: ${JSON.stringify(c)} → ${label}`);
      // Struttura identica (hdim e' canonico solo con settima min7 / senza settima)
      const canonical = quality !== 'hdim' || seventh === 'min7';
      if (canonical && !(quality === 'hdim' && !seventh)
          && !((quality === 'maj' || quality === 'min') && seventh === 'dim7')) {
        const same = back.quality === c.quality && back.seventh === c.seventh
          && sorted(back.extensions.map((e) => e)) === sorted(c.extensions)
          && sorted(back.omitted) === sorted(c.omitted) && back.bass === (c.bass === null ? null : c.bass);
        // 6 + maj/min senza settima diventa maj6/min6: la stessa lista di tensioni
        if (!same) check(false, `struttura diversa: ${JSON.stringify(c)} → ${label} → ${JSON.stringify(back)}`);
        else check(true, '');
      }
      // Sintassi Harte: root:shorthand(gradi)/basso
      check(/^[A-G][b#]?:[a-z0-9]+(\([^()]*\))?(\/[b#]?\d+)?$/.test(label), `sintassi: ${label}`);
    }
  }

// 3. Tutti gli accordi che il generatore sa produrre
let gen = 0;
for (const level of LEVELS) for (const mode of ['major', 'minor']) {
  for (const tonic of [0, 3, 6, 9]) {
    let cands;
    try { cands = candidatesFor(level, { tonic, mode }); } catch { continue; }
    for (const cand of cands) {
      const chord = cand.chord ?? cand;
      if (!chord || chord.quality === undefined) continue;
      gen++;
      const label = formatHarte(chord);
      const back = parseHarte(label);
      check(back.quality === chord.quality && back.seventh === chord.seventh
        && sorted(back.extensions) === sorted(chord.extensions)
        && back.root === chord.root && (back.bass ?? null) === (chord.bass ?? null),
        `generatore: ${label} non fa il giro`);
    }
  }
}

console.log(`controlli: ${n}, spazio esaustivo: ${space}, accordi dal generatore: ${gen}`);
if (fails.length) {
  console.error(`FALLITI ${fails.length}:`);
  for (const f of fails.slice(0, 25)) console.error('  ' + f);
  process.exit(1);
}
console.log('OK');

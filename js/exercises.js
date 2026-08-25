/**
 * exercises.js — i tipi di esercizio del sito.
 *
 * Fino a ieri ce n'era uno solo (la funzione armonica dentro una tonalita') e
 * viveva sparso fra `generator.js` e `practice.js`. Aggiungerne sei copiando
 * quella struttura sei volte sarebbe stato insostenibile, quindi ognuno adesso
 * dichiara la stessa cosa:
 *
 *   variants   le varianti di difficolta' (i "livelli")
 *   needsKey   se prima va stabilita una tonalita'
 *   generate   → un item, con dentro il suono da produrre e la risposta attesa
 *   grade      → esito campo per campo, piu' le chiavi per la ripetizione spaziata
 *
 * `generate` non suona niente: restituisce un **descrittore** del suono
 * (`{kind, ...}`) che il controller traduce in chiamate a `audio.js`. Cosi'
 * tutta la logica musicale si prova in Node, senza browser e senza Tone.
 */

import { functionOf, itemKeyFor, formatHarte, voice } from './harmony.js';
import { LEVELS, levelById, generateExercise } from './generator.js';
import { weightOfKeys, pickWeighted } from './srs.js';
import { renderPhrase, phrasesFor } from './phrases.js';

const NOTE_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
const randomKey = (modes, rng) => ({ tonic: Math.floor(rng() * 12), mode: pick(modes, rng) });

/** Sceglie fra i candidati pesando con la ripetizione spaziata. */
function weighted(candidates, keysOf, rng) {
  return pickWeighted(candidates, (c) => weightOfKeys(keysOf(c)), rng);
}

const chordOf = (root, quality, seventh = null, extensions = []) => ({
  root: ((root % 12) + 12) % 12, quality, seventh, extensions, omitted: [], bass: null,
});

// ---------------------------------------------------------------------------
// 1. Triadi isolate
// ---------------------------------------------------------------------------

const TRIAD_QUALITIES = [
  ['maj', 'major'], ['min', 'minor'], ['dim', 'diminished'], ['aug', 'augmented'],
];

const triads = {
  id: 'triads',
  label: 'Triads',
  needsKey: false,
  variants: [
    { id: 'block', label: 'Played together', help: 'The three notes at once. Name the quality: major, minor, diminished, augmented.' },
    { id: 'arpeggio', label: 'Arpeggiated', help: 'The three notes one after another, then together.' },
  ],
  fields: () => [{ id: 'quality', label: 'Quality', options: TRIAD_QUALITIES }],

  generate({ variant, rng }) {
    const quality = weighted(TRIAD_QUALITIES.map(([q]) => q), (q) => [`triad:${q}`], rng);
    const root = Math.floor(rng() * 12);
    const chord = chordOf(root, quality);
    const notes = voice(chord, { center: 55 + Math.floor(rng() * 10), spread: 13 });
    return {
      chord,
      answer: { quality },
      itemKeys: [`triad:${quality}`],
      sound: { kind: 'chord', notes, arpeggio: variant === 'arpeggio' },
    };
  },

  grade(answer, item) {
    const ok = answer.quality === item.answer.quality;
    return {
      results: { quality: ok },
      correct: { quality: label(TRIAD_QUALITIES, item.answer.quality) },
      keys: { quality: item.itemKeys[0] },
      explain: {
        title: `${NOTE_NAMES[item.chord.root]} ${label(TRIAD_QUALITIES, item.answer.quality)}`,
        code: formatHarte(item.chord),
      },
    };
  },
};

// ---------------------------------------------------------------------------
// 2. Quadriadi
// ---------------------------------------------------------------------------

/**
 * Tutte le combinazioni che si usano davvero. Il diminuito con settima maggiore
 * e' escluso di proposito: esiste sulla carta e non si incontra mai, quindi
 * allenarlo sarebbe tempo speso su un suono che non serve riconoscere.
 */
const QUADRIADS = [
  { triad: 'maj',  seventh: 'maj7', name: 'major seventh' },
  { triad: 'maj',  seventh: 'min7', name: 'dominant seventh' },
  { triad: 'min',  seventh: 'min7', name: 'minor seventh' },
  { triad: 'min',  seventh: 'maj7', name: 'minor–major seventh' },
  { triad: 'dim',  seventh: 'min7', name: 'half-diminished' },
  { triad: 'dim',  seventh: 'dim7', name: 'diminished seventh' },
];

const QUAD_TRIADS = [['maj', 'major'], ['min', 'minor'], ['dim', 'diminished']];
const QUAD_SEVENTHS = [['maj7', 'major'], ['min7', 'minor'], ['dim7', 'diminished']];

const quadriads = {
  id: 'quadriads',
  label: 'Seventh chords',
  needsKey: false,
  variants: [
    { id: 'common', label: 'The four common ones', help: 'maj7, dominant 7, min7, half-diminished — the ones you meet constantly.' },
    { id: 'all', label: 'All six', help: 'Adds the minor–major seventh and the fully diminished. Diminished with a major seventh is left out: it exists on paper and never in music.' },
  ],
  // Due campi separati, non uno solo: sbagliare la settima indovinando la
  // triade e' mezzo successo, e la ripetizione spaziata deve saperlo.
  fields: () => [
    { id: 'triad', label: 'Triad', options: QUAD_TRIADS },
    { id: 'seventh', label: 'Seventh', options: QUAD_SEVENTHS },
  ],

  generate({ variant, rng }) {
    const pool = variant === 'common'
      ? QUADRIADS.filter((q) => q.name !== 'minor–major seventh' && q.name !== 'diminished seventh')
      : QUADRIADS;
    const q = weighted(pool, (c) => [`quad-triad:${c.triad}`, `quad-7th:${c.seventh}`], rng);
    const root = Math.floor(rng() * 12);
    // Il semidiminuito e' `hdim` per harmony.js, ma all'orecchio resta
    // "triade diminuita con settima minore": e' quello che si chiede.
    const chord = chordOf(root, q.triad === 'dim' && q.seventh === 'min7' ? 'hdim' : q.triad, q.seventh);
    const notes = voice(chord, { center: 55 + Math.floor(rng() * 10), spread: 14 });
    return {
      chord,
      name: q.name,
      answer: { triad: q.triad, seventh: q.seventh },
      itemKeys: [`quad-triad:${q.triad}`, `quad-7th:${q.seventh}`],
      sound: { kind: 'chord', notes, arpeggio: false },
    };
  },

  grade(answer, item) {
    const results = {
      triad: answer.triad === item.answer.triad,
      seventh: answer.seventh === item.answer.seventh,
    };
    return {
      results,
      correct: {
        triad: label(QUAD_TRIADS, item.answer.triad),
        seventh: label(QUAD_SEVENTHS, item.answer.seventh),
      },
      keys: { triad: item.itemKeys[0], seventh: item.itemKeys[1] },
      explain: {
        title: `${NOTE_NAMES[item.chord.root]} ${item.name}`,
        code: formatHarte(item.chord),
      },
    };
  },
};

// ---------------------------------------------------------------------------
// 3. Intervalli
// ---------------------------------------------------------------------------

const INTERVALS = [
  [0, 'unison'], [1, 'minor 2nd'], [2, 'major 2nd'], [3, 'minor 3rd'], [4, 'major 3rd'],
  [5, 'perfect 4th'], [6, 'tritone'], [7, 'perfect 5th'], [8, 'minor 6th'],
  [9, 'major 6th'], [10, 'minor 7th'], [11, 'major 7th'], [12, 'octave'],
];
const INTERVAL_OPTIONS = INTERVALS.map(([s, n]) => [String(s), n]);

const intervals = {
  id: 'intervals',
  label: 'Intervals',
  needsKey: false,
  variants: [
    { id: 'harmonic', label: 'Together', help: 'Both notes at once. The hardest of the three, and the one that transfers to hearing chords.' },
    { id: 'up', label: 'Low note first', help: 'Ascending: the lower note, then the upper one.' },
    { id: 'down', label: 'High note first', help: 'Descending: the upper note, then the lower one.' },
    { id: 'mixed', label: 'Mixed', help: 'One of the three presentations at random, so you cannot lean on the direction.' },
  ],
  fields: () => [{ id: 'interval', label: 'Interval', options: INTERVAL_OPTIONS }],

  generate({ variant, rng }) {
    const semis = Number(weighted(INTERVALS.map(([s]) => s), (s) => [`interval:${s}`], rng));
    const low = 52 + Math.floor(rng() * 13);
    const mode = variant === 'mixed' ? pick(['harmonic', 'up', 'down'], rng) : variant;
    return {
      semis,
      mode,
      answer: { interval: String(semis) },
      itemKeys: [`interval:${semis}`],
      sound: { kind: 'interval', notes: [low, low + semis], mode },
    };
  },

  grade(answer, item) {
    const ok = answer.interval === item.answer.interval;
    const how = { harmonic: 'played together', up: 'low note first', down: 'high note first' }[item.mode];
    return {
      results: { interval: ok },
      correct: { interval: label(INTERVAL_OPTIONS, item.answer.interval) },
      keys: { interval: item.itemKeys[0] },
      explain: {
        title: `${label(INTERVAL_OPTIONS, item.answer.interval)} — ${item.semis} semitone${item.semis === 1 ? '' : 's'}`,
        notes: how,
      },
    };
  },
};

// ---------------------------------------------------------------------------
// 4. Gradi superiori
// ---------------------------------------------------------------------------

const UPPER = [
  [10, '♭7'], [11, '7'], [14, '9'], [17, '11'], [21, '13'],
  [13, '♭9'], [15, '♯9'], [18, '♯11'], [20, '♭13'],
];
const UPPER_BASIC = UPPER.slice(0, 5);
const UPPER_OPTIONS = (pool) => pool.map(([s, n]) => [String(s), n]);

const upperDegrees = {
  id: 'upper-degrees',
  label: 'Upper degrees',
  needsKey: false,
  variants: [
    { id: 'basic', label: 'Sevenths to thirteenths', help: 'The root, then one note above it: ♭7, 7, 9, 11 or 13.' },
    { id: 'altered', label: 'With alterations', help: 'Adds ♭9, ♯9, ♯11 and ♭13 — the tensions that colour a dominant.' },
  ],
  fields: ({ variant }) => [{
    id: 'degree',
    label: 'Degree above the root',
    options: UPPER_OPTIONS(variant === 'basic' ? UPPER_BASIC : UPPER),
  }],

  generate({ variant, rng }) {
    const pool = variant === 'basic' ? UPPER_BASIC : UPPER;
    const semis = Number(weighted(pool.map(([s]) => s), (s) => [`upper:${s}`], rng));
    const root = 40 + Math.floor(rng() * 10);
    return {
      semis,
      root,
      answer: { degree: String(semis) },
      itemKeys: [`upper:${semis}`],
      // Radice sostenuta sotto, poi il grado sopra: senza la radice in memoria
      // non c'e' nessun grado da riconoscere, solo una nota isolata.
      sound: { kind: 'interval', notes: [root, root + semis], mode: 'root-then-note' },
    };
  },

  grade(answer, item) {
    const ok = answer.degree === item.answer.degree;
    return {
      results: { degree: ok },
      correct: { degree: label(UPPER_OPTIONS(UPPER), item.answer.degree) },
      keys: { degree: item.itemKeys[0] },
      explain: {
        title: `${label(UPPER_OPTIONS(UPPER), item.answer.degree)} above the root`,
        notes: `${item.semis} semitones — ${NOTE_NAMES[item.root % 12]} to ${NOTE_NAMES[(item.root + item.semis) % 12]}`,
      },
    };
  },
};

// ---------------------------------------------------------------------------
// 5. Metro
// ---------------------------------------------------------------------------

const METERS = [
  { id: '2/4',  label: '2/4',  beats: 2, sub: 2, family: 'simple' },
  { id: '3/4',  label: '3/4',  beats: 3, sub: 2, family: 'simple' },
  { id: '4/4',  label: '4/4',  beats: 4, sub: 2, family: 'simple' },
  { id: '6/8',  label: '6/8',  beats: 2, sub: 3, family: 'compound' },
  { id: '9/8',  label: '9/8',  beats: 3, sub: 3, family: 'compound' },
  { id: '12/8', label: '12/8', beats: 4, sub: 3, family: 'compound' },
  { id: '5/4',  label: '5/4',  beats: 5, sub: 2, family: 'odd' },
  { id: '7/4',  label: '7/4',  beats: 7, sub: 2, family: 'odd' },
];

const meterPool = (variant) => ({
  basic: METERS.filter((m) => ['3/4', '4/4'].includes(m.id)),
  compound: METERS.filter((m) => m.family !== 'odd'),
  odd: METERS,
}[variant]);

const meter = {
  id: 'meter',
  label: 'Metre',
  needsKey: false,
  variants: [
    { id: 'basic', label: '3/4 or 4/4', help: 'Count to the strong beat: does it come round every three or every four?' },
    { id: 'compound', label: 'Simple and compound', help: 'Adds 2/4, 6/8, 9/8, 12/8. The question becomes whether each beat splits in two or in three.' },
    { id: 'odd', label: 'With odd metres', help: 'Adds 5/4 and 7/4.' },
  ],
  fields: ({ variant }) => [{
    id: 'meter',
    label: 'Metre',
    options: meterPool(variant).map((m) => [m.id, m.label]),
  }],

  generate({ variant, rng }) {
    const pool = meterPool(variant);
    const m = weighted(pool, (x) => [`meter:${x.id}`], rng);
    const key = randomKey(['major', 'minor'], rng);
    return {
      meter: m,
      answer: { meter: m.id },
      itemKeys: [`meter:${m.id}`],
      sound: {
        kind: 'groove',
        beatsPerBar: m.beats,
        subdivision: m.sub,
        tempo: (m.sub === 3 ? 62 : 92) + Math.floor(rng() * 22),
        bars: 4,
        key,
      },
    };
  },

  grade(answer, item) {
    const ok = answer.meter === item.answer.meter;
    const m = item.meter;
    return {
      results: { meter: ok },
      correct: { meter: m.label },
      keys: { meter: item.itemKeys[0] },
      explain: {
        title: `${m.label} — ${m.family === 'compound' ? 'compound' : m.family === 'odd' ? 'odd' : 'simple'}`,
        notes: `${m.beats} beat${m.beats === 1 ? '' : 's'} per bar, each split in ${m.sub}`,
      },
    };
  },
};

// ---------------------------------------------------------------------------
// 6. Modulazioni
// ---------------------------------------------------------------------------

/**
 * Ogni relazione e' identificata dalla coppia (semitoni di spostamento, cambio
 * di modo), e le coppie qui sotto sono tutte distinte: una modulazione generata
 * non puo' mai corrispondere a due etichette diverse.
 */
const MODULATIONS = [
  { id: 'up-semitone',  label: 'Up a semitone',  delta: 1,  switchMode: false, common: true },
  { id: 'up-tone',      label: 'Up a tone',      delta: 2,  switchMode: false, common: true },
  { id: 'down-semitone', label: 'Down a semitone', delta: 11, switchMode: false, common: false },
  { id: 'down-tone',    label: 'Down a tone',    delta: 10, switchMode: false, common: false },
  { id: 'dominant',     label: 'To the dominant', delta: 7, switchMode: false, common: true },
  { id: 'subdominant',  label: 'To the subdominant', delta: 5, switchMode: false, common: false },
  { id: 'relative',     label: 'To the relative key', delta: null, switchMode: true, common: true },
  { id: 'parallel',     label: 'To the parallel key', delta: 0, switchMode: true, common: false },
];

const modulation = {
  id: 'modulation',
  label: 'Modulation',
  needsKey: false,   // se le suona da se': prima la tonalita' di partenza, poi quella d'arrivo
  variants: [
    { id: 'common', label: 'The usual ones', help: 'Relative key, up a semitone, up a tone, to the dominant — what actually happens in songs.' },
    { id: 'all', label: 'All of them', help: 'Adds downward moves, the subdominant and the parallel key.' },
  ],
  fields: ({ variant }) => [{
    id: 'move',
    label: 'Where does it go',
    options: MODULATIONS.filter((m) => variant === 'all' || m.common).map((m) => [m.id, m.label]),
  }],

  generate({ variant, rng }) {
    const pool = MODULATIONS.filter((m) => variant === 'all' || m.common);
    const move = weighted(pool, (m) => [`mod:${m.id}`], rng);

    const from = randomKey(['major', 'minor'], rng);
    let to;
    if (move.id === 'relative') {
      to = from.mode === 'major'
        ? { tonic: (from.tonic + 9) % 12, mode: 'minor' }
        : { tonic: (from.tonic + 3) % 12, mode: 'major' };
    } else if (move.switchMode) {
      to = { tonic: from.tonic, mode: from.mode === 'major' ? 'minor' : 'major' };
    } else {
      to = { tonic: (from.tonic + move.delta) % 12, mode: from.mode };
    }

    const a = renderPhrase(pick(phrasesFor(from.mode), rng), from);
    const b = renderPhrase(pick(phrasesFor(to.mode), rng), to);
    const gap = 0.35;

    return {
      from, to, move,
      answer: { move: move.id },
      itemKeys: [`mod:${move.id}`],
      sound: {
        kind: 'sequence',
        events: [
          ...a.events,
          ...b.events.map((e) => ({ ...e, at: e.at + a.duration + gap })),
        ],
      },
    };
  },

  grade(answer, item) {
    const ok = answer.move === item.answer.move;
    const name = (k) => `${NOTE_NAMES[k.tonic]} ${k.mode}`;
    return {
      results: { move: ok },
      correct: { move: item.move.label },
      keys: { move: item.itemKeys[0] },
      explain: {
        title: `${name(item.from)} → ${name(item.to)}`,
        notes: item.move.label.toLowerCase(),
      },
    };
  },
};

// ---------------------------------------------------------------------------
// 7. Funzione armonica — l'esercizio originale, dietro la stessa interfaccia
// ---------------------------------------------------------------------------

const CHORD_FIELD_OPTIONS = {
  degree: [
    ['I', 'I'], ['bII', '♭II'], ['II', 'II'], ['bIII', '♭III'], ['III', 'III'], ['IV', 'IV'],
    ['#IV', '♯IV'], ['V', 'V'], ['bVI', '♭VI'], ['VI', 'VI'], ['bVII', '♭VII'], ['VII', 'VII'],
  ],
  quality: [
    ['maj', 'major'], ['min', 'minor'], ['dim', 'diminished'], ['aug', 'augmented'],
    ['hdim', 'half-diminished'], ['sus2', 'sus2'], ['sus4', 'sus4'],
  ],
  seventh: [['', 'none'], ['maj7', 'major'], ['min7', 'minor'], ['dim7', 'diminished']],
  extensions: [['9', '9'], ['11', '11'], ['#11', '♯11'], ['13', '13']],
  outOfKey: [['false', 'diatonic or borrowed'], ['true', 'outside the key']],
  inversion: [['0', 'root position'], ['1', '1st inversion'], ['2', '2nd inversion'], ['3', '3rd inversion']],
};
const CHORD_FIELD_LABELS = {
  degree: 'Degree', quality: 'Quality', seventh: 'Seventh',
  extensions: 'Extensions', outOfKey: 'Relation to the key', inversion: 'Inversion',
};
const QUALITY_NAMES = Object.fromEntries(CHORD_FIELD_OPTIONS.quality);
const SEVENTH_NAMES = { maj7: 'major seventh', min7: 'minor seventh', dim7: 'diminished seventh' };

const harmonicFunction = {
  id: 'function',
  label: 'Harmonic function',
  needsKey: true,
  variants: LEVELS.map((l) => ({ id: String(l.id), label: l.label, help: l.help })),

  fields: ({ variant }) => levelById(variant).fields.map((f) => ({
    id: f,
    label: CHORD_FIELD_LABELS[f],
    options: CHORD_FIELD_OPTIONS[f],
    multi: f === 'extensions',
  })),

  generate({ variant, modes, avoid, rng }) {
    const ex = generateExercise({ level: levelById(variant), modes, avoid, rng });
    return {
      key: ex.key,
      target: ex.target,
      fn: ex.fn,
      fields: ex.fields,
      signature: ex.signature,
      itemKeys: ex.itemKeys,
      sound: { kind: 'chord', notes: ex.audio.voicing, arpeggio: false },
    };
  },

  grade(answer, item) {
    const fn = functionOf(item.target, item.key);
    const c = item.target;
    const results = {};
    const correct = {};
    for (const f of item.fields) {
      switch (f) {
        case 'degree':
          results.degree = norm(answer.degree) === norm(fn.degree);
          correct.degree = fn.degree;
          break;
        case 'quality':
          results.quality = answer.quality === c.quality;
          correct.quality = QUALITY_NAMES[c.quality] ?? c.quality;
          break;
        case 'seventh':
          results.seventh = (answer.seventh || null) === (c.seventh ?? null);
          correct.seventh = c.seventh ? SEVENTH_NAMES[c.seventh] : 'none';
          break;
        case 'extensions': {
          const a = new Set(answer.extensions ?? []);
          const b = new Set(c.extensions ?? []);
          results.extensions = a.size === b.size && [...a].every((x) => b.has(x));
          correct.extensions = c.extensions.length ? c.extensions.join(', ') : 'none';
          break;
        }
        case 'inversion':
          results.inversion = Number(answer.inversion ?? 0) === fn.inversion;
          correct.inversion = CHORD_FIELD_OPTIONS.inversion[fn.inversion]?.[1] ?? 'bass not in the chord';
          break;
        case 'outOfKey':
          results.outOfKey = (answer.outOfKey === 'true') === fn.outOfKey;
          correct.outOfKey = fn.outOfKey ? 'outside the key' : 'diatonic or borrowed';
          break;
      }
    }

    const notes = [];
    if (fn.secondary) notes.push(`secondary dominant: ${fn.secondary}`);
    if (fn.borrowed) notes.push(`borrowed from the parallel ${fn.borrowed === 'parallel-minor' ? 'minor' : 'major'}`);
    if (fn.diatonic) notes.push('diatonic');
    else if (fn.outOfKey) notes.push('outside the key');

    return {
      results,
      correct,
      keys: Object.fromEntries(item.fields.map((f) => [f, itemKeyFor(f, c, fn)])),
      explain: { title: describeChord(c), code: formatHarte(c), notes: notes.join(' · ') },
    };
  },
};

const norm = (s) => String(s ?? '').replace(/[°ø+]/g, '').toLowerCase();

export function describeChord(chord) {
  if (!chord) return 'no chord';
  const parts = [`${NOTE_NAMES[chord.root]} ${QUALITY_NAMES[chord.quality] ?? chord.quality}`];
  if (chord.seventh) parts.push(SEVENTH_NAMES[chord.seventh]);
  if (chord.extensions.length) parts.push(`with ${chord.extensions.join(', ')}`);
  if (chord.bass !== null && chord.bass !== undefined) parts.push(`${NOTE_NAMES[chord.bass]} in the bass`);
  return parts.join(', ');
}

function label(options, value) {
  return options.find(([v]) => v === value)?.[1] ?? String(value);
}

// ---------------------------------------------------------------------------

export const EXERCISES = [
  harmonicFunction, triads, quadriads, intervals, upperDegrees, meter, modulation,
];

export const exerciseById = (id) => EXERCISES.find((e) => e.id === id) ?? EXERCISES[0];

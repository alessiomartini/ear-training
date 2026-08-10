/**
 * generator.js — costruzione degli esercizi della pagina Practice.
 *
 * Per ogni esercizio: si sorteggia una tonalita', si costruisce il *pool* di
 * accordi ammessi dal livello in quella tonalita', si pesa ogni candidato con
 * la ripetizione spaziata e si campiona. Tonalita' e voicing cambiano ogni
 * volta: e' l'unico modo perche' si impari la funzione e non il timbro.
 *
 * Le tabelle qui sotto sono deliberatamente separate da quelle di `harmony.js`:
 * la' descrivono come si *analizza* un accordo, qui cosa si *genera* — e la
 * generazione ha bisogno di dati che l'analisi non usa (qualita' della settima
 * grado per grado, scale di tensioni ammesse).
 */

import { functionOf, itemKeyFor, voice } from './harmony.js';
import { weightOfKeys, pickWeighted } from './srs.js';

// ---------------------------------------------------------------------------
// Livelli
// ---------------------------------------------------------------------------

export const LEVELS = [
  {
    id: 1,
    label: 'Triadi diatoniche',
    fields: ['degree', 'quality'],
    help: 'Le sette triadi della tonalita’. Riconosci il grado e se e’ maggiore, minore o diminuita.',
  },
  {
    id: 2,
    label: 'Settime diatoniche',
    fields: ['degree', 'quality', 'seventh'],
    help: 'Le stesse funzioni con la settima: maggiore, minore, di dominante, semidiminuita.',
  },
  {
    id: 3,
    label: 'None, undicesime, tredicesime',
    fields: ['degree', 'quality', 'seventh', 'extensions'],
    help: 'Tensioni sopra la settima. Una o due per accordo, mai la lista completa.',
  },
  {
    id: 4,
    label: 'Prestiti modali e dominanti secondarie',
    fields: ['degree', 'quality', 'seventh', 'extensions', 'outOfKey'],
    help: 'Accordi che escono dalla scala: prestiti dal modo parallelo, V/x, vii°/x.',
  },
  {
    id: 5,
    label: 'Rivolti e voicing sparsi',
    fields: ['degree', 'quality', 'seventh', 'extensions', 'outOfKey', 'inversion'],
    help: 'Lo stesso materiale con il basso sul terzo, quinto o settimo grado, e le voci distribuite.',
  },
];

export const levelById = (id) => LEVELS.find((l) => l.id === Number(id)) ?? LEVELS[0];

// ---------------------------------------------------------------------------
// Materiale armonico
// ---------------------------------------------------------------------------

/**
 * Gradi diatonici: la triade e l'accordo di settima possono avere qualita'
 * diverse (in maggiore il VII e' `dim` come triade e `hdim7` come settima).
 */
const SCALE = {
  major: [
    { offset: 0,  triad: 'maj',  quality: 'maj',  seventh: 'maj7' },
    { offset: 2,  triad: 'min',  quality: 'min',  seventh: 'min7' },
    { offset: 4,  triad: 'min',  quality: 'min',  seventh: 'min7' },
    { offset: 5,  triad: 'maj',  quality: 'maj',  seventh: 'maj7' },
    { offset: 7,  triad: 'maj',  quality: 'maj',  seventh: 'min7' },
    { offset: 9,  triad: 'min',  quality: 'min',  seventh: 'min7' },
    { offset: 11, triad: 'dim',  quality: 'hdim', seventh: 'min7' },
  ],
  minor: [
    { offset: 0,  triad: 'min',  quality: 'min',  seventh: 'min7' },
    { offset: 2,  triad: 'dim',  quality: 'hdim', seventh: 'min7' },
    { offset: 3,  triad: 'maj',  quality: 'maj',  seventh: 'maj7' },
    { offset: 5,  triad: 'min',  quality: 'min',  seventh: 'min7' },
    { offset: 7,  triad: 'min',  quality: 'min',  seventh: 'min7' },
    { offset: 8,  triad: 'maj',  quality: 'maj',  seventh: 'maj7' },
    { offset: 10, triad: 'maj',  quality: 'maj',  seventh: 'min7' },
  ],
};

/**
 * Prestiti dal modo parallelo. Deve coincidere con la tabella `BORROWED` di
 * `harmony.js`, altrimenti `functionOf` non li riconoscerebbe come prestiti e
 * il livello 4 chiederebbe una risposta che il correttore considera sbagliata.
 */
const BORROWED = {
  major: [
    { offset: 3,  quality: 'maj' },
    { offset: 8,  quality: 'maj' },
    { offset: 10, quality: 'maj' },
    { offset: 5,  quality: 'min' },
    { offset: 0,  quality: 'min' },
    { offset: 2,  quality: 'dim' },
  ],
  minor: [
    { offset: 4,  quality: 'maj' },
    { offset: 9,  quality: 'maj' },
    { offset: 11, quality: 'dim' },
    { offset: 5,  quality: 'maj' },
  ],
};

/** Settima usata quando un prestito viene proposto come quadriade. */
const BORROWED_SEVENTH = { maj: 'maj7', min: 'min7', dim: 'dim7' };

/**
 * Tensioni ammesse, per tipo di accordo. Sono "scale": si prende un prefisso,
 * cosi' la nona c'e' sempre quando c'e' l'undicesima o la tredicesima — che e'
 * la convenzione reale e in piu' evita che `formatHarte` debba esprimere un
 * "13 senza 9", cosa che la notazione Harte abbreviata non sa fare.
 * L'11 naturale e' esclusa dagli accordi maggiori e di dominante: e' una nota
 * da evitare, e proporla come bersaglio d'ascolto non insegna niente di utile.
 */
const EXTENSION_LADDERS = {
  'maj:maj7':  [['9'], ['9', '#11'], ['9', '13']],
  'min:min7':  [['9'], ['9', '11'], ['9', '13']],
  'maj:min7':  [['9'], ['9', '13']],
  'hdim:min7': [['9'], ['9', '11']],
};

/** Semitoni della triade, per costruire i rivolti senza reimportare le tabelle interne. */
const TRIAD_SEMITONES = {
  maj: [4, 7], min: [3, 7], dim: [3, 6], aug: [4, 8],
  hdim: [3, 6], sus2: [2, 7], sus4: [5, 7],
};
const SEVENTH_SEMITONES = { maj7: 11, min7: 10, dim7: 9 };

// ---------------------------------------------------------------------------
// Costruzione dei candidati
// ---------------------------------------------------------------------------

const chord = (root, quality, seventh, extensions = [], bass = null) => ({
  root: ((root % 12) + 12) % 12,
  quality,
  seventh,
  extensions,
  omitted: [],
  bass,
});

/** Accordi diatonici, come triadi (livello 1) o come settime (livelli 2+). */
function diatonicCandidates(key, { sevenths }) {
  return SCALE[key.mode].map((d) =>
    sevenths
      ? chord(key.tonic + d.offset, d.quality, d.seventh)
      : chord(key.tonic + d.offset, d.triad, null));
}

/** Diatonici di settima, ciascuno con le sue possibili tensioni (inclusa "nessuna"). */
function extendedCandidates(key) {
  const out = [];
  for (const d of SCALE[key.mode]) {
    const ladders = EXTENSION_LADDERS[`${d.quality}:${d.seventh}`] ?? [];
    out.push(chord(key.tonic + d.offset, d.quality, d.seventh));
    for (const ext of ladders) out.push(chord(key.tonic + d.offset, d.quality, d.seventh, [...ext]));
  }
  return out;
}

/** Prestiti modali, in triade e in quadriade. */
function borrowedCandidates(key) {
  const out = [];
  for (const b of BORROWED[key.mode]) {
    out.push(chord(key.tonic + b.offset, b.quality, null));
    out.push(chord(key.tonic + b.offset, b.quality, BORROWED_SEVENTH[b.quality]));
  }
  return out;
}

/**
 * Dominanti secondarie (V/x) e settime diminuite di passaggio (vii°/x).
 * Si tiene solo cio' che `functionOf` riconosce davvero come secondario: e'
 * l'analizzatore a definire la risposta giusta, quindi e' lui a decidere quali
 * accordi ha senso proporre.
 */
function secondaryCandidates(key) {
  const out = [];
  for (const d of SCALE[key.mode]) {
    if (d.offset === 0) continue;                 // niente V/I: e' la dominante primaria
    if (d.quality === 'hdim') continue;           // V di un semidiminuito non e' un obiettivo reale

    const dominant = chord(key.tonic + d.offset + 7, 'maj', 'min7');
    if (functionOf(dominant, key).secondary) out.push(dominant);

    const leading = chord(key.tonic + d.offset - 1, 'dim', 'dim7');
    if (functionOf(leading, key).secondary) out.push(leading);
  }
  return out;
}

/** Pool completo di un livello in una data tonalita'. */
export function candidatesFor(level, key) {
  switch (level.id) {
    case 1: return diatonicCandidates(key, { sevenths: false });
    case 2: return diatonicCandidates(key, { sevenths: true });
    case 3: return extendedCandidates(key);
    case 4:
    case 5: return [...extendedCandidates(key), ...borrowedCandidates(key), ...secondaryCandidates(key)];
    default: return diatonicCandidates(key, { sevenths: false });
  }
}

// ---------------------------------------------------------------------------
// Rivolti e voicing
// ---------------------------------------------------------------------------

/** Note dell'accordo utilizzabili come basso, in ordine di rivolto (3ª, 5ª, 7ª). */
function inversionBasses(c) {
  const semis = [...TRIAD_SEMITONES[c.quality]];
  if (c.seventh) semis.push(SEVENTH_SEMITONES[c.seventh]);
  return semis.map((s) => (c.root + s) % 12);
}

/** Applica un rivolto casuale (o lascia lo stato fondamentale). */
function withRandomInversion(c, rng) {
  const basses = inversionBasses(c);
  const roll = rng();
  if (roll < 0.3) return c;                                  // 30% stato fondamentale
  const bass = basses[Math.floor(rng() * basses.length)];
  return { ...c, bass };
}

/**
 * Allarga un voicing chiuso alzando di un'ottava alcune voci intermedie.
 * Il basso (nota piu' grave) resta fermo: e' lui a definire il rivolto.
 */
function spreadVoicing(notes, rng) {
  if (notes.length < 3) return notes;
  const [bass, ...upper] = notes;
  const spread = upper.map((n) => (rng() < 0.45 ? n + 12 : n));
  return [bass, ...spread].sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Generazione
// ---------------------------------------------------------------------------

let counter = 0;

const randomKey = (modes, rng) => ({
  tonic: Math.floor(rng() * 12),
  mode: modes[Math.floor(rng() * modes.length)],
});

/** Firma di un accordo, per non riproporre due volte di fila lo stesso bersaglio. */
const signature = (c) => `${c.quality}|${c.seventh}|${c.extensions.join(',')}`;

/**
 * @param {object} opts
 * @param {object} opts.level        voce di LEVELS
 * @param {string[]} [opts.modes]    ['major'] oppure ['major','minor']
 * @param {string} [opts.avoid]      firma dell'esercizio precedente
 * @param {()=>number} [opts.rng]
 * @returns {object} Exercise — vedi la specifica, §2
 */
export function generateExercise({ level, modes = ['major'], avoid = null, rng = Math.random } = {}) {
  const key = randomKey(modes, rng);
  const pool = candidatesFor(level, key);

  const scored = pool.map((c) => {
    const target = level.id === 5 ? withRandomInversion(c, rng) : c;
    const fn = functionOf(target, key);
    const itemKeys = level.fields.map((f) => itemKeyFor(f, target, fn));
    let w = weightOfKeys(itemKeys);
    if (avoid && signature(target) === avoid) w *= 0.15;
    return { target, fn, itemKeys, weight: w };
  });

  const picked = pickWeighted(scored, (s) => s.weight, rng);

  return {
    id: `gen-${Date.now().toString(36)}-${counter++}`,
    source: 'generated',
    key,
    target: picked.target,
    audio: { type: 'synth', voicing: voicingFor(picked.target, level, rng) },
    // metadati di comodo per la UI: non fanno parte del modello dati persistito
    level: level.id,
    fields: level.fields,
    fn: picked.fn,
    itemKeys: picked.itemKeys,
    signature: signature(picked.target),
  };
}

/** Voicing randomizzato: registro variabile, e voci sparse dal livello 5. */
function voicingFor(target, level, rng) {
  const center = 57 + Math.floor(rng() * 9);           // da A3 a F4
  const notes = voice(target, { center, spread: 14 });
  return level.id >= 5 ? spreadVoicing(notes, rng) : notes;
}

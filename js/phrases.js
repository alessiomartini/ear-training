/**
 * phrases.js — piccoli brani per stabilire la tonalita'.
 *
 * Una cadenza I–IV–V–I dice all'orecchio *dov'e'* la tonica, ma lo fa in modo
 * scolastico: quattro blocchi, nessuna linea. Ascoltando musica vera la tonalita'
 * si installa da sola, perche' c'e' una melodia che ci gira dentro. Qui i brani
 * sono scritti in **gradi della scala**, non in note: lo stesso frammento vale
 * in tutte e dodici le tonalita', e la trasposizione e' esatta per costruzione.
 *
 * Un grado e' un indice sulla scala, non un semitono: 0 = tonica, 4 = quinta,
 * 7 = tonica un'ottava sopra, -1 = settima sotto. Cosi' una melodia scritta una
 * volta suona idiomatica in maggiore e in minore senza riscriverla.
 */

const SCALE = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

/** Grado della scala → semitoni dalla tonica, ottave incluse. */
function degreeToSemitones(degree, mode) {
  const scale = SCALE[mode];
  const octave = Math.floor(degree / 7);
  const step = ((degree % 7) + 7) % 7;
  return octave * 12 + scale[step];
}

/**
 * Brani di quattro battute. `chords` e `melody` sono in battiti dall'inizio.
 * Gli accordi portano una qualita' esplicita: in minore la dominante e'
 * maggiore (minore armonica), che la scala naturale da sola non darebbe.
 */
const PHRASES = [
  {
    id: 'major-pop',
    mode: 'major',
    tempo: 100,
    beats: 16,
    chords: [
      { at: 0,  degree: 0, quality: 'maj' },
      { at: 4,  degree: 5, quality: 'min' },
      { at: 8,  degree: 3, quality: 'maj' },
      { at: 12, degree: 4, quality: 'maj' },
    ],
    melody: [
      { at: 0,  degree: 4, dur: 1.5 }, { at: 1.5, degree: 2, dur: 0.5 },
      { at: 2,  degree: 0, dur: 2 },
      { at: 4,  degree: 2, dur: 1 },   { at: 5, degree: 4, dur: 1 },
      { at: 6,  degree: 5, dur: 2 },
      { at: 8,  degree: 4, dur: 1.5 }, { at: 9.5, degree: 3, dur: 0.5 },
      { at: 10, degree: 2, dur: 2 },
      { at: 12, degree: 1, dur: 1 },   { at: 13, degree: 2, dur: 1 },
      { at: 14, degree: 0, dur: 2 },
    ],
  },
  {
    id: 'major-lyrical',
    mode: 'major',
    tempo: 84,
    beats: 16,
    chords: [
      { at: 0,  degree: 0, quality: 'maj', seventh: 'maj7' },
      { at: 4,  degree: 3, quality: 'maj', seventh: 'maj7' },
      { at: 8,  degree: 1, quality: 'min', seventh: 'min7' },
      { at: 12, degree: 4, quality: 'maj', seventh: 'min7' },
    ],
    melody: [
      { at: 0, degree: 2, dur: 1 },  { at: 1, degree: 4, dur: 1 },
      { at: 2, degree: 6, dur: 2 },
      { at: 4, degree: 5, dur: 1.5 }, { at: 5.5, degree: 4, dur: 0.5 },
      { at: 6, degree: 2, dur: 2 },
      { at: 8, degree: 3, dur: 1 },  { at: 9, degree: 4, dur: 1 },
      { at: 10, degree: 5, dur: 2 },
      { at: 12, degree: 6, dur: 1 }, { at: 13, degree: 4, dur: 1 },
      { at: 14, degree: 7, dur: 2 },
    ],
  },
  {
    id: 'major-folk',
    mode: 'major',
    tempo: 112,
    beats: 12,
    chords: [
      { at: 0, degree: 0, quality: 'maj' },
      { at: 3, degree: 4, quality: 'maj' },
      { at: 6, degree: 5, quality: 'min' },
      { at: 9, degree: 0, quality: 'maj' },
    ],
    melody: [
      { at: 0, degree: 0, dur: 1 }, { at: 1, degree: 2, dur: 1 }, { at: 2, degree: 4, dur: 1 },
      { at: 3, degree: 6, dur: 1.5 }, { at: 4.5, degree: 4, dur: 0.5 }, { at: 5, degree: 2, dur: 1 },
      { at: 6, degree: 4, dur: 1 }, { at: 7, degree: 5, dur: 1 }, { at: 8, degree: 4, dur: 1 },
      { at: 9, degree: 2, dur: 1 }, { at: 10, degree: 1, dur: 1 }, { at: 11, degree: 0, dur: 1 },
    ],
  },
  {
    id: 'minor-ballad',
    mode: 'minor',
    tempo: 92,
    beats: 16,
    chords: [
      { at: 0,  degree: 0, quality: 'min' },
      { at: 4,  degree: 5, quality: 'maj' },
      { at: 8,  degree: 2, quality: 'maj' },
      { at: 12, degree: 4, quality: 'maj', seventh: 'min7' },   // V maggiore
    ],
    melody: [
      { at: 0, degree: 0, dur: 1.5 }, { at: 1.5, degree: 2, dur: 0.5 },
      { at: 2, degree: 4, dur: 2 },
      { at: 4, degree: 5, dur: 1 }, { at: 5, degree: 4, dur: 1 },
      { at: 6, degree: 2, dur: 2 },
      { at: 8, degree: 4, dur: 1 }, { at: 9, degree: 6, dur: 1 },
      { at: 10, degree: 7, dur: 2 },
      { at: 12, degree: 6, dur: 1 }, { at: 13, degree: 4, dur: 1 },
      { at: 14, degree: 0, dur: 2 },
    ],
  },
  {
    id: 'minor-drive',
    mode: 'minor',
    tempo: 108,
    beats: 16,
    chords: [
      { at: 0,  degree: 0, quality: 'min', seventh: 'min7' },
      { at: 4,  degree: 6, quality: 'maj' },
      { at: 8,  degree: 5, quality: 'maj' },
      { at: 12, degree: 4, quality: 'maj', seventh: 'min7' },
    ],
    melody: [
      { at: 0, degree: 4, dur: 1 }, { at: 1, degree: 2, dur: 1 }, { at: 2, degree: 0, dur: 2 },
      { at: 4, degree: 6, dur: 1.5 }, { at: 5.5, degree: 4, dur: 0.5 }, { at: 6, degree: 2, dur: 2 },
      { at: 8, degree: 5, dur: 1 }, { at: 9, degree: 4, dur: 1 }, { at: 10, degree: 2, dur: 2 },
      { at: 12, degree: 4, dur: 1 }, { at: 13, degree: 6, dur: 1 }, { at: 14, degree: 0, dur: 2 },
    ],
  },
  {
    id: 'minor-modal',
    mode: 'minor',
    tempo: 96,
    beats: 12,
    chords: [
      { at: 0, degree: 0, quality: 'min' },
      { at: 3, degree: 3, quality: 'min' },
      { at: 6, degree: 6, quality: 'maj' },
      { at: 9, degree: 0, quality: 'min' },
    ],
    melody: [
      { at: 0, degree: 0, dur: 1 }, { at: 1, degree: 1, dur: 1 }, { at: 2, degree: 2, dur: 1 },
      { at: 3, degree: 3, dur: 2 }, { at: 5, degree: 2, dur: 1 },
      { at: 6, degree: 6, dur: 1 }, { at: 7, degree: 5, dur: 1 }, { at: 8, degree: 4, dur: 1 },
      { at: 9, degree: 2, dur: 1.5 }, { at: 10.5, degree: 1, dur: 0.5 }, { at: 11, degree: 0, dur: 1 },
    ],
  },
];

export const phrasesFor = (mode) => PHRASES.filter((p) => p.mode === mode);

const TRIAD = { maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8] };
const SEVENTH = { maj7: 11, min7: 10, dim7: 9 };

/**
 * Brano + tonalita' → eventi pronti per la riproduzione.
 *
 * @param {object} phrase voce di PHRASES
 * @param {{tonic:number, mode:string}} key
 * @returns {{events:{notes:number[], at:number, dur:number, velocity:number}[], duration:number}}
 */
export function renderPhrase(phrase, key, { melodyCenter = 72, chordCenter = 52 } = {}) {
  const beat = 60 / phrase.tempo;
  const events = [];

  // Tonica di riferimento nei due registri, cosi' la trasposizione non fa
  // saltare la melodia di un'ottava fra una tonalita' e l'altra.
  const melodyRoot = melodyCenter - ((melodyCenter - key.tonic) % 12 + 12) % 12;
  const chordRoot = chordCenter - ((chordCenter - key.tonic) % 12 + 12) % 12;

  for (const c of phrase.chords) {
    const rootSemis = degreeToSemitones(c.degree, phrase.mode);
    const base = chordRoot + rootSemis;
    const notes = TRIAD[c.quality].map((s) => base + s);
    if (c.seventh) notes.push(base + SEVENTH[c.seventh]);
    const next = phrase.chords.find((o) => o.at > c.at);
    const dur = ((next ? next.at : phrase.beats) - c.at) * beat;
    events.push({ notes, at: c.at * beat, dur, velocity: 0.42 });
  }

  for (const m of phrase.melody) {
    const note = melodyRoot + degreeToSemitones(m.degree, phrase.mode);
    events.push({ notes: [note], at: m.at * beat, dur: m.dur * beat * 0.95, velocity: 0.72 });
  }

  return { events, duration: phrase.beats * beat };
}

/** Un brano a caso nella tonalita' data, gia' reso. */
export function randomPhrase(key, rng = Math.random) {
  const pool = phrasesFor(key.mode);
  const phrase = pool[Math.floor(rng() * pool.length)];
  return { phrase, ...renderPhrase(phrase, key) };
}

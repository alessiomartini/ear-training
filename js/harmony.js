/**
 * harmony.js — core armonico condiviso tra la pagina Practice e la pagina Songs.
 *
 * Tre livelli:
 *   1. Chord      → rappresentazione assoluta (parseHarte / formatHarte / chordPitchClasses)
 *   2. Function   → analisi funzionale derivata (functionOf)
 *   3. Grading    → confronto campo per campo (gradeAnswer)
 *
 * Nessuna dipendenza esterna. ES module.
 */

// ---------------------------------------------------------------------------
// 1. Tabelle di base
// ---------------------------------------------------------------------------

const NATURAL_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Intervallo in notazione Harte ("b7", "#11", "3") → semitoni dalla fondamentale. */
const INTERVAL_SEMITONES = {
  '1': 0, 'b2': 1, '2': 2, '#2': 3, 'b3': 3, '3': 4, '#3': 5,
  'b4': 4, '4': 5, '#4': 6, 'b5': 6, '5': 7, '#5': 8,
  'b6': 8, '6': 9, '#6': 10, 'b7': 10, '7': 11, '#7': 12,
  'b9': 13, '9': 14, '#9': 15,
  '11': 17, '#11': 18, 'b11': 16,
  'b13': 20, '13': 21, '#13': 22,
};

/**
 * Shorthand Harte → struttura interna.
 * quality:   maj | min | dim | aug | hdim | sus2 | sus4
 * seventh:   null | 'maj7' | 'min7' | 'dim7'
 * extensions: array di stringhe di intervallo ('9', '#11', '13', '6', ...)
 */
const SHORTHAND = {
  maj:     { quality: 'maj',  seventh: null,   extensions: [] },
  min:     { quality: 'min',  seventh: null,   extensions: [] },
  dim:     { quality: 'dim',  seventh: null,   extensions: [] },
  aug:     { quality: 'aug',  seventh: null,   extensions: [] },
  maj7:    { quality: 'maj',  seventh: 'maj7', extensions: [] },
  min7:    { quality: 'min',  seventh: 'min7', extensions: [] },
  '7':     { quality: 'maj',  seventh: 'min7', extensions: [] },   // dominante
  dim7:    { quality: 'dim',  seventh: 'dim7', extensions: [] },
  hdim7:   { quality: 'hdim', seventh: 'min7', extensions: [] },   // semidiminuito
  minmaj7: { quality: 'min',  seventh: 'maj7', extensions: [] },
  maj6:    { quality: 'maj',  seventh: null,   extensions: ['6'] },
  min6:    { quality: 'min',  seventh: null,   extensions: ['6'] },
  '9':     { quality: 'maj',  seventh: 'min7', extensions: ['9'] },
  maj9:    { quality: 'maj',  seventh: 'maj7', extensions: ['9'] },
  min9:    { quality: 'min',  seventh: 'min7', extensions: ['9'] },
  '11':    { quality: 'maj',  seventh: 'min7', extensions: ['9', '11'] },
  maj11:   { quality: 'maj',  seventh: 'maj7', extensions: ['9', '11'] },
  min11:   { quality: 'min',  seventh: 'min7', extensions: ['9', '11'] },
  '13':    { quality: 'maj',  seventh: 'min7', extensions: ['9', '11', '13'] },
  maj13:   { quality: 'maj',  seventh: 'maj7', extensions: ['9', '11', '13'] },
  min13:   { quality: 'min',  seventh: 'min7', extensions: ['9', '11', '13'] },
  sus2:    { quality: 'sus2', seventh: null,   extensions: [] },
  sus4:    { quality: 'sus4', seventh: null,   extensions: [] },
};

/** Intervalli impliciti di ogni qualità (triade), per il calcolo delle pitch class. */
const QUALITY_INTERVALS = {
  maj:  ['3', '5'],
  min:  ['b3', '5'],
  dim:  ['b3', 'b5'],
  aug:  ['3', '#5'],
  hdim: ['b3', 'b5'],
  sus2: ['2', '5'],
  sus4: ['4', '5'],
};

const SEVENTH_INTERVAL = { maj7: '7', min7: 'b7', dim7: '6' };

// ---------------------------------------------------------------------------
// 2. Parser Harte
// ---------------------------------------------------------------------------

/**
 * Parsa una etichetta in notazione Harte (Isophonics / McGill Billboard).
 *
 *   parseHarte('F:maj7(9,#11)')
 *   parseHarte('C#:min7/b7')
 *   parseHarte('G:(3,5,b7)')      // solo lista di intervalli
 *   parseHarte('N')               // silenzio / assenza di accordo
 *   parseHarte('X')               // non identificato
 *
 * @returns {Chord|null} null per 'N' e 'X'.
 */
export function parseHarte(label) {
  const raw = String(label).trim();
  if (raw === '' || raw === 'N' || raw === 'X') return null;

  // root[:shorthand][(degrees)][/bass]
  const m = raw.match(/^([A-G][#b]*)(?::([^/]*))?(?:\/(.+))?$/);
  if (!m) throw new Error(`Etichetta Harte non valida: ${raw}`);

  const [, rootStr, bodyRaw, bassStr] = m;
  const root = pitchClassOfName(rootStr);

  let quality = 'maj';
  let seventh = null;
  let extensions = [];
  let omitted = [];

  const body = (bodyRaw ?? 'maj').trim();
  // Il corpo può essere: "maj7", "maj7(9)", "(3,5,b7)", oppure vuoto.
  const bodyMatch = body.match(/^([^(]*)(?:\(([^)]*)\))?$/);
  if (!bodyMatch) throw new Error(`Corpo non valido in: ${raw}`);

  const shorthand = bodyMatch[1].trim();
  const degreeList = bodyMatch[2]
    ? bodyMatch[2].split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  if (shorthand) {
    const base = SHORTHAND[shorthand];
    if (!base) throw new Error(`Shorthand sconosciuto: ${shorthand} (in ${raw})`);
    quality = base.quality;
    seventh = base.seventh;
    extensions = [...base.extensions];
  }

  // Gradi espliciti fra parentesi.
  for (const deg of degreeList) {
    if (deg.startsWith('*')) { omitted.push(deg.slice(1)); continue; }
    const semis = INTERVAL_SEMITONES[deg];
    if (semis === undefined) throw new Error(`Intervallo sconosciuto: ${deg} (in ${raw})`);

    if (!shorthand) {
      // Notazione a soli intervalli: deduci qualità e settima.
      if (deg === 'b3') quality = 'min';
      else if (deg === 'b5' && quality === 'min') quality = 'dim';
      else if (deg === '#5' && quality === 'maj') quality = 'aug';
      else if (deg === '7') seventh = 'maj7';
      else if (deg === 'b7') seventh = 'min7';
      else if (deg === '6' && quality === 'dim') seventh = 'dim7';
      else if (!['1', '3', '5'].includes(deg)) extensions.push(deg);
    } else if (deg === '7') seventh = 'maj7';
    else if (deg === 'b7') seventh = 'min7';
    else if (!extensions.includes(deg)) extensions.push(deg);
  }

  const bass = bassStr ? bassPitchClass(root, bassStr) : null;

  return {
    root,
    quality,
    seventh,
    extensions: dedupe(extensions),
    omitted,
    bass: bass === root ? null : bass,
    raw,
  };
}

/** Nome di nota con alterazioni multiple → pitch class. */
function pitchClassOfName(name) {
  const letter = name[0].toUpperCase();
  let pc = NATURAL_PC[letter];
  if (pc === undefined) throw new Error(`Nota non valida: ${name}`);
  for (const ch of name.slice(1)) {
    if (ch === '#') pc += 1;
    else if (ch === 'b') pc -= 1;
    else throw new Error(`Alterazione non valida: ${ch}`);
  }
  return ((pc % 12) + 12) % 12;
}

/**
 * Il basso in Harte è un intervallo relativo alla fondamentale ("/3", "/b7"),
 * ma alcuni corpora usano il nome di nota ("/E"). Accetta entrambi.
 */
function bassPitchClass(root, bassStr) {
  if (/^[A-G][#b]*$/.test(bassStr)) return pitchClassOfName(bassStr);
  const semis = INTERVAL_SEMITONES[bassStr];
  if (semis === undefined) throw new Error(`Basso non valido: ${bassStr}`);
  return (root + semis) % 12;
}

const dedupe = (arr) => [...new Set(arr)];

// ---------------------------------------------------------------------------
// 3. Serializzatore inverso — la pagina Practice genera accordi in Harte
// ---------------------------------------------------------------------------

const PC_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const PC_NAMES_FLAT  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export function formatHarte(chord, { flats = true } = {}) {
  if (!chord) return 'N';
  const names = flats ? PC_NAMES_FLAT : PC_NAMES_SHARP;
  const shorthand = shorthandFor(chord);
  const extra = chord.extensions.filter((e) => !impliedBy(shorthand).includes(e));
  const omit = chord.omitted.map((o) => `*${o}`);
  const parens = [...extra, ...omit];

  let s = `${names[chord.root]}:${shorthand}`;
  if (parens.length) s += `(${parens.join(',')})`;
  if (chord.bass !== null && chord.bass !== undefined) {
    s += `/${intervalName((chord.bass - chord.root + 12) % 12)}`;
  }
  return s;
}

function shorthandFor({ quality, seventh, extensions }) {
  const has = (x) => extensions.includes(x);
  if (quality === 'sus2' || quality === 'sus4') return quality;
  if (quality === 'hdim') return 'hdim7';
  if (seventh === 'dim7') return 'dim7';
  if (!seventh) {
    if (has('6')) return quality === 'min' ? 'min6' : 'maj6';
    return quality; // maj | min | dim | aug
  }
  const tail = has('13') ? '13' : has('11') ? '11' : has('9') ? '9' : '7';
  if (quality === 'min') return seventh === 'maj7' ? 'minmaj7' : `min${tail}`;
  if (seventh === 'maj7') return `maj${tail}`;
  return tail; // dominante: 7 | 9 | 11 | 13
}

function impliedBy(shorthand) {
  return SHORTHAND[shorthand] ? SHORTHAND[shorthand].extensions : [];
}

const PREFERRED_INTERVAL_NAMES =
  ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];

function intervalName(semitones) {
  return PREFERRED_INTERVAL_NAMES[semitones] ?? String(semitones);
}

// ---------------------------------------------------------------------------
// 4. Pitch class dell'accordo — per la sintesi audio
// ---------------------------------------------------------------------------

/** @returns {number[]} pitch class (0-11) di tutte le note dell'accordo. */
export function chordPitchClasses(chord) {
  if (!chord) return [];
  const ivs = ['1', ...QUALITY_INTERVALS[chord.quality]];
  if (chord.seventh) ivs.push(SEVENTH_INTERVAL[chord.seventh]);
  ivs.push(...chord.extensions);
  const kept = ivs.filter((iv) => !chord.omitted.includes(iv));
  return dedupe(kept.map((iv) => (chord.root + INTERVAL_SEMITONES[iv]) % 12));
}

/**
 * Voicing pianistico ragionevole in note MIDI.
 * Fondamentale (o basso) in ottava bassa, il resto stretto attorno a `center`.
 */
export function voice(chord, { center = 60, spread = 12 } = {}) {
  if (!chord) return [];
  const bassPc = chord.bass ?? chord.root;
  const notes = [40 + ((bassPc - 40) % 12 + 12) % 12];
  for (const pc of chordPitchClasses(chord)) {
    if (pc === bassPc && notes.length === 1) continue;
    let n = center + (((pc - center) % 12) + 12) % 12;
    while (notes.includes(n)) n += 12;
    if (n < center + spread) notes.push(n);
  }
  return notes.sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// 5. Analisi funzionale
// ---------------------------------------------------------------------------

const DEGREE_NAMES = ['I', 'bII', 'II', 'bIII', 'III', 'IV', '#IV', 'V', 'bVI', 'VI', 'bVII', 'VII'];

/** Gradi diatonici (offset dalla tonica → qualità attesa). */
const DIATONIC = {
  major: { 0: 'maj', 2: 'min', 4: 'min', 5: 'maj', 7: 'maj', 9: 'min', 11: 'dim' },
  minor: { 0: 'min', 2: 'dim', 3: 'maj', 5: 'min', 7: 'min', 8: 'maj', 10: 'maj' },
};

/** Prestiti più comuni dal modo parallelo. */
const BORROWED = {
  major: { 3: 'maj', 8: 'maj', 10: 'maj', 5: 'min', 0: 'min', 2: 'dim' },
  minor: { 4: 'maj', 9: 'maj', 11: 'dim', 5: 'maj' },
};

/**
 * @param {Chord} chord
 * @param {{tonic:number, mode:'major'|'minor'}} key
 */
export function functionOf(chord, key) {
  if (!chord) return null;
  const offset = ((chord.root - key.tonic) % 12 + 12) % 12;
  const diatonicQuality = DIATONIC[key.mode][offset];
  const isDiatonic = qualityMatches(chord.quality, diatonicQuality);

  let borrowed = null;
  if (!isDiatonic && qualityMatches(chord.quality, BORROWED[key.mode][offset])) {
    borrowed = key.mode === 'major' ? 'parallel-minor' : 'parallel-major';
  }

  return {
    degree: degreeLabel(offset, chord.quality),
    degreeIndex: offset,
    diatonic: isDiatonic,
    borrowed,
    secondary: secondaryFunction(chord, key, offset, isDiatonic),
    inversion: inversionOf(chord),
    outOfKey: !isDiatonic && !borrowed,
  };
}

/** 'hdim' occupa lo stesso posto funzionale di 'dim' (vii in maggiore, ii in minore). */
function qualityMatches(actual, expected) {
  if (!expected) return false;
  if (actual === expected) return true;
  return expected === 'dim' && actual === 'hdim';
}

function degreeLabel(offset, quality) {
  const base = DEGREE_NAMES[offset];
  if (quality === 'min') return base.replace(/[IV]+/, (r) => r.toLowerCase());
  if (quality === 'dim') return base.replace(/[IV]+/, (r) => r.toLowerCase()) + '\u00b0';
  if (quality === 'hdim') return base.replace(/[IV]+/, (r) => r.toLowerCase()) + '\u00f8';
  if (quality === 'aug') return base + '+';
  return base;
}

/** Dominanti secondarie: accordo di dominante la cui risoluzione è un grado diatonico. */
function secondaryFunction(chord, key, offset, isDiatonic) {
  const isDominantType = chord.quality === 'maj' && chord.seventh === 'min7';
  const isDim7 = chord.seventh === 'dim7';
  if (isDiatonic && !isDominantType) return null;
  if (isDiatonic && isDominantType && key.mode === 'major' && offset === 7) return null;

  if (isDominantType) {
    if (offset === 7) return null;                  // e' la dominante primaria
    const target = (offset + 5) % 12;               // risolve una quarta sopra
    const q = DIATONIC[key.mode][target];
    if (q && target !== 0) return `V/${degreeLabel(target, q)}`;
  }
  if (isDim7) {
    const target = (offset + 1) % 12;               // risolve un semitono sopra
    const q = DIATONIC[key.mode][target];
    if (q) return `vii°/${degreeLabel(target, q)}`;
  }
  return null;
}

function inversionOf(chord) {
  if (chord.bass === null || chord.bass === undefined) return 0;
  const semis = ((chord.bass - chord.root) % 12 + 12) % 12;
  const ivs = ['1', ...QUALITY_INTERVALS[chord.quality]];
  if (chord.seventh) ivs.push(SEVENTH_INTERVAL[chord.seventh]);
  const idx = ivs.findIndex((iv) => INTERVAL_SEMITONES[iv] % 12 === semis);
  return idx > 0 ? idx : -1;   // -1 = basso estraneo all'accordo (pedale, slash chord)
}

// ---------------------------------------------------------------------------
// 6. Grading campo per campo
// ---------------------------------------------------------------------------

/**
 * Confronta la risposta dell'utente con l'accordo bersaglio.
 * Restituisce un esito per ogni campo abilitato, non un booleano unico:
 * è il dato su cui si costruisce la ripetizione spaziata.
 *
 * @param {object} answer  { degree, quality, seventh, extensions, inversion, outOfKey }
 * @param {Chord}  target
 * @param {object} key
 * @param {string[]} fields campi da valutare al livello corrente
 */
export function gradeAnswer(answer, target, key, fields = ['degree', 'quality', 'seventh', 'extensions']) {
  const fn = functionOf(target, key);
  const results = {};

  for (const field of fields) {
    switch (field) {
      case 'degree':
        results.degree = norm(answer.degree) === norm(fn.degree);
        break;
      case 'quality':
        results.quality = answer.quality === target.quality;
        break;
      case 'seventh':
        results.seventh = (answer.seventh ?? null) === (target.seventh ?? null);
        break;
      case 'extensions': {
        const a = new Set(answer.extensions ?? []);
        const b = new Set(target.extensions ?? []);
        results.extensions = a.size === b.size && [...a].every((x) => b.has(x));
        break;
      }
      case 'inversion':
        results.inversion = (answer.inversion ?? 0) === fn.inversion;
        break;
      case 'outOfKey':
        results.outOfKey = Boolean(answer.outOfKey) === fn.outOfKey;
        break;
    }
  }

  return {
    results,
    allCorrect: Object.values(results).every(Boolean),
    target: { chord: target, function: fn },
    /** chiavi per la ripetizione spaziata: un item per campo sbagliato */
    itemKeys: Object.entries(results)
      .filter(([, ok]) => !ok)
      .map(([field]) => itemKeyFor(field, target, fn)),
  };
}

const norm = (s) => String(s ?? '').replace(/[\u00b0\u00f8+]/g, '').toLowerCase();

/**
 * Chiave di ripetizione spaziata per un campo. `gradeAnswer` la usa per i campi
 * sbagliati; il chiamante ne ha bisogno anche per quelli giusti, altrimenti non
 * puo' calcolare un'accuratezza (servono sia `seen` che `correct`).
 */
export function itemKeyFor(field, chord, fn) {
  return `${field}:${itemValueFor(field, chord, fn)}`;
}

function itemValueFor(field, chord, fn) {
  if (field === 'degree') return fn.degree;
  if (field === 'quality') return chord.quality;
  if (field === 'seventh') return chord.seventh ?? 'none';
  if (field === 'extensions') return chord.extensions.join('+') || 'none';
  if (field === 'inversion') return String(fn.inversion);
  if (field === 'outOfKey') return String(fn.outOfKey);
  return '?';
}

// ---------------------------------------------------------------------------
// 7. Caricamento di un file .lab (Isophonics / Billboard)
// ---------------------------------------------------------------------------

/**
 * Formato .lab: "<start>\t<end>\t<label>" per riga, tempi in secondi.
 * @returns {{start:number, end:number, chord:Chord|null, raw:string}[]}
 */
export function parseLab(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [start, end, ...rest] = line.split(/\s+/);
      const raw = rest.join(' ');
      let chord = null;
      try { chord = parseHarte(raw); } catch { chord = null; }
      return { start: parseFloat(start), end: parseFloat(end), chord, raw };
    });
}

/**
 * Da segmenti .lab a esercizi: scarta i segmenti troppo brevi e i 'N'.
 * `offset` compensa un eventuale disallineamento fra la registrazione
 * annotata e il video YouTube usato per la riproduzione.
 */
export function segmentsToExercises(segments, { videoId, key, minDuration = 1.2, offset = 0 }) {
  return segments
    .filter((s) => s.chord && s.end - s.start >= minDuration)
    .map((s, i) => ({
      id: `${videoId}-${i}`,
      source: 'corpus',
      key,
      target: s.chord,
      audio: {
        type: 'youtube',
        videoId,
        start: Math.max(0, s.start + offset),
        end: s.end + offset,
      },
    }));
}

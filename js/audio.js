/**
 * audio.js — sintesi e contesto tonale.
 *
 * Tone.js e' caricato come UMD dalla pagina (variabile globale `Tone`), non
 * importato come modulo: evita di dipendere dalla build ESM di un CDN.
 *
 * Due sorgenti: un `Sampler` sui campioni Salamander Grand (CC), e un
 * `PolySynth` di riserva se i campioni non arrivano entro il timeout. Il drone
 * ha una voce propria, cosi' puo' restare acceso mentre l'accordo bersaglio
 * suona sopra.
 */

import { voice } from './harmony.js';
import { randomPhrase } from './phrases.js';

const SALAMANDER_BASE = 'https://tonejs.github.io/audio/salamander/';

/** Un campione ogni terza minore: copre A1–C6 senza scaricare mezzo gigabyte. */
const SALAMANDER_URLS = {
  A1: 'A1.mp3',  C2: 'C2.mp3',  'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
  A2: 'A2.mp3',  C3: 'C3.mp3',  'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
  A3: 'A3.mp3',  C4: 'C4.mp3',  'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
  A4: 'A4.mp3',  C5: 'C5.mp3',  'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
  A5: 'A5.mp3',  C6: 'C6.mp3',
};

const SAMPLE_TIMEOUT_MS = 9000;

let instrument = null;
let droneSynth = null;
let kick = null;
let click = null;
let engine = 'none';       // 'sampler' | 'synth'
let ready = false;
let droneActive = false;

const midiToNote = (m) => Tone.Frequency(m, 'midi').toNote();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Va chiamata da un gesto dell'utente: i browser non lasciano partire
 * l'AudioContext altrimenti.
 * @returns {Promise<'sampler'|'synth'>} il motore effettivamente attivo
 */
export async function init() {
  if (ready) return engine;
  if (typeof Tone === 'undefined') {
    throw new Error('Tone.js did not load. It is fetched from unpkg.com: '
      + 'check your connection, or anything blocking that host.');
  }

  await Tone.start();

  const out = new Tone.Gain(0.85).toDestination();
  const reverb = new Tone.Reverb({ decay: 1.6, wet: 0.18 }).connect(out);

  const sampler = new Tone.Sampler({
    urls: SALAMANDER_URLS,
    baseUrl: SALAMANDER_BASE,
    release: 1.2,
  }).connect(reverb);

  const loaded = await Promise.race([
    Tone.loaded().then(() => true),
    wait(SAMPLE_TIMEOUT_MS).then(() => false),
  ]).catch(() => false);

  if (loaded && sampler.loaded) {
    instrument = sampler;
    engine = 'sampler';
  } else {
    sampler.dispose();
    instrument = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.012, decay: 0.35, sustain: 0.35, release: 1.1 },
    }).connect(reverb);
    instrument.volume.value = -8;
    engine = 'synth';
  }

  droneSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.9, decay: 0.2, sustain: 1, release: 1.4 },
  }).connect(out);
  droneSynth.volume.value = -20;

  // Sezione ritmica per l'esercizio sul metro: un metronomo non basta, serve
  // qualcosa che abbia un accento vero sul primo movimento.
  kick = new Tone.MembraneSynth({
    pitchDecay: 0.03, octaves: 6,
    envelope: { attack: 0.001, decay: 0.28, sustain: 0 },
  }).connect(out);
  kick.volume.value = -6;

  click = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.045, sustain: 0 },
  }).connect(out);
  click.volume.value = -22;

  ready = true;
  return engine;
}

export const isReady = () => ready;
export const currentEngine = () => engine;

// ---------------------------------------------------------------------------
// Riproduzione
// ---------------------------------------------------------------------------

/**
 * Suona un insieme di note MIDI.
 * @param {number[]} notes
 * @param {object} [opts] `at` in secondi sul clock di Tone, `duration`, `velocity`,
 *                        `roll` per un leggero arpeggio (piu' naturale al pianoforte)
 */
export function playNotes(notes, { at = null, duration = 2.4, velocity = 0.7, roll = 0.012 } = {}) {
  if (!ready || notes.length === 0) return 0;
  const t0 = at ?? Tone.now() + 0.05;
  notes.forEach((n, i) => {
    instrument.triggerAttackRelease(midiToNote(n), duration, t0 + i * roll, velocity);
  });
  return duration;
}

export function stopAll() {
  if (!ready) return;
  instrument.releaseAll?.();
  stopDrone();
}

// ---------------------------------------------------------------------------
// Sequenze: brani, groove, tutto cio' che ha una durata
// ---------------------------------------------------------------------------

/**
 * Riproduce una lista di eventi {notes, at, dur, velocity}, con `at` in secondi
 * dall'inizio della sequenza.
 * @returns {number} durata complessiva in secondi
 */
export function playSequence(events, { at = null, tail = 0.4 } = {}) {
  if (!ready || events.length === 0) return 0;
  const t0 = at ?? Tone.now() + 0.08;
  let end = 0;
  for (const ev of events) {
    for (const [i, n] of ev.notes.entries()) {
      instrument.triggerAttackRelease(midiToNote(n), ev.dur, t0 + ev.at + i * 0.008, ev.velocity ?? 0.7);
    }
    end = Math.max(end, ev.at + ev.dur);
  }
  return end + tail;
}

/**
 * Un piccolo brano nella tonalita' data, al posto della cadenza. E' il modo in
 * cui la tonalita' si installa quando si ascolta musica: c'e' una melodia che
 * ci gira dentro, non quattro blocchi in fila.
 * @returns {number} durata in secondi
 */
export function playPiece(key, rng = Math.random) {
  if (!ready) return 0;
  const { events } = randomPhrase(key, rng);
  return playSequence(events, { tail: 0.5 });
}

/**
 * Groove nel metro dato. `subdivision` 2 = tempo semplice, 3 = composto.
 * Batteria per l'accento metrico, basso e accordi perche' suoni come musica e
 * non come un metronomo: contare i click e' un esercizio diverso da sentire il
 * movimento forte.
 * @returns {number} durata in secondi
 */
export function playGroove({ beatsPerBar, subdivision = 2, tempo = 100, bars = 4, key = { tonic: 0, mode: 'minor' } }) {
  if (!ready) return 0;
  const beat = 60 / tempo;
  const t0 = Tone.now() + 0.1;
  const bassPc = 36 + (((key.tonic - 36) % 12) + 12) % 12;
  const third = key.mode === 'minor' ? 3 : 4;
  const chord = [bassPc + 12, bassPc + 12 + third, bassPc + 19];

  for (let bar = 0; bar < bars; bar++) {
    for (let b = 0; b < beatsPerBar; b++) {
      const t = t0 + (bar * beatsPerBar + b) * beat;
      const downbeat = b === 0;

      if (downbeat) kick.triggerAttackRelease('C1', 0.22, t, 1);
      else if (subdivision === 2 && beatsPerBar % 2 === 0 && b % 2 === 1) kick.triggerAttackRelease('C1', 0.16, t, 0.5);

      click.triggerAttackRelease(0.05, t, downbeat ? 0.9 : 0.32);
      for (let s = 1; s < subdivision; s++) {
        click.triggerAttackRelease(0.03, t + (s * beat) / subdivision, 0.14);
      }

      if (downbeat) {
        instrument.triggerAttackRelease(midiToNote(bassPc), beat * 0.9, t, 0.55);
      } else if (b === Math.floor(beatsPerBar / 2)) {
        chord.forEach((n, i) => instrument.triggerAttackRelease(midiToNote(n), beat * 0.7, t + i * 0.008, 0.3));
      }
    }
  }
  return bars * beatsPerBar * beat + 0.4;
}

// ---------------------------------------------------------------------------
// Contesto tonale
// ---------------------------------------------------------------------------

const triad = (root, quality, seventh = null) => ({
  root: ((root % 12) + 12) % 12, quality, seventh, extensions: [], omitted: [], bass: null,
});

/**
 * Progressioni di cadenza. In minore la dominante e' maggiore (minore armonica):
 * la v naturale non stabilisce la tonalita', e stabilirla e' tutto il punto.
 */
function cadenceChords(key, progression) {
  const t = key.tonic;
  if (key.mode === 'major') {
    return progression === 'twofive'
      ? [triad(t + 2, 'min', 'min7'), triad(t + 7, 'maj', 'min7'), triad(t, 'maj', 'maj7')]
      : [triad(t, 'maj'), triad(t + 5, 'maj'), triad(t + 7, 'maj'), triad(t, 'maj')];
  }
  return progression === 'twofive'
    ? [triad(t + 2, 'hdim', 'min7'), triad(t + 7, 'maj', 'min7'), triad(t, 'min')]
    : [triad(t, 'min'), triad(t + 5, 'min'), triad(t + 7, 'maj'), triad(t, 'min')];
}

/**
 * Suona la cadenza che stabilisce la tonalita'.
 * @returns {Promise<number>} durata complessiva in secondi
 */
export async function playCadence(key, { progression = 'authentic', step = 0.72 } = {}) {
  const chords = cadenceChords(key, progression);
  const t0 = Tone.now() + 0.06;

  chords.forEach((c, i) => {
    const last = i === chords.length - 1;
    playNotes(voice(c, { center: 60, spread: 12 }), {
      at: t0 + i * step,
      duration: last ? step * 2.2 : step * 0.95,
      velocity: last ? 0.62 : 0.55,
    });
  });

  return chords.length * step + step * 1.2;
}

/** Drone sulla tonica: nessun appiglio di memoria a breve termine, solo il centro tonale. */
export function startDrone(key) {
  if (!ready) return;
  stopDrone();
  const root = 36 + (((key.tonic - 36) % 12) + 12) % 12;   // C2–B2
  droneSynth.triggerAttack([midiToNote(root), midiToNote(root + 12), midiToNote(root + 19)]);
  droneActive = true;
}

export function stopDrone() {
  if (!ready || !droneActive) return;
  droneSynth.releaseAll();
  droneActive = false;
}

export const isDroneActive = () => droneActive;

/**
 * Stabilisce la tonalita' secondo la modalita' scelta e restituisce quando
 * l'accordo bersaglio puo' entrare.
 * @param {'authentic'|'twofive'|'drone'} mode
 */
export async function establishKey(key, mode) {
  if (mode === 'drone') {
    startDrone(key);
    return 1.1;
  }
  stopDrone();
  if (mode === 'piece') return playPiece(key);
  return playCadence(key, { progression: mode });
}

/** Contesto + accordo bersaglio in sequenza. Usata dal pulsante "nel contesto". */
export async function playInContext(exercise, mode) {
  const lead = await establishKey(exercise.key, mode);
  await wait(lead * 1000);
  playNotes(exercise.audio.voicing, { duration: 3.0, velocity: 0.72 });
}

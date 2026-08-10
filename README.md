# Harmonic Ear Training

A static site for training your ear on harmony. No build step, no backend: serve
it with any static file server, and publish it on GitHub Pages exactly as it is.

The guiding principle comes from the spec: **a chord is an absolute object, and
the degree is a function of that chord given a tonal context.** The degree is
never stored — it is recomputed. Changing a song's key relabels the whole corpus
without touching a single annotation.

## Status

| Step in the development order | Status |
|---|---|
| 1. `harmony.js` + a page that tests the parser | done |
| 2. `audio.js` + `generator.js` + Practice level 1 | done |
| 3. `srs.js` and levels 2–5 | done |
| 4. `songs.html` with one song and offset calibration | not started |
| 5. Growing the corpus | not started |

`songs.html` exists as a placeholder describing what is missing.
`js/youtube.js` does not exist yet.

## Layout

```
/
├── index.html
├── practice.html          training on synthesised chords
├── songs.html             placeholder, step 4
├── test-parser.html       checks parseHarte against a real .lab
├── js/
│   ├── harmony.js         harmonic core (Chord · Function · Grading)
│   ├── audio.js           Tone.js: cadence, drone, chord
│   ├── generator.js       chord pool per level, sampled through the SRS
│   ├── srs.js             spaced repetition on localStorage
│   ├── quiz-ui.js         answer UI, shared between both pages
│   ├── practice.js        controller for the Practice page
│   └── test-parser.js     controller for the parser page
├── data/songs/
│   ├── index.json         song list (empty — see "Corpus")
│   └── sample.lab         synthetic annotation for testing the parser
└── css/style.css
```

The code comments are in Italian, matching `harmony.js` as it was supplied.

## Running it

The site loads ES modules and uses `fetch()`, so it will not work from a
`file://` URL. Serve the directory over HTTP:

```
python3 -m http.server 8000
```

then open `http://localhost:8000/`. On GitHub Pages, point Pages at the root of
the branch — there is nothing to compile.

It needs the network on first start: Tone.js comes from unpkg, and the piano
samples (Salamander Grand, CC) from `tonejs.github.io`. If the samples do not
arrive within nine seconds it falls back to a `PolySynth`; if Tone.js itself is
missing, the page says so instead of hanging on a loading state.

## Practice

The cycle: establish the key, play the target, answer, get graded field by
field.

**Tonal context** — an `I–IV–V–I` cadence, a `ii–V–I` cadence, or a drone on the
tonic. The drone is harder and it teaches more: it takes away the crutch of
short-term memory. In minor the cadence uses a major dominant (harmonic minor),
because the natural v does not establish the key — and establishing it is the
whole point.

**The key and the voicing are randomised on every exercise.** Without that you
learn absolute timbre instead of function.

**Levels** — the graded fields accumulate:

| # | Content | Graded fields |
|---|---|---|
| 1 | diatonic triads | degree, quality |
| 2 | diatonic sevenths | + seventh |
| 3 | ninths, elevenths, thirteenths | + extensions |
| 4 | modal interchange, secondary dominants | + outside the key |
| 5 | inversions and open voicings | + inversion |

Level, context and mode can be changed mid-session, and they are remembered.
Shortcuts: **Enter** checks and then advances, **Space** replays the chord.

## Spaced repetition

This is the difference between a toy and something that actually makes you
better, so it is worth spelling out.

An *item* is not a chord: it is a **field you can get wrong**, in the form
produced by `harmony.itemKeyFor` — `degree:bVI`, `seventh:maj7`,
`extensions:9+13`, `inversion:2`. A single chord feeds several items at once, so
weakness on one field surfaces independently of the others. Each item keeps
`{ seen, correct, lastSeen }` in `localStorage`, and the sampling weight is

```
weight = (FLOOR + (1 - accuracy)) * recency(lastSeen)
```

where `recency` climbs from 0.25 back to 1 with a six-hour time constant. An
item you have just seen is temporarily less likely; one you have neglected
resurfaces on its own. `FLOOR` keeps mastered items in circulation.

The generator builds the level's pool in the drawn key, sums the weights of the
items each candidate would test, and samples in proportion. In testing, getting
`seventh:maj7` wrong every time pushes the share of major-seventh chords from
29% to 57% within about a hundred exercises.

## Corpus (the Songs page)

This repository **ships no corpus annotations**. Isophonics, McGill Billboard
and RWC each come with their own terms of use, to be checked and credited before
redistributing them. The only `.lab` present, `data/songs/sample.lab`, is
synthetic: it exists purely to exercise the awkward corners of the parser.

The `test-parser.html` page accepts a file from disk, so if you have your own
copy of Isophonics you can check the parser against it without the file ever
leaving the browser.

## Changes to `harmony.js`

The module arrived already written and tested. Two additions were made, both
purely additive — no existing behaviour changes:

1. **`gradeAnswer` accepts an `outOfKey` field.** The spec's level table calls
   for it at level 4, but the `switch` had no case for it, so the field would
   have been silently ignored.
2. **`itemKeyFor` is exported.** `gradeAnswer` only returns keys for the fields
   you got *wrong*; computing an accuracy also needs the `seen` counts of the
   ones you got right, and without this export the caller would have had to
   duplicate the key construction.

## Known limitations

- **`formatHarte` cannot express every combination of tensions.**
  `C:maj7(13)` comes back as `C:maj13`, which also implies the ninth and the
  eleventh. This does not affect grading, which works on the `Chord` object
  rather than the string: it only affects the label shown on screen, which is
  why a plain-language description generated from the fields sits next to it.
  The generator avoids the worst case anyway by always producing the ninth
  whenever it produces an eleventh or a thirteenth — which is the real-world
  convention. The parser page flags these rows in yellow.
- **`formatHarte` has no shorthand for augmented sevenths, or for a diminished
  triad with a minor seventh**: it serialises them as `7` or `maj7`, losing the
  quality. The generator never produces them, so it cannot happen in the app,
  but the function is still exposed.
- **A major V in a minor key is never used as a target.** The `DIATONIC.minor`
  table in `harmony.js` is the natural minor, and `BORROWED.minor` has no entry
  for degree 7, so `functionOf` would classify it as outside the key — a wrong
  answer to teach. In the cadences, where nothing is graded, the major dominant
  is present. Offering it as a target too would mean extending the
  `harmony.js` tables to the harmonic minor.
- The natural 11 is never offered over major or dominant chords: it is an avoid
  note, and as an ear-training target it teaches nothing useful.

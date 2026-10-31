# Harmonic Ear Training

A static site for training your ear on harmony. No build step, no backend: serve
it with any static file server, and publish it on GitHub Pages exactly as it is.

The guiding principle comes from the spec: **a chord is an absolute object, and
the degree is a function of that chord given a tonal context.** The degree is
never stored — it is recomputed. Changing a song's key relabels the whole corpus
without touching a single annotation.

## On hold

Two existing apps — **MyEarTraining** and **Functional Ear Trainer** — already
cover what this project set out to do, and cover it well. Building a third
implementation of the same exercises has no point once two good ones exist, so
active development stops here.

The repo stays as it is rather than getting archived, for a specific reason:
if a concrete need shows up later — something those apps don't do, that's worth
checking against them again before writing code — this codebase is the fastest
way to try it, mainly because of the `exercises.js` contract (see "Practice"
below), which was built to make a new exercise type a matter of adding one file,
not restructuring the app. Everything below still describes what is here and
how it works; it just is not moving forward for now.

## Status

| Step in the development order | Status |
|---|---|
| 1. `harmony.js` + a page that tests the parser | done |
| 2. `audio.js` + `generator.js` + Practice level 1 | done |
| 3. `srs.js` and levels 2–5 | done |
| 4. `songs.html` with one song and offset calibration | not started |
| 5. Growing the corpus | not started |

`songs.html` lists `data/songs/index.json` (empty on purpose), embeds the video
and plays any annotated segment. `js/youtube.js` wraps the YouTube IFrame API
(no key) and falls back to a plain link when the API cannot load. Offset
calibration, game modes and a real corpus are still missing.

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
│   ├── exercises.js       the seven exercise types, behind one contract
│   ├── phrases.js         short transposable pieces used to establish a key
│   ├── generator.js       chord pool per level, sampled through the SRS
│   ├── srs.js             spaced repetition on localStorage
│   ├── quiz-ui.js         answer UI, shared between both pages
│   ├── practice.js        controller for the Practice page
│   ├── notes.js           in-page notes, local store + sync to site-notes
│   ├── pwa.js             service-worker registration
│   └── test-parser.js     controller for the parser page
├── sw.js                  service worker: offline + install
├── manifest.webmanifest
├── icons/
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

Seven exercises share one page, one answer interface and one spaced-repetition
store. Each declares its variants, whether it needs a key established, how to
generate an item and how to grade it — so adding an eighth means adding an entry
to `exercises.js`, not touching the controller.

| Exercise | Asks | Variants |
|---|---|---|
| Harmonic function | the degree of a chord inside a key | 5 levels, triads → inversions |
| Triads | major, minor, diminished, augmented | block or arpeggiated |
| Seventh chords | the triad *and* the seventh, graded separately | the four common ones, or all six |
| Intervals | the distance between two notes | together · low first · high first · mixed |
| Upper degrees | which degree sits above a sustained root | ♭7–13, or with alterations |
| Metre | how the beat is grouped | 3/4 vs 4/4 · + compound · + odd |
| Modulation | how a second passage relates to the first | the usual moves, or all |

`generate` returns a **descriptor** of the sound (`{kind, …}`) rather than
playing anything; the controller is the only place that turns one into audio.
That is what lets the whole musical layer be tested in Node, without a browser.

**Establishing a key.** Where an exercise needs one, the default plays a short
piece in that key rather than a bare cadence — a melody moving inside the
harmony, which is how a key settles into your ear when you listen to music. The
pieces in `phrases.js` are written in *scale degrees*, so one phrase is exact in
all twelve keys and transposition cannot drift. Cadences (`I–IV–V–I`, `ii–V–I`)
and a drone are still there; the drone is hardest, because it removes the crutch
of short-term memory.

**The key and the voicing are randomised on every exercise.** Without that you
learn absolute timbre instead of function.

Level, context and mode can be changed mid-session, and each exercise remembers
its own variant. Shortcuts: **Enter** checks and then advances, **Space**
replays.

### Two deliberate omissions

- **Diminished with a major seventh** is never generated. It exists on paper and
  not in music, so drilling it would spend your attention on a sound you will
  never need to recognise.
- **Metre and modulation use generated material, not real songs.** The request
  was to play a song; the site has none, because the Songs page is unbuilt and
  the annotated corpora are not redistributable. The grooves and the modulating
  passages are real music-shaped audio — a groove has a bass and chords, not just
  a click — but they are synthesised. Real songs arrive with the Songs page.

## On a phone

The site is a progressive web app: Chrome offers “Install app”, and on iPhone
Share → Add to Home Screen gives an icon, full screen and no browser chrome.
No app store, no second codebase — a native app would buy nothing here, since
everything already runs in the browser.

`sw.js` uses two strategies, picked by what each one risks getting wrong:
navigations are **network-first** (a page cached forever is how you end up stuck
on a stale version without noticing), everything else is **cache-first** —
modules, CSS, Tone.js and the piano samples never change within a version, and
they are the heavy part. After one online session it runs with no connection.
Bump `VERSION` in `sw.js` to ship an update.

The layout below 620px is built for thumbs: every answer chip is at least 44px
tall, the degree, interval and metre fields become four-column grids, the
playback bar sticks to the top while you scroll through the options, and the
settings collapse once you press Start — still showing which exercise you are
on. Selects are 16px because anything smaller makes iOS zoom the page on focus.

## Statistics

A single global accuracy stopped meaning anything once there were seven
exercises: you can be solid on triads and never have touched metre, and one
number cannot tell those apart. Each exercise declares which SRS key families it
produces (`keyPrefixes`), and `srs.statsFor` aggregates over them, so the panel
shows a row per exercise — attempts, accuracy, weakest item. Exercises you have
never tried stay in the list, greyed out, precisely so the gap is visible.

## Notes & ideas

Every page carries a **Notes** button in the bottom-right corner. Open it and
jot down anything you want changed while you are using the site — that is the
moment you actually notice things.

Each note records **when** it was written, **which page** you were on, and, on
the Practice page, **what was on screen at that moment**: level, key, target
chord and tonal context. A note like "this chord sounded wrong" is useless
without knowing which chord it was.

Notes always live in `localStorage` first, so nothing is lost when the network
drops. Getting them *out* is the whole point of the feature, and there are two
routes.

**Sent to the notes database, automatically.** Every new note is sent to the
shared `site-notes` backend (one Cloudflare Worker + D1 for all of Alessio's
sites, repo `alessiomartini/site-notes`, `site = 'ear-training'`), where Claude
reads it and turns it into a `ROADMAP.md` item. It is write-only: no token, and
the page never reads notes back, so ticking or deleting a note here only changes
this browser's copy. If sending fails the note is kept and marked *not sent yet*,
and it is retried on the next visit.

**Manual export**, which works with or without sync:

- **Copy all** puts every note on the clipboard as Markdown, ready to paste
  into a conversation with Claude — one request per note, each with its
  context attached.
- **Download .md** saves the same thing as a file.

Notes can be ticked off as done (they drop to the bottom and stop counting in
the badge) or deleted. Exporting includes both the open and the done ones, so
the done section doubles as a record of what has already been implemented.

Shortcut: **Ctrl/Cmd+Enter** in the box saves the note. Typing in the box never
triggers the Practice keyboard shortcuts.

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

## Security notes

The site is served from `alessiomartini.github.io`, and **`localStorage` is
scoped to the origin, not to the path**. Every GitHub Pages project under that
account shares one storage area, so the notes kept here are readable by
JavaScript running on any of those sites. That is fine as long as they only run
code you wrote — never add a third-party script (an analytics snippet, a CDN
widget, an embed) to any of them.

For the same reason, cross-site scripting anywhere on that origin can read every
site's local data, not just deface a page. `data/songs/xss-probe.lab` is a
regression fixture: a `.lab` whose label smuggles an `<img onerror=…>` through
the `*` (omitted-degree) syntax, which `parseHarte` does not validate. It used
to execute. The display layer now builds DOM nodes and never interpolates data
into `innerHTML`, so it renders as inert text.

The Worker's origin allowlist restricts *browsers*; it is not an access control.
`curl` ignores CORS entirely, so anyone can add a note (there is no rate limit);
but nobody can read, change or delete notes over HTTP: they are read only from
the D1 with Alessio's Cloudflare account.

Notes are stored in plain text in D1. Don't paste anything into the box you
would not want sitting in a third-party database.

## Known limitations

- **`formatHarte` is exact for every `Chord`**, including alterations (`b5`,
  `#5`, `b9`, `#9`, `b13`), `sus` chords with a seventh, `add`-style tensions
  without a seventh, omissions (`*3`, `*5`) and augmented or diminished triads
  with a seventh (`C:aug(b7)`, `C:dim(b7)`). A tension shorthand (`9`, `11`,
  `13`, `maj9`...) is used only when the chord really contains every degree it
  implies, so `C:maj7(13)` and `C:9(13)` stay as they are instead of becoming
  `maj13`. Run `node tests/format-harte.test.mjs` to check the whole space.

- **A major V in a minor key is never used as a target.** The `DIATONIC.minor`
  table in `harmony.js` is the natural minor, and `BORROWED.minor` has no entry
  for degree 7, so `functionOf` would classify it as outside the key — a wrong
  answer to teach. In the cadences, where nothing is graded, the major dominant
  is present. Offering it as a target too would mean extending the
  `harmony.js` tables to the harmonic minor.
- The natural 11 is never offered over major or dominant chords: it is an avoid
  note, and as an ear-training target it teaches nothing useful.

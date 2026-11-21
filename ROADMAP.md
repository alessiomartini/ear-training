# Roadmap

<!-- Single file for todo, ideas, decisions and log, read by Projects Overview (https://alessiomartini.github.io/projects-overview/). Protocol: templates/ROADMAP.md in projects-overview. -->

## Left half-done
- [x] `songs.html`: `js/youtube.js` (IFrame API, [start, end] range, fallback to a plain link)
- [ ] `songs.html`: corpus of real songs (licences to be verified)
- [ ] `songs.html`: offset calibration UI and game modes (the per-song `offset` from `index.json` is already applied)
- [ ] Metre and modulation with real songs instead of generated material
- [x] `formatHarte`: cover all tension combinations
- [x] Centralized feedback (done 2026-10-19: single `site-notes` backend, see Decisions and things tried)

## Ideas

### Ideas to evaluate (not decided)

#### Centralized feedback: a single shared D1 (the shared backend itself was done on 2026-10-19, see below)

Today each of Alessio's sites with the "Notes" feature (this one, `geopolitics-atlas`,
and with a similar pattern also `eating-amsterdam`, `markets-first-principles`,
`realtime-earth`) had its own dedicated Cloudflare D1 database behind its
own Worker (here: `worker/schema.sql`, table `notes`, Worker in
`worker/src`).

An idea to evaluate in the future, **low priority** because the system then
in place worked well, is to consolidate everything into a **single D1 shared
by all the sites**, with a table like:

```sql
notes(id, site, page, text, created_at, ...)
```

where the `site` column tells where a note comes from, behind a single Worker
with a CORS allowlist per domain (instead of a single `ALLOWED_ORIGIN` per
Worker as before).

**Pros:**
- [ ] fewer Cloudflare accounts/infrastructure to maintain (one D1 and one Worker
  instead of N pairs);
- [ ] a single place to read the notes of all the sites.

**Cons:**
- [ ] a bug in the shared Worker would break note collection everywhere, whereas
  each site was isolated: a problem in one does not touch the others;
- [ ] the history already present in each site's existing D1 would have to be migrated.

No action required now: it is only an option to keep in mind if the
maintenance of N separate Workers ever became a real problem. (Outcome: the
single `site-notes` backend was adopted on 2026-10-19.)

## Decisions and things tried

### Notes in the single backend (2026-10-19)

Note synchronization uses `site-notes` (one Worker + D1 for all the sites) instead of the dedicated
Worker `ear-training-notes`: `worker/` removed. A browser that had saved the old address moves to the
new one by itself (`loadSync` in `js/notes.js`), but the token is now the one of `site-notes`. The old worker and
its D1 are switched off by Alessio after the migration. `sw.js` moved to `v2`.

Then, the same day: **send only, no token and no read-back**. Alessio does not need the site to
read the notes: he needs Claude to read them from the D1 and bring them into this ROADMAP. Removed the "Cloud sync" panel
(URL, token, device label), the remote deletions and the read-back from `site-notes`: each new note
is only sent; ticking or deleting it changes the local copy. Old worker and D1 switched off. `sw.js` to `v3`.

This file collects ideas not yet implemented and things left half-done, for
whoever (human or Claude Code session) picks the project up later. It is not a
binding roadmap: the project is **on hold** (see README.md), so everything
here is "if one day it is needed", not planned work.

### Things left half-done

- **`songs.html`** now has `js/youtube.js` and `js/songs.js` (2026-10-31; list from `index.json`, player, segment playback; without network the fallback link appears). Still to do: offset calibration and game modes; a real `.lab` annotation
  corpus is missing (Isophonics / McGill Billboard / RWC have
  licences to be verified before they can be redistributed). See README.md,
  section "Corpus (the Songs page)".
- **Metre and modulation use generated material, not real songs**, for the
  same reason: there is no redistributable annotated corpus yet.
- **`formatHarte`** now covers all combinations (resolved 2026-10-31).
  Choice: the tension shorthand (`9`, `11`, `13`, `maj9`...) is used only if
  the chord really contains all the underlying degrees; otherwise base
  shorthand + degrees in parentheses (`C:9(13)`, `C:maj7(13)`). Seventh on
  dim/aug/sus triads as a degree (`C:aug(b7)`, `C:dim(b7)`). Added `bb7` to the parser
  for the diminished seventh on maj/min triads. Dependency-free test:
  `node tests/format-harte.test.mjs` (344064 combinations + generator
  chords). `sw.js` VERSION brought to v5.

### Dependencies

The project has no `package.json`: it is a static site with no build step (the notes Worker
is now the shared one, repo `site-notes`).
So there is nothing to keep up to date with `npm outdated`: if tools (bundler, linter, test runner)
are introduced in the future, add them here together with how to verify them.

## Log
- 2026-11-21: 🤖 Docs cleanup: README step table and layout match the Songs page code, CLAUDE.md names the site-notes repo as the canonical widget source, ROADMAP translated to English.
- 2026-11-06: note widget v2 canonical (site-notes/widget) replaces js/notes.js (migrates eartraining.notes.v1, context via SiteNotes.setContext, sw v5).
- 2026-10-31: 🤖 added `js/youtube.js` (IFrame API with link fallback) and `js/songs.js`; `songs.html` lists the corpus (empty) and plays the segments; sw.js v6
- 2026-10-31: 🤖 `formatHarte` rewritten to cover all combinations of tensions/alterations/omissions, with exhaustive test `tests/format-harte.test.mjs`
- 2026-10-19: notes synchronized with the single `site-notes` backend; `worker/` removed; then send-only for new notes, no token (Claude reads them from the D1); notes send the author (`?sono-alessio` marks Alessio's browser, the others are visitors')
- 2026-10-18: FUTURE-ARCHITECTURE.md merged into ROADMAP.md (single protocol)
- 2026-10-15: roadmap created for Projects Overview

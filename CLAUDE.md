# Claude Code instructions

## Project

Static browser ear-training application with HTML, CSS, JavaScript, service
worker, and local data files.

## Verification

- Preview with a local HTTP server; do not rely on `file://` for module/service-worker behavior.
- Load the affected page in a browser and check the console for errors.
- Exercise the changed interaction, parser, worker, or offline path manually.
- Keep service-worker cache/version behavior consistent with the existing code.

## Workflow

- Read `README.md` and the relevant page, script, and data file before editing.
- Preserve accessible controls, keyboard behavior, and existing audio/data formats.
- Do not add dependencies or a build step without approval.
- Inspect the diff and report browser verification before committing.
- Check `FUTURE-ARCHITECTURE.md` for open ideas and half-finished parts
  (e.g. `songs.html`, the missing corpus) before proposing new work.

## Worker (`worker/`)

- Plain Cloudflare Worker (`worker/src/index.js`) with a D1 database
  (`worker/schema.sql`, table `notes`), no npm dependencies, no build step.
- Deploy/manage with `wrangler` (see `worker/README.md`); the write token is a
  Wrangler secret (`NOTES_TOKEN`), never committed.
- This is a per-site D1+Worker; do not merge it with another site's database
  without reading the "Feedback centralizzato" section in
  `FUTURE-ARCHITECTURE.md` first — it is an unresolved idea, not a decision.

## Roadmap e progressi

Questo progetto è tracciato in https://alessiomartini.github.io/projects-overview/ tramite il file `ROADMAP.md`
nella root del repo. Mantienilo aggiornato:

- Alla fine di ogni sessione di lavoro (prima del commit finale), aggiorna `ROADMAP.md`:
  - spunta (`- [x]`) i punti completati in questa sessione;
  - aggiungi come `- [ ]` i nuovi compiti emersi, nella fase giusta (titoli `##`);
  - aggiungi in cima alla sezione `## Log` una riga `- AAAA-MM-GG: <cosa è stato fatto, in una frase>`
    (se esiste già una riga con la data di oggi, estendila invece di crearne un'altra).
- Non riscrivere né riordinare le voci esistenti senza motivo; non cancellare le voci completate.
- Se `ROADMAP.md` non esiste, crealo con le fasi `## ...`, le checkbox e una sezione `## Log`.
- Includi l'aggiornamento di `ROADMAP.md` nello stesso commit del lavoro.

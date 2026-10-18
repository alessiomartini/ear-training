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
- Check `ROADMAP.md` for open ideas and half-finished parts
  (e.g. `songs.html`, the missing corpus) before proposing new work.

## Notes sync

- New notes are sent to the shared `site-notes` Worker + D1 (repo `alessiomartini/site-notes`,
  `site = 'ear-training'`, endpoint in `js/notes.js`): write-only, no token. Claude reads them
  from the D1 (procedure in that repo's CLAUDE.md); the page never reads them back.
- Bump `VERSION` in `sw.js` whenever a cached asset changes.

## Roadmap, idee e progressi

`ROADMAP.md` nella root è l'**unico** file per todo, idee, decisioni e diario del progetto
(niente `FUTURE-ARCHITECTURE.md`, `IDEE.md`, `TODO.md`). È letto da https://alessiomartini.github.io/projects-overview/.
Sezioni: `## <fase>` (checkbox, contano nella percentuale), `## Idee` (checkbox, non contano),
`## Decisioni e cose provate` (prosa: scartato/rimandato e perché, provato e annullato, limiti e bug noti), `## Log`.

- Alla fine di ogni sessione di lavoro (prima del commit finale), aggiorna `ROADMAP.md`:
  - spunta (`- [x]`) i punti completati in questa sessione;
  - aggiungi come `- [ ]` i nuovi compiti nella fase giusta, e le idee non decise in `## Idee`;
  - annota in `## Decisioni e cose provate` ciò che è stato scartato, rimandato o annullato, col perché;
  - aggiungi in cima a `## Log` una riga `- AAAA-MM-GG: <cosa è stato fatto, in una frase>`
    (se esiste già una riga con la data di oggi, estendila invece di crearne un'altra).
- Non riscrivere né riordinare le voci esistenti senza motivo; non cancellare le voci completate.
- Se `ROADMAP.md` non esiste, crealo da `templates/ROADMAP.md` di projects-overview.
- Includi l'aggiornamento di `ROADMAP.md` nello stesso commit del lavoro.

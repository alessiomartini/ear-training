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

- Preserve accessible controls, keyboard behavior, and existing audio/data formats.
- Do not add dependencies or a build step without approval.
- Check `ROADMAP.md` for open ideas and half-finished parts
  (e.g. `songs.html`, the missing corpus) before proposing new work.

## Notes sync

- `js/notes-widget.js` is an identical copy of `site-notes/widget/notes-widget.js` (site = `ear-training`).
- Bump `VERSION` in `sw.js` whenever a cached asset changes.

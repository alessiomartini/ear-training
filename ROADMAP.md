# Roadmap

<!--
Unico file per todo, idee, decisioni e diario, letto da Projects Overview
(https://alessiomartini.github.io/projects-overview/). Protocollo: templates/ROADMAP.md di projects-overview.
-->

## Lasciato a metà
- [ ] `songs.html`: manca `js/youtube.js` e un corpus di canzoni vere
- [ ] Metro e modulazione con canzoni vere invece di materiale generato
- [ ] `formatHarte`: coprire tutte le combinazioni di tensioni

## Idee

### Idee da valutare (non decise)

#### Feedback centralizzato (fatto il 2026-10-19: backend unico `site-notes`, vedi sotto)

Oggi ogni sito di Alessio con la feature "Notes" (questo, `geopolitics-atlas`,
e con pattern analogo anche `eating-amsterdam`, `markets-first-principles`,
`realtime-earth`) ha il proprio database Cloudflare D1 dedicato dietro un
proprio Worker (qui: `worker/schema.sql`, tabella `notes`, Worker in
`worker/src`).

Un'idea da valutare in futuro, **a bassa priorità** perché il sistema attuale
funziona bene, è consolidare tutto in un **unico D1 condiviso fra tutti i
siti**, con una tabella tipo:

```sql
notes(id, site, page, text, created_at, ...)
```

dove la colonna `site` distingue la provenienza, dietro un unico Worker con
un'allowlist CORS per dominio (invece di un `ALLOWED_ORIGIN` singolo per
Worker come ora).

**Pro:**
- [ ] meno account/infrastruttura Cloudflare da mantenere (un D1 + un Worker
  invece di N coppie);
- [ ] un solo posto da cui leggere le note di tutti i siti.

**Contro:**
- [ ] un bug nel Worker condiviso romperebbe la raccolta note ovunque, mentre
  oggi ogni sito è isolato: un problema in uno non tocca gli altri;
- [ ] andrebbe migrato lo storico già presente nei D1 esistenti di ciascun sito.

Nessuna azione richiesta ora: è solo un'opzione da tenere presente se in
futuro la manutenzione di N Worker separati diventasse un problema reale.

## Decisioni e cose provate

### Note nel backend unico (2026-10-19)

La sincronizzazione delle note usa `site-notes` (un Worker + D1 per tutti i siti) invece del Worker
dedicato `ear-training-notes`: tolto `worker/`. Un browser che aveva salvato il vecchio indirizzo passa da
solo al nuovo (`loadSync` in `js/notes.js`), ma il token ora è quello di `site-notes`. Il vecchio worker e
il suo D1 li spegne Alessio dopo la migrazione. `sw.js` passato a `v2`.

Poi, lo stesso giorno: **solo invio, niente token né rilettura**. Ad Alessio non serve che il sito
legga le note: serve che Claude le legga dal D1 e le porti in questo ROADMAP. Tolti il pannello "Cloud sync"
(URL, token, etichetta del dispositivo), le cancellazioni remote e la rilettura da `site-notes`: ogni nota
nuova viene solo inviata; spuntarla o cancellarla cambia la copia locale. Vecchio worker e D1 spenti. `sw.js` a `v3`.

Questo file raccoglie idee non ancora implementate e cose lasciate a metà, per
chi (umano o sessione Claude Code) riprende il progetto più avanti. Non è una
roadmap impegnativa: il progetto è **on hold** (vedi README.md), quindi tutto
qui è "se un giorno serve", non lavoro pianificato.

### Cose lasciate a metà

- **`songs.html`** è un placeholder. Manca `js/youtube.js` e manca un corpus
  di annotazioni `.lab` reale (Isophonics / McGill Billboard / RWC hanno
  licenze da verificare prima di poter essere ridistribuiti). Vedi README.md,
  sezione "Corpus (the Songs page)".
- **Metro e modulazione usano materiale generato, non canzoni vere**, per lo
  stesso motivo: non c'è ancora un corpus annotato redistribuibile.
- **`formatHarte`** non copre tutte le combinazioni di tensioni (es. settime
  aumentate, triade diminuita con settima minore) — vedi "Known limitations"
  nel README per i dettagli tecnici già documentati lì.

### Dipendenze

Il progetto non ha `package.json`: è un sito statico senza build step (il Worker
delle note ora è quello condiviso, repo `site-notes`).
Non c'è quindi nulla da tenere aggiornato con `npm outdated` — se in futuro si
introducono strumenti (bundler, linter, test runner), aggiungerli qui insieme
a come verificarli.

## Log
- 2026-10-19: note sincronizzate col backend unico `site-notes`; tolto `worker/`; poi solo invio delle note nuove, niente token (le legge Claude dal D1); le note mandano l'autore (`?sono-alessio` segna il browser di Alessio, le altre sono di visitatori)
- 2026-10-18: FUTURE-ARCHITECTURE.md unito in ROADMAP.md (protocollo unico)
- 2026-10-15: creata la roadmap per Projects Overview

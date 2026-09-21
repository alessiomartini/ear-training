# Architettura futura e idee aperte

Questo file raccoglie idee non ancora implementate e cose lasciate a metà, per
chi (umano o sessione Claude Code) riprende il progetto più avanti. Non è una
roadmap impegnativa: il progetto è **on hold** (vedi README.md), quindi tutto
qui è "se un giorno serve", non lavoro pianificato.

## Cose lasciate a metà

- **`songs.html`** è un placeholder. Manca `js/youtube.js` e manca un corpus
  di annotazioni `.lab` reale (Isophonics / McGill Billboard / RWC hanno
  licenze da verificare prima di poter essere ridistribuiti). Vedi README.md,
  sezione "Corpus (the Songs page)".
- **Metro e modulazione usano materiale generato, non canzoni vere**, per lo
  stesso motivo: non c'è ancora un corpus annotato redistribuibile.
- **`formatHarte`** non copre tutte le combinazioni di tensioni (es. settime
  aumentate, triade diminuita con settima minore) — vedi "Known limitations"
  nel README per i dettagli tecnici già documentati lì.

## Idee da valutare (non decise)

### Feedback centralizzato (idea, non ancora decisa)

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
- meno account/infrastruttura Cloudflare da mantenere (un D1 + un Worker
  invece di N coppie);
- un solo posto da cui leggere le note di tutti i siti.

**Contro:**
- un bug nel Worker condiviso romperebbe la raccolta note ovunque, mentre
  oggi ogni sito è isolato: un problema in uno non tocca gli altri;
- andrebbe migrato lo storico già presente nei D1 esistenti di ciascun sito.

Nessuna azione richiesta ora: è solo un'opzione da tenere presente se in
futuro la manutenzione di N Worker separati diventasse un problema reale.

## Dipendenze

Il progetto non ha `package.json` (né in root né in `worker/`): è un sito
statico senza build step e un Worker Cloudflare scritto senza dipendenze npm.
Non c'è quindi nulla da tenere aggiornato con `npm outdated` — se in futuro si
introducono strumenti (bundler, linter, test runner), aggiungerli qui insieme
a come verificarli.

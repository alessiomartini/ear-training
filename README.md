# Ear Training Armonico

Sito statico per l'allenamento dell'orecchio armonico. Nessun build step,
nessun backend: si apre con un qualsiasi server statico e si pubblica su GitHub
Pages così com'è.

Il principio è quello della specifica: **un accordo è un oggetto assoluto, il
grado è una funzione dell'accordo dato un contesto tonale**. Il grado non viene
mai salvato — si ricalcola. Cambiare la tonalità di un brano rietichetta tutto
il corpus senza toccare le annotazioni.

## Stato

| Punto dell'ordine di sviluppo | Stato |
|---|---|
| 1. `harmony.js` + pagina di test del parser | fatto |
| 2. `audio.js` + `generator.js` + Practice livello 1 | fatto |
| 3. `srs.js` e i livelli 2–5 | fatto |
| 4. `songs.html` con un brano e calibrazione dell'offset | non iniziato |
| 5. Ampliamento del corpus | non iniziato |

`songs.html` esiste come segnaposto e descrive cosa manca. `js/youtube.js` non
c'è ancora.

## Struttura

```
/
├── index.html
├── practice.html          allenamento su accordi sintetizzati
├── songs.html             segnaposto, punto 4
├── test-parser.html       verifica di parseHarte su un .lab reale
├── js/
│   ├── harmony.js         core armonico (Chord · Function · Grading)
│   ├── audio.js           Tone.js: cadenza, drone, accordo
│   ├── generator.js       pool di accordi per livello, campionato via SRS
│   ├── srs.js             ripetizione spaziata su localStorage
│   ├── quiz-ui.js         UI di risposta, condivisa fra le due pagine
│   ├── practice.js        controller della pagina Practice
│   └── test-parser.js     controller della pagina di verifica
├── data/songs/
│   ├── index.json         elenco brani (vuoto, vedi "Corpus")
│   └── sample.lab         annotazione sintetica per provare il parser
└── css/style.css
```

## Come provarlo

Il sito carica moduli ES e fa `fetch()`, quindi non funziona da `file://`.
Serve la cartella via HTTP:

```
python3 -m http.server 8000
```

e apri `http://localhost:8000/`. Su GitHub Pages basta puntare Pages alla
radice del branch: non c'è niente da compilare.

Serve la rete al primo avvio: Tone.js arriva da unpkg e i campioni di
pianoforte (Salamander Grand, CC) da `tonejs.github.io`. Se i campioni non
arrivano entro nove secondi si passa a un `PolySynth`; se manca proprio Tone.js
la pagina lo dice invece di restare in caricamento.

## Practice

Il ciclo è: si stabilisce la tonalità, si suona il bersaglio, si risponde, si
corregge campo per campo.

**Contesto tonale** — cadenza `I–IV–V–I`, cadenza `ii–V–I`, oppure drone sulla
tonica. Il drone è più difficile e più formativo: toglie l'appiglio della
memoria a breve termine. In minore la dominante della cadenza è maggiore
(minore armonica), altrimenti la tonalità non si stabilisce.

**Tonalità e voicing sono randomizzati a ogni esercizio.** Senza questo si
impara il timbro assoluto invece della funzione.

**Livelli** — cumulativi nei campi valutati:

| # | Contenuto | Campi valutati |
|---|---|---|
| 1 | triadi diatoniche | grado, qualità |
| 2 | settime diatoniche | + settima |
| 3 | none, undicesime, tredicesime | + estensioni |
| 4 | prestiti modali, dominanti secondarie | + fuori tonalità |
| 5 | rivolti e voicing sparsi | + rivolto |

Livello, contesto e modo si cambiano durante la sessione, e restano memorizzati.
Scorciatoie: **Invio** verifica e poi passa al prossimo, **Spazio** riascolta
l'accordo.

## Ripetizione spaziata

È la differenza fra un giocattolo e uno strumento che fa migliorare, quindi vale
la pena dire come funziona.

Un *item* non è un accordo: è un **campo sbagliabile**, nella forma che produce
`harmony.itemKeyFor` — `degree:bVI`, `seventh:maj7`, `extensions:9+13`,
`inversion:2`. Lo stesso accordo alimenta più item insieme, così la debolezza su
un campo emerge indipendentemente dagli altri. Per ogni item si tiene
`{ seen, correct, lastSeen }` in `localStorage`, e il peso di campionamento è

```
peso = (FLOOR + (1 - accuratezza)) * recency(lastSeen)
```

con `recency` che risale da 0.25 a 1 con costante di tempo di sei ore. Un item
appena visto è temporaneamente meno probabile; uno lasciato da parte torna a
galla da solo. `FLOOR` tiene in circolo anche quelli padroneggiati.

Il generatore costruisce il pool del livello nella tonalità sorteggiata, somma i
pesi degli item che ogni candidato metterebbe alla prova e campiona in
proporzione. In prova, sbagliando sistematicamente `seventh:maj7`, la quota di
accordi con settima maggiore sale dal 29% al 57% in un centinaio di esercizi.

## Corpus (pagina Songs)

Il repository **non contiene annotazioni dei corpora**. Isophonics, McGill
Billboard e RWC hanno termini d'uso propri, da verificare e citare prima di
ridistribuirli. L'unico `.lab` presente, `data/songs/sample.lab`, è sintetico:
serve solo a esercitare i casi limite del parser.

La pagina `test-parser.html` accetta un file dal disco: se hai una tua copia di
Isophonics puoi verificarci il parser senza che il file esca dal browser.

## Modifiche a `harmony.js`

Il modulo è arrivato già scritto e testato. Sono state fatte due aggiunte, solo
additive — nessun comportamento esistente cambia:

1. **`gradeAnswer` accetta il campo `outOfKey`.** La tabella dei livelli della
   specifica lo prevede al livello 4, ma lo `switch` non aveva il caso e il
   campo sarebbe stato ignorato in silenzio.
2. **`itemKeyFor` è esportata.** `gradeAnswer` restituisce le chiavi solo dei
   campi *sbagliati*; per calcolare un'accuratezza servono anche i `seen` di
   quelli giusti, e senza questa export il chiamante avrebbe dovuto duplicare la
   costruzione delle chiavi.

## Cose sapute

- **`formatHarte` non sa esprimere ogni combinazione di tensioni.** `C:maj7(13)`
  torna indietro come `C:maj13`, che sottintende anche la nona e l'undicesima.
  Non tocca la correzione, che lavora sull'oggetto `Chord` e non sulla stringa:
  riguarda solo l'etichetta mostrata a schermo, che infatti è affiancata da una
  descrizione in italiano generata dai campi. Il generatore evita comunque il
  caso peggiore producendo la nona ogni volta che produce l'undicesima o la
  tredicesima — che è poi la convenzione reale. La pagina del parser segnala
  queste righe in giallo.
- **`formatHarte` non ha un'abbreviazione per le settime aumentate o per una
  triade diminuita con settima minore**: le serializza come `7` o `maj7`,
  perdendo la qualità. Il generatore non le produce, quindi nell'app non
  succede, ma la funzione resta esposta.
- **La V maggiore in tonalità minore non viene proposta come bersaglio.** La
  tabella `DIATONIC.minor` di `harmony.js` è il minore naturale e `BORROWED.minor`
  non contiene il grado 7, quindi `functionOf` la classificherebbe come estranea
  alla tonalità — risposta sbagliata da insegnare. Nelle cadenze, dove non viene
  corretta, la dominante maggiore c'è. Per proporla anche come bersaglio
  servirebbe estendere le tabelle di `harmony.js` al minore armonico.
- L'11 naturale non viene mai proposta su accordi maggiori o di dominante: è una
  nota da evitare e come bersaglio d'ascolto non insegna niente di utile.

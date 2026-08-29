/**
 * Service worker: rende il sito installabile e utilizzabile offline.
 *
 * Due strategie, scelte per il rischio che comportano:
 *
 *  - **Navigazioni: rete prima.** Una pagina servita dalla cache per sempre e'
 *    il modo classico di restare bloccati su una versione vecchia senza
 *    accorgersene. Si va in rete, e la cache interviene solo se la rete manca.
 *  - **Tutto il resto: cache prima.** Moduli, CSS, Tone.js e i campioni di
 *    pianoforte non cambiano mai a parita' di versione, e sono la parte pesante:
 *    prenderli dalla cache e' cio' che rende l'app istantanea e utilizzabile
 *    senza rete dopo la prima sessione.
 *
 * Cambiare VERSION invalida tutto: e' la leva per pubblicare un aggiornamento.
 */

const VERSION = 'v1';
const SHELL = `shell-${VERSION}`;
const ASSETS = `assets-${VERSION}`;

const SHELL_FILES = [
  './', './index.html', './practice.html', './songs.html', './test-parser.html',
  './css/style.css', './favicon.svg', './manifest.webmanifest',
  './js/harmony.js', './js/audio.js', './js/generator.js', './js/exercises.js',
  './js/phrases.js', './js/srs.js', './js/quiz-ui.js', './js/practice.js',
  './js/notes.js', './js/test-parser.js', './js/pwa.js',
  './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      // addAll fallisce in blocco se un solo file manca: qui si preferisce
      // installare cio' che c'e' piuttosto che non installare niente.
      .then((c) => Promise.allSettled(SHELL_FILES.map((f) => c.add(f))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

const isAudioCdn = (url) =>
  url.hostname === 'tonejs.github.io' || url.hostname === 'unpkg.com';

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  // Le pagine: rete prima, cache come rete di sicurezza.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit ?? caches.match('./index.html'))),
    );
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !isAudioCdn(url)) return;

  event.respondWith(
    caches.match(request).then((hit) => hit ?? fetch(request).then((res) => {
      // Le risposte opache (campioni cross-origin senza CORS) si mettono in
      // cache lo stesso: senza, l'audio non funzionerebbe offline.
      if (res.ok || res.type === 'opaque') {
        const copy = res.clone();
        caches.open(sameOrigin ? SHELL : ASSETS).then((c) => c.put(request, copy));
      }
      return res;
    }).catch(() => hit)),
  );
});

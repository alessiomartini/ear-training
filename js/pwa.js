/**
 * pwa.js — registrazione del service worker.
 *
 * Lo scope e' la cartella del sito (`/ear-training/`), non l'origine: sullo
 * stesso dominio ci sono altri progetti, e non devono finire in questa cache.
 *
 * Se in futuro serve disinstallarlo, dalla console del browser:
 *   navigator.serviceWorker.getRegistrations().then(r => r.forEach(x => x.unregister()))
 */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { scope: './' }).then((reg) => {
      // Una nuova versione pronta prende il posto della vecchia al reload
      // successivo, senza chiedere niente all'utente.
      reg.addEventListener('updatefound', () => {
        reg.installing?.addEventListener('statechange', function () {
          if (this.state === 'installed' && navigator.serviceWorker.controller) {
            reg.waiting?.postMessage('skip-waiting');
          }
        });
      });
    }).catch(() => { /* niente offline: il sito funziona lo stesso */ });
  });
}

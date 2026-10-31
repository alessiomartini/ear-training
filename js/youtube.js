/**
 * youtube.js — riproduzione di un intervallo [start, end] di un video YouTube
 * con la IFrame Player API (nessuna chiave API).
 *
 * Degrada con garbo: se l'API non si carica (offline, bloccata, timeout) o il
 * player da' errore, al posto dell'iframe compare un normale link al video
 * (con `&t=` sull'istante richiesto). Nessuna dipendenza, ES module.
 *
 *   const yt = createYouTubePlayer(container, { videoId });
 *   yt.playRange(12.5, 17.3);     // oppure yt.play(exercise.audio)
 *   yt.onTime((t) => ...);        // callback ~4 volte al secondo mentre suona
 *   yt.destroy();
 */

const API_SRC = 'https://www.youtube.com/iframe_api';
const API_TIMEOUT_MS = 8000;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export const isValidVideoId = (id) => typeof id === 'string' && VIDEO_ID.test(id);

export const watchUrl = (videoId, start = 0) =>
  `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
  + (start > 0 ? `&t=${Math.floor(start)}s` : '');

let apiPromise = null;

/** Carica l'API una sola volta. Rifiuta (non lancia) se non disponibile. */
export function loadYouTubeApi() {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    if (window.YT && window.YT.Player) { resolve(window.YT); return; }
    if (navigator.onLine === false) { reject(new Error('offline')); return; }
    const timer = setTimeout(() => reject(new Error('timeout')), API_TIMEOUT_MS);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer);
      if (typeof previous === 'function') previous();
      resolve(window.YT);
    };
    const s = document.createElement('script');
    s.src = API_SRC;
    s.async = true;
    s.onerror = () => { clearTimeout(timer); reject(new Error('script')); };
    document.head.appendChild(s);
  });
  // Un nuovo tentativo e' possibile dopo un fallimento (es. tornata la rete).
  apiPromise.catch(() => { apiPromise = null; });
  return apiPromise;
}

/**
 * @param {HTMLElement} container  riceve l'iframe oppure il link di ripiego
 * @param {{videoId:string, title?:string}} opts
 */
export function createYouTubePlayer(container, { videoId, title = 'Song recording' } = {}) {
  const listeners = new Set();
  let player = null;
  let failed = false;
  let range = null;
  let pending = null;
  let poll = null;
  let destroyed = false;

  const mount = document.createElement('div');
  mount.className = 'yt-mount';
  container.replaceChildren(mount);

  function stopPoll() { if (poll) { clearInterval(poll); poll = null; } }

  function fallback(reason, start = 0) {
    failed = true;
    stopPoll();
    const p = document.createElement('p');
    p.className = 'muted yt-fallback';
    p.setAttribute('role', 'status');
    if (!isValidVideoId(videoId)) {
      p.textContent = 'This song has no valid video id.';
    } else {
      p.append(`The embedded player is not available (${reason}). `);
      const a = document.createElement('a');
      a.href = watchUrl(videoId, start);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = 'Open the recording on YouTube';
      p.append(a, '.');
    }
    container.replaceChildren(p);
  }

  function tick() {
    if (!player || !range) return;
    const t = player.getCurrentTime();
    listeners.forEach((f) => f(t));
    if (t >= range.end) { player.pauseVideo(); range = null; stopPoll(); }
  }

  function startRange(start, end) {
    range = { start, end };
    player.seekTo(start, true);
    player.playVideo();
    stopPoll();
    poll = setInterval(tick, 250);
  }

  if (!isValidVideoId(videoId)) {
    fallback('invalid video id');
  } else {
    loadYouTubeApi().then((YT) => {
      if (destroyed) return;
      player = new YT.Player(mount, {
        videoId,
        host: 'https://www.youtube-nocookie.com',
        width: '100%',
        height: '360',
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: location.origin },
        events: {
          onReady: (e) => {
            // Titolo accessibile sull'iframe, e resta raggiungibile da tastiera.
            try { e.target.getIframe().title = title; } catch { /* ignora */ }
            if (pending) { startRange(pending.start, pending.end); pending = null; }
          },
          onError: () => fallback('the video cannot be played here', range?.start ?? pending?.start ?? 0),
        },
      });
    }).catch((err) => { if (!destroyed) fallback(err.message, pending?.start ?? 0); });
  }

  return {
    get failed() { return failed; },
    playRange(start, end) {
      if (failed || destroyed) return false;
      if (!(end > start) || start < 0) throw new RangeError('invalid range');
      if (player && player.seekTo) startRange(start, end);
      else pending = { start, end };
      return true;
    },
    /** Accetta il campo `audio` di un esercizio {type:'youtube', start, end}. */
    play(audio) { return this.playRange(audio.start, audio.end); },
    pause() { stopPoll(); range = null; pending = null; if (player?.pauseVideo) player.pauseVideo(); },
    getTime() { return player?.getCurrentTime ? player.getCurrentTime() : 0; },
    onTime(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    destroy() {
      destroyed = true; stopPoll(); listeners.clear();
      try { player?.destroy(); } catch { /* ignora */ }
      container.replaceChildren();
    },
  };
}

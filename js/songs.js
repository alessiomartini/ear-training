/**
 * songs.js — pagina Songs: elenco da data/songs/index.json, player YouTube e
 * riproduzione dei singoli segmenti annotati. Il corpus e' vuoto di proposito.
 */
import { parseLab, formatHarte } from './harmony.js';
import { createYouTubePlayer } from './youtube.js';

const $ = (s) => document.querySelector(s);
let player = null;

function el(tag, props = {}, ...kids) {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids);
  return n;
}

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

async function openSong(song) {
  const status = $('#song-status');
  const segBox = $('#segments');
  player?.destroy();
  segBox.replaceChildren();
  status.textContent = 'Loading…';
  try {
    const text = await (await fetch(`data/songs/${song.lab}`)).text();
    const offset = Number(song.offset) || 0;
    const segs = parseLab(text).filter((s) => s.chord && s.end - s.start > 0);
    player = createYouTubePlayer($('#player'), {
      videoId: song.videoId, title: `${song.title} — ${song.artist}`,
    });
    const list = el('ul', { className: 'seg-list' });
    for (const s of segs) {
      const label = formatHarte(s.chord);
      const b = el('button', { type: 'button', className: 'btn btn-ghost' },
        `${s.start.toFixed(1)} s · ${label}`);
      b.addEventListener('click', () => player.playRange(Math.max(0, s.start + offset), s.end + offset));
      list.append(el('li', {}, b));
    }
    segBox.append(list);
    status.textContent = `${song.title} — ${song.artist} (${segs.length} segments)`;
  } catch (err) {
    status.textContent = `Could not open this song: ${err.message}`;
  }
}

async function init() {
  const holder = $('#song-list');
  let songs = [];
  try { songs = (await fetchJson('data/songs/index.json')).songs ?? []; }
  catch (err) { holder.textContent = `Song list unavailable: ${err.message}`; return; }

  if (!songs.length) {
    holder.textContent = 'No songs yet: the corpus is empty on purpose (see below).';
    return;
  }
  const list = el('ul', { className: 'seg-list' });
  for (const song of songs) {
    const b = el('button', { type: 'button', className: 'btn' }, `${song.title} — ${song.artist}`);
    b.addEventListener('click', () => openSong(song));
    list.append(el('li', {}, b));
  }
  holder.replaceChildren(list);
  $('#song-panel').hidden = false;
}

init();

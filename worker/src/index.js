/**
 * Worker che fa da ponte fra il sito e il database D1 delle note.
 *
 * Serve perche' D1 non e' scrivibile dal browser: l'API di Cloudflare vuole un
 * token d'account, e su un sito statico pubblico quel token sarebbe in chiaro
 * nel sorgente. Il Worker tiene il segreto lato server ed espone solo le quattro
 * operazioni che servono.
 *
 * L'autenticazione e' un singolo token di scrittura (`NOTES_TOKEN`, un secret),
 * che si incolla una volta per browser nel pannello delle note del sito. Non e'
 * multiutente e non vuole esserlo: serve solo a impedire che un passante scriva
 * nel database. Chi legge le note non passa di qui — legge D1 direttamente.
 *
 *   POST   /notes        crea o aggiorna (upsert sull'id generato dal client)
 *   GET    /notes        elenco, piu' recenti prima
 *   PATCH  /notes/:id    cambia solo `done`
 *   DELETE /notes/:id
 */

const MAX_TEXT = 4000;
const MAX_CONTEXT = 500;
const MAX_PAGE = 120;
const MAX_DEVICE = 80;
const MAX_LIMIT = 500;

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || '*';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    try {
      if (!env.DB) return json({ error: 'D1 binding "DB" not configured' }, 500, origin);
      if (!env.NOTES_TOKEN) return json({ error: 'NOTES_TOKEN secret not set' }, 500, origin);
      if (!authorized(request, env.NOTES_TOKEN)) {
        return json({ error: 'unauthorized' }, 401, origin);
      }

      const url = new URL(request.url);
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] !== 'notes') return json({ error: 'not found' }, 404, origin);
      const id = parts[1] ?? null;

      if (request.method === 'GET' && !id) return list(url, env, origin);
      if (request.method === 'POST' && !id) return upsert(request, env, origin);
      if (request.method === 'PATCH' && id) return patch(id, request, env, origin);
      if (request.method === 'DELETE' && id) return remove(id, env, origin);

      return json({ error: 'method not allowed' }, 405, origin);
    } catch (err) {
      return json({ error: String(err?.message ?? err) }, 500, origin);
    }
  },
};

// ---------------------------------------------------------------------------

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const json = (body, status, origin) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });

/** Confronto a tempo costante: la lunghezza trapela comunque, il contenuto no. */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authorized(request, token) {
  const header = request.headers.get('Authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? safeEqual(match[1].trim(), token) : false;
}

const clamp = (value, max) =>
  value === null || value === undefined ? null : String(value).slice(0, max);

// ---------------------------------------------------------------------------

async function list(url, env, origin) {
  const limit = Math.min(Number(url.searchParams.get('limit')) || MAX_LIMIT, MAX_LIMIT);
  const since = Number(url.searchParams.get('since')) || 0;

  const { results } = await env.DB
    .prepare(`SELECT id, text, created_at, page, context, done, device
              FROM notes WHERE created_at >= ?1
              ORDER BY created_at DESC LIMIT ?2`)
    .bind(since, limit)
    .all();

  return json({
    notes: (results ?? []).map((r) => ({ ...r, done: Boolean(r.done) })),
  }, 200, origin);
}

async function upsert(request, env, origin) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400, origin);
  }

  const id = clamp(body.id, 64);
  const text = clamp(body.text, MAX_TEXT);
  if (!id || !text || !text.trim()) return json({ error: 'id and text are required' }, 400, origin);

  const createdAt = Number.isFinite(body.at) ? Math.trunc(body.at) : Date.now();

  await env.DB
    .prepare(`INSERT INTO notes (id, text, created_at, page, context, done, device, received_at)
              VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
              ON CONFLICT(id) DO UPDATE SET
                text = excluded.text,
                page = excluded.page,
                context = excluded.context,
                done = excluded.done`)
    .bind(
      id,
      text.trim(),
      createdAt,
      clamp(body.page, MAX_PAGE),
      clamp(body.context, MAX_CONTEXT),
      body.done ? 1 : 0,
      clamp(body.device, MAX_DEVICE),
      Date.now(),
    )
    .run();

  return json({ ok: true, id }, 200, origin);
}

async function patch(id, request, env, origin) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400, origin);
  }
  const { meta } = await env.DB
    .prepare('UPDATE notes SET done = ?1 WHERE id = ?2')
    .bind(body.done ? 1 : 0, id)
    .run();

  if (!meta?.changes) return json({ error: 'not found' }, 404, origin);
  return json({ ok: true, id }, 200, origin);
}

async function remove(id, env, origin) {
  const { meta } = await env.DB.prepare('DELETE FROM notes WHERE id = ?1').bind(id).run();
  if (!meta?.changes) return json({ error: 'not found' }, 404, origin);
  return json({ ok: true, id }, 200, origin);
}

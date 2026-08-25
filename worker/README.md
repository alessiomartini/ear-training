# Notes Worker

Bridges the site's notes box to a Cloudflare D1 database, so the notes can be
read from outside the browser — no copy-paste.

D1 is not writable from a browser: its API needs an account token, which on a
public static site would sit in plain sight in the source. This Worker holds the
secret server-side and exposes only four operations.

## Deploy

```sh
npm install -g wrangler        # if you don't have it
wrangler login

# 1. The database already exists and wrangler.toml already points at it:
#      ear-training-notes  a115be8d-df95-4279-8b3e-d6d143a86e41
#    The tables are already created too, so steps 1-3 of a fresh setup are done.

# 2. Set the write token — any long random string; you paste the same one
#    into the site's notes panel on each browser you write from
wrangler secret put NOTES_TOKEN

# 3. Ship it
wrangler deploy
```

`wrangler deploy` prints the Worker URL. Put that URL and the token into the
site: **Notes → Cloud sync → Worker URL / Write token → Save**.

If you publish the site somewhere other than
`https://alessiomartini.github.io`, change `ALLOWED_ORIGIN` in `wrangler.toml`
and redeploy, or the browser will block the requests.

## API

Every request needs `Authorization: Bearer <NOTES_TOKEN>`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/notes` | create or update — upsert on the client-generated `id`, so retries never duplicate |
| `GET` | `/notes?since=&limit=` | list, newest first |
| `PATCH` | `/notes/:id` | set `done` |
| `DELETE` | `/notes/:id` | remove |

## Security, honestly

One shared write token, no user accounts. It stops a passer-by from writing to
your database; it is not a permission system. Anyone holding the token can read
and write every note. The token lives in `localStorage` on each browser you
write from — never in the site's source.

Text is capped (4000 chars per note, 500 for the context line) and the origin is
restricted, but there is no rate limiting: if the URL and token ever leak,
rotate the secret with `wrangler secret put NOTES_TOKEN` and re-save it in the
panel.

Reading does not go through this Worker at all — the D1 database is queried
directly through the Cloudflare connector.

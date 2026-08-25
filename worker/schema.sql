-- Schema D1 per le note del sito.
--
-- La chiave primaria e' l'id generato dal client: rende l'inserimento
-- idempotente, quindi un retry dopo un errore di rete non duplica la nota.

CREATE TABLE IF NOT EXISTS notes (
  id          TEXT PRIMARY KEY,
  text        TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,          -- millisecondi, orologio del client
  page        TEXT,                      -- practice.html, index.html, ...
  context     TEXT,                      -- livello, tonalita', accordo bersaglio
  done        INTEGER NOT NULL DEFAULT 0,
  device      TEXT,                       -- etichetta libera, per capire da dove arriva
  received_at INTEGER NOT NULL           -- millisecondi, orologio del Worker
);

CREATE INDEX IF NOT EXISTS notes_by_date ON notes (created_at DESC);
CREATE INDEX IF NOT EXISTS notes_by_state ON notes (done, created_at DESC);

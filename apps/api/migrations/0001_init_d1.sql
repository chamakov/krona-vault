-- KRONA VAULT — Inicialización de Persistencia Serverless en Cloudflare D1
CREATE TABLE IF NOT EXISTS vault_state (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

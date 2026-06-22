CREATE TABLE IF NOT EXISTS hub_entidades (
  tipo TEXT NOT NULL,
  id TEXT NOT NULL,
  dados JSONB NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tipo, id)
);

CREATE INDEX IF NOT EXISTS ix_hub_entidades_tipo ON hub_entidades(tipo);

CREATE TABLE IF NOT EXISTS hub_configuracoes (
  chave TEXT PRIMARY KEY,
  dados JSONB NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

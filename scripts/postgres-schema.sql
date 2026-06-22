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

UPDATE hub_entidades
SET dados = jsonb_set(
  jsonb_set(
    dados,
    '{apiSql}',
    COALESCE(dados->'apiSql', '{}'::jsonb) || jsonb_build_object(
      'id', COALESCE(dados->'apiSql'->>'id', 'api-sql-' || id),
      'parametrosTeste', COALESCE(dados->'apiSql'->'parametrosTeste', '{"pagina":1,"pageSize":500}'::jsonb),
      'dataAtualizacao', NOW()::text
    ),
    true
  ),
  '{regras}',
  COALESCE(dados->'regras', '{}'::jsonb) || jsonb_build_object(
    'paginacaoPermitida', COALESCE((dados->'regras'->>'paginacaoPermitida')::boolean, true),
    'quantidadeMaximaPorPagina', COALESCE((dados->'regras'->>'quantidadeMaximaPorPagina')::int, 200),
    'timeoutMs', COALESCE((dados->'regras'->>'timeoutMs')::int, 30000)
  ),
  true
),
atualizado_em = NOW()
WHERE tipo = 'apis'
  AND (
    dados->'apiSql'->'parametrosTeste' IS NULL
    OR dados->'regras' IS NULL
    OR dados->'regras'->>'paginacaoPermitida' IS NULL
    OR dados->'regras'->>'quantidadeMaximaPorPagina' IS NULL
  );

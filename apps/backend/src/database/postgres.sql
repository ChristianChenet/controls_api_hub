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

-- Modulo de Integracoes: estrutura independente para preservar compatibilidade com o API Hub existente.
CREATE TABLE IF NOT EXISTS integracoes (
  id UUID PRIMARY KEY,
  empresa_id TEXT NOT NULL,
  provedor TEXT NOT NULL,
  nome TEXT NOT NULL,
  url_base TEXT NOT NULL,
  status TEXT NOT NULL,
  intervalo_minutos INTEGER NOT NULL DEFAULT 15,
  limite_por_lote INTEGER NOT NULL DEFAULT 200,
  token_configurado BOOLEAN NOT NULL DEFAULT FALSE,
  ultimo_cursor TIMESTAMPTZ,
  ultima_sincronizacao TIMESTAMPTZ,
  ultimo_sucesso TIMESTAMPTZ,
  ultima_falha TIMESTAMPTZ,
  total_registros INTEGER NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empresa_id, provedor)
);

CREATE TABLE IF NOT EXISTS credenciais_integracao (
  integracao_id UUID PRIMARY KEY REFERENCES integracoes(id) ON DELETE CASCADE,
  segredo_criptografado TEXT NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS execucoes_integracao (
  id UUID PRIMARY KEY,
  integracao_id UUID NOT NULL REFERENCES integracoes(id) ON DELETE CASCADE,
  empresa_id TEXT NOT NULL,
  tipo TEXT NOT NULL,
  status TEXT NOT NULL,
  iniciada_em TIMESTAMPTZ NOT NULL,
  finalizada_em TIMESTAMPTZ,
  duracao_ms INTEGER,
  registros_recebidos INTEGER NOT NULL DEFAULT 0,
  registros_inseridos INTEGER NOT NULL DEFAULT 0,
  registros_atualizados INTEGER NOT NULL DEFAULT 0,
  lotes_processados INTEGER NOT NULL DEFAULT 0,
  mensagem TEXT,
  codigo_erro TEXT
);

CREATE TABLE IF NOT EXISTS logs_integracao (
  id UUID PRIMARY KEY,
  integracao_id UUID NOT NULL REFERENCES integracoes(id) ON DELETE CASCADE,
  execucao_id UUID REFERENCES execucoes_integracao(id) ON DELETE SET NULL,
  empresa_id TEXT NOT NULL,
  nivel TEXT NOT NULL,
  evento TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  status_http INTEGER,
  duracao_ms INTEGER,
  detalhes JSONB,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alertas_integracao (
  id UUID PRIMARY KEY,
  integracao_id UUID NOT NULL REFERENCES integracoes(id) ON DELETE CASCADE,
  empresa_id TEXT NOT NULL,
  severidade TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  lido BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolvido_em TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS dados_integracao (
  id UUID PRIMARY KEY,
  integracao_id UUID NOT NULL REFERENCES integracoes(id) ON DELETE CASCADE,
  empresa_id TEXT NOT NULL,
  tipo TEXT NOT NULL,
  chave_externa TEXT NOT NULL,
  data_referencia TIMESTAMPTZ,
  conteudo JSONB NOT NULL,
  excluido BOOLEAN NOT NULL DEFAULT FALSE,
  excluido_em TIMESTAMPTZ,
  excluido_por TEXT,
  excluido_por_nome TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (integracao_id, tipo, chave_externa)
);

-- Auditoria idempotente da aprovação do pedido após a nota passar pelo caixa.
CREATE TABLE IF NOT EXISTS aprovacoes_gmobii (
  id UUID PRIMARY KEY,
  integracao_id UUID NOT NULL,
  empresa_id TEXT NOT NULL,
  pedido_gmobii TEXT NOT NULL,
  estab INTEGER NOT NULL,
  id_carrinho INTEGER NOT NULL,
  id_nota TEXT NOT NULL,
  passou_caixa TEXT NOT NULL DEFAULT 'S',
  status TEXT NOT NULL,
  tentativas INTEGER NOT NULL DEFAULT 0,
  status_http INTEGER,
  resposta JSONB,
  mensagem TEXT,
  primeira_deteccao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultima_tentativa TIMESTAMPTZ,
  concluido_em TIMESTAMPTZ,
  UNIQUE (integracao_id, estab, id_carrinho, id_nota)
);

CREATE INDEX IF NOT EXISTS ix_aprovacoes_gmobii_pendentes
  ON aprovacoes_gmobii (empresa_id, status, ultima_tentativa);

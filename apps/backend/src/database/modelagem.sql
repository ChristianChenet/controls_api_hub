-- Control S API Hub - modelagem base para SQL Server / LocalDB
-- Todas as entidades foram pensadas para multiempresa, versionamento e auditoria.

CREATE TABLE clientes (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
  nome_empresa NVARCHAR(180) NOT NULL,
  nome_fantasia NVARCHAR(120) NOT NULL,
  cnpj NVARCHAR(18) NOT NULL,
  codigo_interno NVARCHAR(60) NOT NULL,
  responsavel NVARCHAR(120) NOT NULL,
  email NVARCHAR(160) NOT NULL,
  telefone NVARCHAR(40) NULL,
  ambiente NVARCHAR(30) NOT NULL,
  status NVARCHAR(30) NOT NULL,
  observacoes NVARCHAR(MAX) NULL,
  dominio_principal NVARCHAR(180) NULL,
  subdominio_api NVARCHAR(180) NULL,
  criado_em DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  atualizado_em DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE conexoes_banco (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
  cliente_id UNIQUEIDENTIFIER NOT NULL REFERENCES clientes(id),
  nome NVARCHAR(120) NOT NULL,
  tipo_banco NVARCHAR(30) NOT NULL,
  host NVARCHAR(180) NOT NULL,
  porta INT NOT NULL,
  banco_ou_servico NVARCHAR(260) NOT NULL,
  usuario NVARCHAR(120) NOT NULL,
  senha_criptografada VARBINARY(MAX) NOT NULL,
  ambiente NVARCHAR(30) NOT NULL,
  status NVARCHAR(30) NOT NULL,
  observacoes NVARCHAR(MAX) NULL,
  criado_em DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE apis (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
  cliente_id UNIQUEIDENTIFIER NOT NULL REFERENCES clientes(id),
  conexao_id UNIQUEIDENTIFIER NOT NULL REFERENCES conexoes_banco(id),
  nome NVARCHAR(160) NOT NULL,
  codigo_interno NVARCHAR(80) NOT NULL,
  descricao NVARCHAR(MAX) NOT NULL,
  versao NVARCHAR(30) NOT NULL,
  categoria NVARCHAR(80) NOT NULL,
  status NVARCHAR(30) NOT NULL,
  metodo_http NVARCHAR(12) NOT NULL,
  endpoint NVARCHAR(240) NOT NULL,
  origem_dados NVARCHAR(120) NOT NULL,
  tipo_execucao NVARCHAR(40) NOT NULL,
  autenticacao NVARCHAR(40) NOT NULL,
  paginacao_habilitada BIT NOT NULL DEFAULT 1,
  sql_base NVARCHAR(MAX) NOT NULL,
  regras_json NVARCHAR(MAX) NOT NULL,
  criado_em DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  ultima_publicacao DATETIME2 NULL
);

CREATE TABLE api_parametros (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
  api_id UNIQUEIDENTIFIER NOT NULL REFERENCES apis(id),
  nome_tecnico NVARCHAR(80) NOT NULL,
  nome_publico NVARCHAR(80) NOT NULL,
  tipo NVARCHAR(30) NOT NULL,
  obrigatorio BIT NOT NULL DEFAULT 0,
  origem NVARCHAR(30) NOT NULL,
  descricao NVARCHAR(500) NOT NULL,
  exemplo NVARCHAR(250) NULL,
  validacao NVARCHAR(500) NULL,
  mascara NVARCHAR(80) NULL,
  normalizacao NVARCHAR(80) NULL,
  valor_padrao NVARCHAR(250) NULL
);

CREATE TABLE api_campos_publicos (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
  api_id UNIQUEIDENTIFIER NOT NULL REFERENCES apis(id),
  origem NVARCHAR(120) NOT NULL,
  nome_publico NVARCHAR(120) NOT NULL,
  tipo NVARCHAR(30) NOT NULL,
  descricao NVARCHAR(500) NOT NULL,
  exemplo NVARCHAR(250) NULL
);

CREATE TABLE tokens_acesso (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
  cliente_id UNIQUEIDENTIFIER NOT NULL REFERENCES clientes(id),
  nome NVARCHAR(120) NOT NULL,
  parceiro NVARCHAR(160) NOT NULL,
  token_hash VARBINARY(64) NOT NULL,
  token_mascarado NVARCHAR(80) NOT NULL,
  status NVARCHAR(30) NOT NULL,
  expira_em DATETIME2 NULL,
  observacao NVARCHAR(MAX) NULL,
  criado_em DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE logs_chamadas (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
  api_id UNIQUEIDENTIFIER NOT NULL REFERENCES apis(id),
  token_id UNIQUEIDENTIFIER NULL REFERENCES tokens_acesso(id),
  status_http INT NOT NULL,
  latencia_ms INT NOT NULL,
  origem_ip NVARCHAR(80) NOT NULL,
  horario DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  payload_resumo NVARCHAR(MAX) NULL,
  erro_codigo NVARCHAR(120) NULL
);

CREATE INDEX ix_logs_chamadas_api_horario ON logs_chamadas(api_id, horario DESC);
CREATE INDEX ix_apis_cliente_status ON apis(cliente_id, status);

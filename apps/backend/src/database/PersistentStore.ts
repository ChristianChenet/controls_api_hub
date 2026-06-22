import { Pool } from 'pg';
import { env } from '../config/env.js';
import {
  ApiCadastrada,
  Cliente,
  ClienteConsumidor,
  ConexaoBanco,
  LogChamada,
  TokenAcesso,
  Usuario,
  UsuarioEmpresa
} from '../domain/types.js';

export type TipoEntidade =
  | 'clientes'
  | 'conexoes'
  | 'apis'
  | 'tokens'
  | 'logs'
  | 'usuarios'
  | 'usuariosEmpresas'
  | 'clientesConsumidores';

export interface IdentidadeLoja {
  nomeLoja: string;
  logoUrl: string;
  descricaoCurta?: string;
}

export interface PublicacaoConfig {
  ambiente: 'local' | 'homologacao' | 'producao';
  dominioPrincipal: string;
  subdominioApi: string;
  urlBaseApi: string;
  urlBaseDocumentacao: string;
}

export interface SeedData {
  clientes: Cliente[];
  conexoes: ConexaoBanco[];
  apis: ApiCadastrada[];
  tokens: TokenAcesso[];
  logs: LogChamada[];
  usuarios: Usuario[];
  usuariosEmpresas?: UsuarioEmpresa[];
  clientesConsumidores?: ClienteConsumidor[];
}

export class PersistentStore {
  private pool = new Pool({ connectionString: env.databaseUrl });
  clientes: Cliente[] = [];
  conexoes: ConexaoBanco[] = [];
  apis: ApiCadastrada[] = [];
  tokens: TokenAcesso[] = [];
  logs: LogChamada[] = [];
  usuarios: Usuario[] = [];
  usuariosEmpresas: UsuarioEmpresa[] = [];
  clientesConsumidores: ClienteConsumidor[] = [];
  identidade: IdentidadeLoja = { nomeLoja: 'Cliente integrado', logoUrl: '/brand/logo-s-novo.jpg' };
  publicacao: PublicacaoConfig = {
    ambiente: 'local',
    dominioPrincipal: 'localhost',
    subdominioApi: 'localhost:3335',
    urlBaseApi: env.appPublicUrl,
    urlBaseDocumentacao: `${env.appPublicUrl}/swagger`
  };

  async iniciar(seed: SeedData) {
    await this.criarSchema();
    await this.seedSeNecessario('clientes', seed.clientes);
    await this.seedSeNecessario('conexoes', seed.conexoes);
    await this.seedSeNecessario('apis', seed.apis);
    await this.seedSeNecessario('tokens', seed.tokens);
    await this.seedSeNecessario('logs', seed.logs);
    await this.seedSeNecessario('usuarios', seed.usuarios);
    await this.seedSeNecessario('usuariosEmpresas', seed.usuariosEmpresas ?? []);
    await this.seedSeNecessario('clientesConsumidores', seed.clientesConsumidores ?? []);
    await this.seedIdentidade();
    await this.seedPublicacao();
    await this.carregar();
  }

  async criarSchema() {
    await this.pool.query(`
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
    `);
  }

  async carregar() {
    this.clientes = await this.listar<Cliente>('clientes');
    this.conexoes = await this.listar<ConexaoBanco>('conexoes');
    this.apis = await this.listar<ApiCadastrada>('apis');
    this.tokens = await this.listar<TokenAcesso>('tokens');
    this.logs = await this.listar<LogChamada>('logs');
    this.usuarios = await this.listar<Usuario>('usuarios');
    this.usuariosEmpresas = await this.listar<UsuarioEmpresa>('usuariosEmpresas');
    this.clientesConsumidores = await this.listar<ClienteConsumidor>('clientesConsumidores');
    this.identidade = await this.obterConfiguracao<IdentidadeLoja>('identidade_loja', this.identidade);
    this.publicacao = await this.obterConfiguracao<PublicacaoConfig>('publicacao', this.publicacao);
  }

  async listar<T>(tipo: TipoEntidade): Promise<T[]> {
    const resultado = await this.pool.query('SELECT dados FROM hub_entidades WHERE tipo = $1 ORDER BY atualizado_em DESC', [tipo]);
    return resultado.rows.map((row) => row.dados as T);
  }

  async salvar<T extends { id: string }>(tipo: TipoEntidade, entidade: T) {
    await this.pool.query(
      `INSERT INTO hub_entidades (tipo, id, dados)
       VALUES ($1, $2, $3)
       ON CONFLICT (tipo, id)
       DO UPDATE SET dados = EXCLUDED.dados, atualizado_em = NOW()`,
      [tipo, entidade.id, entidade]
    );
  }

  async excluir(tipo: TipoEntidade, id: string) {
    await this.pool.query('DELETE FROM hub_entidades WHERE tipo = $1 AND id = $2', [tipo, id]);
  }

  async salvarConfiguracao<T>(chave: string, dados: T) {
    await this.pool.query(
      `INSERT INTO hub_configuracoes (chave, dados)
       VALUES ($1, $2)
       ON CONFLICT (chave)
       DO UPDATE SET dados = EXCLUDED.dados, atualizado_em = NOW()`,
      [chave, dados]
    );
  }

  async obterConfiguracao<T>(chave: string, padrao: T): Promise<T> {
    const resultado = await this.pool.query('SELECT dados FROM hub_configuracoes WHERE chave = $1', [chave]);
    return (resultado.rows[0]?.dados as T | undefined) ?? padrao;
  }

  private async seedSeNecessario<T extends { id: string }>(tipo: TipoEntidade, entidades: T[]) {
    const count = await this.pool.query('SELECT COUNT(*)::int AS total FROM hub_entidades WHERE tipo = $1', [tipo]);
    if (count.rows[0].total > 0) return;
    for (const entidade of entidades) {
      await this.salvar(tipo, entidade);
    }
  }

  private async seedIdentidade() {
    const atual = await this.obterConfiguracao<IdentidadeLoja | null>('identidade_loja', null);
    if (!atual) {
      await this.salvarConfiguracao('identidade_loja', this.identidade);
    }
  }

  private async seedPublicacao() {
    const atual = await this.obterConfiguracao<PublicacaoConfig | null>('publicacao', null);
    if (!atual) {
      await this.salvarConfiguracao('publicacao', this.publicacao);
    }
  }
}

import { ConexaoBanco, TipoBanco } from '../../domain/types.js';

export interface ResultadoTesteConexao {
  sucesso: boolean;
  mensagem: string;
  dataHora: string;
  detalhes: {
    tipoBanco: TipoBanco;
    driverPlanejado: string;
    observacao: string;
  };
}

const driversPlanejados: Record<TipoBanco, string> = {
  oracle: 'oracledb',
  sqlserver: 'mssql',
  firebird: 'node-firebird-driver-native'
};

export class ConnectionFactory {
  async testar(conexao: ConexaoBanco): Promise<ResultadoTesteConexao> {
    const dataHora = new Date().toISOString();
    if (conexao.status !== 'ativa') {
      return {
        sucesso: false,
        mensagem: 'Conexao inativa. Ative a conexao antes de testar no banco de dados.',
        dataHora,
        detalhes: {
          tipoBanco: conexao.tipoBanco,
          driverPlanejado: driversPlanejados[conexao.tipoBanco],
          observacao: 'Nenhuma tentativa foi feita porque a conexao esta inativa.'
        }
      };
    }

    try {
      if (conexao.tipoBanco === 'sqlserver') await this.testarSqlServer(conexao);
      if (conexao.tipoBanco === 'oracle') await this.testarOracle(conexao);
      if (conexao.tipoBanco === 'firebird') await this.testarFirebird(conexao);
      return {
        sucesso: true,
        mensagem: 'Conexao validada com sucesso no banco de dados.',
        dataHora,
        detalhes: {
          tipoBanco: conexao.tipoBanco,
          driverPlanejado: driversPlanejados[conexao.tipoBanco],
          observacao: 'Teste real executado com consulta simples de validacao.'
        }
      };
    } catch (error) {
      return {
        sucesso: false,
        mensagem: error instanceof Error ? error.message : 'Nao foi possivel validar a conexao.',
        dataHora,
        detalhes: {
          tipoBanco: conexao.tipoBanco,
          driverPlanejado: driversPlanejados[conexao.tipoBanco],
          observacao: 'O teste tentou conectar no banco informado usando o driver correspondente.'
        }
      };
    }
  }

  private senha(conexao: ConexaoBanco) {
    if (!conexao.senhaCriptografada?.startsWith('criptografado:')) return conexao.senhaCriptografada ?? '';
    return Buffer.from(conexao.senhaCriptografada.replace('criptografado:', ''), 'base64').toString('utf8');
  }

  private async testarSqlServer(conexao: ConexaoBanco) {
    let mssql: any;
    try {
      mssql = await import('mssql');
    } catch {
      throw new Error('Driver SQL Server nao instalado. Execute npm install mssql no backend.');
    }
    const sqlDriver = mssql.default ?? mssql;
    const pool = await sqlDriver.connect({
      server: conexao.host,
      port: conexao.porta,
      database: conexao.bancoOuServico,
      user: conexao.usuario,
      password: this.senha(conexao),
      options: { encrypt: false, trustServerCertificate: true },
      requestTimeout: 15000,
      connectionTimeout: 10000
    });
    try {
      await pool.request().query('SELECT 1 AS testeConexao');
    } finally {
      await pool.close();
    }
  }

  private async testarOracle(conexao: ConexaoBanco) {
    let oracledb: any;
    try {
      oracledb = await import('oracledb');
    } catch {
      throw new Error('Driver Oracle nao instalado. Execute npm install oracledb e configure o Oracle Client no Windows.');
    }
    const oracleDriver = oracledb.default ?? oracledb;
    const connection = await oracleDriver.getConnection({
      user: conexao.usuario,
      password: this.senha(conexao),
      connectionString: conexao.stringConexaoOpcional || `${conexao.host}:${conexao.porta}/${conexao.bancoOuServico}`
    });
    try {
      await connection.execute('SELECT 1 AS testeConexao FROM dual');
    } finally {
      await connection.close();
    }
  }

  private async testarFirebird(conexao: ConexaoBanco) {
    let firebird: any;
    try {
      firebird = await import('node-firebird');
    } catch {
      throw new Error('Driver Firebird nao instalado. Execute npm install node-firebird no backend.');
    }
    await new Promise<void>((resolve, reject) => {
      const firebirdDriver = firebird.default ?? firebird;
      firebirdDriver.attach(
        {
          host: conexao.host,
          port: conexao.porta,
          database: conexao.bancoOuServico,
          user: conexao.usuario,
          password: this.senha(conexao),
          role: null,
          pageSize: 4096
        },
        (erroConexao: Error, db: any) => {
          if (erroConexao) return reject(erroConexao);
          db.query('SELECT 1 AS testeConexao FROM RDB$DATABASE', [], (erroQuery: Error) => {
            db.detach();
            if (erroQuery) return reject(erroQuery);
            resolve();
          });
        }
      );
    });
  }

  legado(conexao: ConexaoBanco): ResultadoTesteConexao {
    return {
      sucesso: conexao.status === 'ativa',
      mensagem:
        conexao.status === 'ativa'
          ? 'Conexao validada conceitualmente. Configure o driver nativo para execucao real.'
          : 'Conexao inativa. Ative a conexao antes de testar no banco de dados.',
      dataHora: new Date().toISOString(),
      detalhes: {
        tipoBanco: conexao.tipoBanco,
        driverPlanejado: driversPlanejados[conexao.tipoBanco],
        observacao: 'A primeira versao separa cadastro, criptografia e adaptadores por banco para execucao segura em Windows.'
      }
    };
  }
}

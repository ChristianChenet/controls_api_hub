import { ConexaoBanco } from '../../domain/types.js';

type Parametros = Record<string, string | number | boolean | null | undefined>;

function senha(conexao: ConexaoBanco) {
  if (!conexao.senhaCriptografada.startsWith('criptografado:')) return conexao.senhaCriptografada;
  return Buffer.from(conexao.senhaCriptografada.replace('criptografado:', ''), 'base64').toString('utf8');
}

export function validarSomenteConsulta(sql: string) {
  const normalizado = sql.trim();
  const mensagem = 'Por segurança, o teste permite apenas consultas SELECT ou procedures de API contendo API no nome.';
  const nomeProcedure = normalizado.match(/^exec(?:ute)?\s+([^\s(;]+)/i)?.[1] ?? '';

  // CONTROL S - ALTERAÇÃO MON: permite teste de procedures de API contendo API no nome.
  if (/^select\b/i.test(normalizado)) return;
  if (/^exec(?:ute)?\b/i.test(normalizado) && nomeProcedure.replace(/[\[\]"`]/g, '').toUpperCase().includes('API')) return;

  // CONTROL S - ALTERAÇÃO MON: permite teste de procedures de API contendo API no nome.
  const proibidos = /\b(insert|update|delete|drop|alter|create|truncate|merge|grant|revoke)\b/i;
  if (proibidos.test(normalizado) || !/^select\b/i.test(normalizado)) {
    throw new Error(mensagem);
  }
}

function nomesParametros(sql: string) {
  return Array.from(new Set(Array.from(sql.matchAll(/[:@]([a-zA-Z_][a-zA-Z0-9_]*)/g)).map((match) => match[1])));
}

function normalizarParametros(sql: string, parametros: Parametros) {
  return Object.fromEntries(nomesParametros(sql).map((nome) => [nome, parametros[nome] ?? null]));
}

export class SqlExecutor {
  async executar(conexao: ConexaoBanco, sql: string, parametros: Parametros = {}) {
    validarSomenteConsulta(sql);
    const binds = normalizarParametros(sql, parametros);

    if (conexao.tipoBanco === 'sqlserver') {
      return this.executarSqlServer(conexao, sql, binds);
    }

    if (conexao.tipoBanco === 'oracle') {
      return this.executarOracle(conexao, sql, binds);
    }

    return this.executarFirebird(conexao, sql, binds);
  }

  private async executarSqlServer(conexao: ConexaoBanco, sql: string, parametros: Parametros) {
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
      password: senha(conexao),
      options: {
        encrypt: false,
        trustServerCertificate: true
      },
      requestTimeout: 30000,
      connectionTimeout: 15000
    });

    try {
      const request = pool.request();
      Object.entries(parametros).forEach(([nome, valor]) => request.input(nome, valor));
      const sqlServer = sql.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '@$1');
      const resultado = await request.query(sqlServer);
      return resultado.recordset ?? [];
    } finally {
      await pool.close();
    }
  }

  private async executarOracle(conexao: ConexaoBanco, sql: string, parametros: Parametros) {
    let oracledb: any;
    try {
      oracledb = await import('oracledb');
    } catch {
      throw new Error('Driver Oracle nao instalado. Execute npm install oracledb e configure o Oracle Client no Windows.');
    }

    const oracleDriver = oracledb.default ?? oracledb;
    const connection = await oracleDriver.getConnection({
      user: conexao.usuario,
      password: senha(conexao),
      connectionString: `${conexao.host}:${conexao.porta}/${conexao.bancoOuServico}`
    });

    try {
      const resultado = await connection.execute(sql, parametros, {
        outFormat: oracleDriver.OUT_FORMAT_OBJECT,
        maxRows: 200
      });
      return resultado.rows ?? [];
    } finally {
      await connection.close();
    }
  }

  private async executarFirebird(conexao: ConexaoBanco, sql: string, parametros: Parametros) {
    let firebird: any;
    try {
      firebird = await import('node-firebird');
    } catch {
      throw new Error('Driver Firebird nao instalado. Execute npm install node-firebird no backend.');
    }

    const ordem = nomesParametros(sql);
    const sqlFirebird = sql.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '?');
    const valores = ordem.map((nome) => parametros[nome] ?? null);

    return new Promise((resolve, reject) => {
      const firebirdDriver = firebird.default ?? firebird;
      firebirdDriver.attach(
        {
          host: conexao.host,
          port: conexao.porta,
          database: conexao.bancoOuServico,
          user: conexao.usuario,
          password: senha(conexao),
          role: null,
          pageSize: 4096
        },
        (erroConexao: Error, db: any) => {
          if (erroConexao) return reject(erroConexao);
          db.query(sqlFirebird, valores, (erroQuery: Error, resultado: unknown[]) => {
            db.detach();
            if (erroQuery) return reject(erroQuery);
            resolve(resultado ?? []);
          });
        }
      );
    });
  }
}

import { Pool } from 'pg';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://postgres:controls@localhost:5432/control_s_api_hub_test';
const ADMIN_DATABASE_URL = TEST_DATABASE_URL.replace(/\/control_s_api_hub_test(\?.*)?$/, '/postgres$1');

async function prepararBancoTeste() {
  const admin = new Pool({ connectionString: ADMIN_DATABASE_URL });
  try {
    await admin.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = 'control_s_api_hub_test' AND pid <> pg_backend_pid()
    `);
    await admin.query('DROP DATABASE IF EXISTS control_s_api_hub_test');
    await admin.query('CREATE DATABASE control_s_api_hub_test');
  } finally {
    await admin.end();
  }
}

await prepararBancoTeste();

process.env.NODE_ENV = 'test';
process.env.PORT = '3334';
process.env.HOST = '127.0.0.1';
process.env.APP_PUBLIC_URL = 'http://localhost:3334';
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.JWT_SECRET = 'controls_teste';
process.env.TOKEN_HASH_PEPPER = 'controls_teste';

const { buildApp } = await import('../apps/backend/dist/app.js');
const app = await buildApp();

async function call(method, url, body, token, expectedStatus) {
  const response = await app.inject({
    method,
    url,
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
    payload: body
  });
  let payload;
  try {
    payload = JSON.parse(response.body);
  } catch {
    payload = { bruto: response.body };
  }
  if (expectedStatus && response.statusCode !== expectedStatus) {
    throw new Error(`${method} ${url} -> esperado ${expectedStatus}, recebido ${response.statusCode}: ${response.body}`);
  }
  if (!expectedStatus && (response.statusCode >= 400 || payload.sucesso === false)) {
    throw new Error(`${method} ${url} -> ${response.statusCode}: ${payload.erro?.codigo ?? response.body}`);
  }
  return payload.dados ?? payload;
}

const login = await call('POST', '/api/auth/login', {
  email: 'admin@controlsconsultoria.com.br',
  senha: 'controls'
});
const token = login.token;
if (!token) throw new Error('Login nao retornou token administrativo.');
if (!login.empresaSelecionadaId && !login.exigeCadastroEmpresa && !login.exigeSelecaoEmpresa) {
  throw new Error('Login nao retornou contexto multiempresa esperado.');
}

const sufixo = Date.now();
const empresa = await call('POST', '/api/admin/empresas', {
  nomeEmpresa: `Empresa Operacional ${sufixo}`,
  nomeFantasia: `Operacional ${sufixo}`,
  ambiente: 'homologacao',
  status: 'ativo',
  dominioPrincipal: `empresa-${sufixo}.local`,
  subdominioApi: `api.empresa-${sufixo}.local`,
  urlBaseLocal: 'http://localhost:3334',
  observacoes: 'Empresa criada pelo teste isolado.'
}, token);
if (!empresa.id || empresa.cnpj !== '') throw new Error('Cadastro de empresa nao aceitou CNPJ opcional corretamente.');

const usuarios = await call('GET', '/api/admin/usuarios', undefined, token);
const admin = usuarios.find((usuario) => usuario.email === 'admin@controlsconsultoria.com.br');
if (!admin?.empresasIds?.includes(empresa.id)) {
  throw new Error('Empresa nova nao foi vinculada automaticamente ao administrador.');
}

await call('POST', '/api/auth/selecionar-empresa', { empresaId: empresa.id }, token);

const dashboardInicial = await call('GET', '/api/admin/dashboard', undefined, token);
if (dashboardInicial.totalApis !== 0) throw new Error('Dashboard da empresa nova nao deveria misturar APIs de outra empresa.');

const conexao = await call('POST', '/api/admin/conexoes', {
  nome: `Conexao ${sufixo}`,
  tipoBanco: 'sqlserver',
  host: 'localhost',
  porta: 1433,
  bancoOuServico: 'master',
  usuario: 'usuario_api',
  senha: 'senha',
  ambiente: 'homologacao',
  status: 'inativa',
  observacoes: 'Conexao de teste isolado.'
}, token);
await call('POST', `/api/admin/conexoes/${conexao.id}/testar`, undefined, token);

for (const tipoBanco of ['oracle', 'sqlserver', 'firebird']) {
  const testeConexao = await call('POST', '/api/admin/conexoes', {
    nome: `Conexao ${tipoBanco} ${sufixo}`,
    tipoBanco,
    host: 'localhost',
    porta: tipoBanco === 'oracle' ? 1521 : tipoBanco === 'firebird' ? 3050 : 1433,
    bancoOuServico: tipoBanco === 'firebird' ? 'C:\\Dados\\BASE.FDB' : 'master',
    usuario: 'usuario_api',
    senha: 'senha',
    ambiente: 'homologacao',
    status: 'inativa'
  }, token);
  const retorno = await call('POST', `/api/admin/conexoes/${testeConexao.id}/testar`, undefined, token);
  if (retorno.sucesso !== false || !retorno.detalhes?.tipoBanco) throw new Error(`Teste de conexao ${tipoBanco} nao retornou status claro.`);
}

const api = await call('POST', '/api/admin/apis', {
  nome: `API Operacional ${sufixo}`,
  descricao: 'API criada pelo teste isolado.',
  versao: '1.0.0',
  categoria: 'Teste',
  metodoHttp: 'GET',
  endpoint: `/v1/operacional-${sufixo}`,
  conexaoId: conexao.id
}, token);

await call('PUT', `/api/admin/apis/${api.id}/sql`, { sqlBase: 'SELECT 1 AS codigoTeste', parametrosTeste: { codigo: '1', pagina: 2, pageSize: 50 } }, token);
await call('PUT', `/api/admin/apis/${api.id}/parametros`, {
  parametros: [
    {
      id: '',
      nomeTecnico: 'codigo',
      nomePublico: 'codigo',
      tipo: 'numero',
      obrigatorio: false,
      origem: 'query',
      descricao: 'Codigo de teste.',
      exemplo: '1'
    }
  ],
  regras: { quantidadeMaximaPorPagina: 100 },
  parametrosTeste: { codigo: '1', pagina: 2, pageSize: 50 }
}, token);
const apisDepoisParametros = await call('GET', '/api/admin/apis', undefined, token);
const apiPersistida = apisDepoisParametros.find((item) => item.id === api.id);
if (apiPersistida?.apiSql?.parametrosTeste?.pageSize !== 50) throw new Error('Parametros de teste nao persistiram na API.');
if (apiPersistida?.regras?.quantidadeMaximaPorPagina !== 100) throw new Error('Regras de validacao nao persistiram na API.');
await call('POST', `/api/admin/apis/${api.id}/validar`, undefined, token);
const publicada = await call('POST', `/api/admin/apis/${api.id}/publicar`, undefined, token);
if (publicada.status !== 'publicado' || !publicada.urls?.local || !publicada.urls?.publica) throw new Error('Publicacao nao gerou URLs local e publica.');

const consumidor = await call('POST', '/api/admin/clientes-consumidores', {
  nomeCliente: `Consumidor ${sufixo}`,
  descricao: 'Cliente consumidor do teste isolado.',
  emailResponsavel: 'integrador@teste.local',
  status: 'ativo'
}, token);
if (!consumidor.tokenGerado) throw new Error('Cliente consumidor nao gerou token.');
await call('POST', `/api/admin/clientes-consumidores/${consumidor.id}/regenerar-token`, undefined, token);

const openapi = await call('GET', '/documentacao/openapi.json');
if (!openapi.paths[`/v1/operacional-${sufixo}`]) throw new Error('Swagger publico nao exibiu API publicada.');
const parametrosSwagger = openapi.paths[`/v1/operacional-${sufixo}`].get.parameters.map((parametro) => parametro.name);
if (!parametrosSwagger.includes('pagina') || !parametrosSwagger.includes('pageSize')) {
  throw new Error('Swagger publico nao documentou parametros de paginacao.');
}
if (Object.keys(openapi.paths).some((path) => path.startsWith('/api/admin') || path.includes('auth'))) {
  throw new Error('Swagger publico exibiu rota interna.');
}

const logs = await call('GET', '/api/admin/logs', undefined, token);
if (!Array.isArray(logs)) throw new Error('Logs nao retornaram lista filtrada por empresa.');

await call('POST', `/api/admin/apis/${api.id}/despublicar`, undefined, token);
const openapiDepois = await call('GET', '/documentacao/openapi.json');
if (openapiDepois.paths[`/v1/operacional-${sufixo}`]) throw new Error('Swagger publico exibiu API despublicada.');

await app.close();
console.log('Testes isolados do Control S API Hub concluidos com sucesso.');

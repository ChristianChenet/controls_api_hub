import { buildApp } from '../apps/backend/dist/app.js';

const app = await buildApp();

async function call(method, url, body, token, expectedStatus) {
  const response = await app.inject({
    method,
    url,
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
    payload: body
  });
  const payload = JSON.parse(response.body);
  if (expectedStatus && response.statusCode !== expectedStatus) {
    throw new Error(`${method} ${url} esperava ${expectedStatus}, retornou ${response.statusCode}: ${response.body}`);
  }
  if (!expectedStatus && (response.statusCode >= 400 || payload.sucesso === false)) {
    throw new Error(`${method} ${url} retornou erro: ${response.body}`);
  }
  return payload.dados ?? payload;
}

const sufixo = Date.now();
const login = await call('POST', '/api/auth/login', {
  email: 'admin@controlsconsultoria.com.br',
  senha: 'controls'
});

const empresa = await call('POST', '/api/admin/empresas', {
  nomeEmpresa: `Empresa Local ${sufixo}`,
  nomeFantasia: `Empresa Local ${sufixo}`,
  status: 'ativo',
  dominioPrincipal: `empresa-${sufixo}.local`,
  subdominioApi: `api.empresa-${sufixo}.local`,
  observacoes: 'Teste local de cadastro simplificado.'
}, login.token);

if (!empresa.id) throw new Error('Empresa nao retornou ID.');
if (empresa.cnpj !== '') throw new Error('CNPJ deveria ser opcional e vazio.');
if (empresa.ambiente !== 'homologacao') throw new Error('Ambiente padrao deveria ser homologacao.');

await call('POST', '/api/admin/empresas', {
  nomeEmpresa: `Empresa Local ${sufixo}`,
  nomeFantasia: `Empresa Local ${sufixo}`
}, login.token, 409);

const lista = await call('GET', '/api/admin/empresas', undefined, login.token);
if (!lista.some((item) => item.id === empresa.id)) throw new Error('Empresa cadastrada nao apareceu na listagem.');

await call('DELETE', `/api/admin/empresas/${empresa.id}`, undefined, login.token);
await app.close();

console.log('Cadastro simplificado de empresa testado com sucesso.');

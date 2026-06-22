const baseUrl = process.env.CONTROL_S_API_HUB_URL ?? 'http://localhost:3333';

async function http(method, path, body, token, aceitarErro = false) {
  const headers = {
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { bruto: text };
  }
  if (!aceitarErro && (response.status >= 400 || payload.sucesso === false)) {
    throw new Error(`${method} ${path} -> ${response.status}: ${payload.erro?.codigo ?? text}`);
  }
  return { status: response.status, dados: payload.dados ?? payload, payload };
}

async function main() {
  const sufixo = Date.now();
  const criados = { clientes: [], conexoes: [], apis: [], tokens: [], usuarios: [], logs: [] };

  const login = await http('POST', '/api/auth/login', {
    email: 'admin@controlsconsultoria.com.br',
    senha: 'controls'
  });
  const token = login.dados.token;

  try {
    await http('GET', '/saude');

    const cliente = (await http('POST', '/api/admin/clientes', {
      nomeEmpresa: `Cliente HTTP ${sufixo} Ltda`,
      nomeFantasia: `Cliente HTTP ${sufixo}`,
      cnpj: '11.111.111/0001-11',
      codigoInterno: `CLIENTE_HTTP_${sufixo}`,
      responsavel: 'Responsavel HTTP',
      email: 'cliente.http@teste.local',
      telefone: '(11) 1111-1111',
      ambiente: 'homologacao',
      status: 'ativo',
      dominioPrincipal: 'cliente-http.local',
      subdominioApi: 'api.cliente-http.local'
    }, token)).dados;
    criados.clientes.push(cliente.id);

    const clientes = (await http('GET', '/api/admin/clientes', undefined, token)).dados;
    if (!clientes.some((item) => item.id === cliente.id)) throw new Error('Cliente criado nao apareceu na listagem.');

    await http('PUT', `/api/admin/clientes/${cliente.id}`, {
      ...cliente,
      nomeFantasia: `${cliente.nomeFantasia} Editado`
    }, token);

    const conexao = (await http('POST', '/api/admin/conexoes', {
      nome: `Conexao HTTP ${sufixo}`,
      clienteId: cliente.id,
      tipoBanco: 'sqlserver',
      host: 'localhost',
      porta: 1433,
      bancoOuServico: 'master',
      usuario: 'usuario_api',
      senha: 'senha',
      ambiente: 'homologacao',
      status: 'ativa'
    }, token)).dados;
    criados.conexoes.push(conexao.id);
    await http('POST', `/api/admin/conexoes/${conexao.id}/testar`, undefined, token);
    await http('PUT', `/api/admin/conexoes/${conexao.id}`, { ...conexao, nome: `${conexao.nome} Editada`, senha: '' }, token);

    const api = (await http('POST', '/api/admin/apis', {
      nome: `API HTTP ${sufixo}`,
      codigoInterno: `API_HTTP_${sufixo}`,
      clienteId: cliente.id,
      descricao: 'API validada por teste HTTP ponta a ponta.',
      versao: '1.0.0',
      categoria: 'Teste',
      metodoHttp: 'GET',
      endpoint: `/v1/http-${sufixo}`,
      conexaoId: conexao.id,
      paginacaoHabilitada: true
    }, token)).dados;
    criados.apis.push(api.id);
    await http('PUT', `/api/admin/apis/${api.id}`, { ...api, nome: `${api.nome} Editada` }, token);
    await http('PUT', `/api/admin/apis/${api.id}/sql`, { sqlBase: 'SELECT 1 AS codigoTeste' }, token);
    await http('PUT', `/api/admin/apis/${api.id}/parametros`, {
      parametros: [
        {
          nomeTecnico: 'codigoTeste',
          nomePublico: 'codigoTeste',
          tipo: 'numero',
          obrigatorio: false,
          origem: 'query',
          descricao: 'Codigo de teste.',
          exemplo: 1
        }
      ],
      regras: {}
    }, token);
    await http('POST', `/api/admin/apis/${api.id}/publicar`, undefined, token);
    const openapi = (await http('GET', `/api/admin/apis/${api.id}/openapi.json`, undefined, token)).dados;
    if (!openapi.paths?.[api.endpoint]) throw new Error('OpenAPI da API criada nao contem o endpoint.');
    await http('POST', `/api/admin/apis/${api.id}/despublicar`, undefined, token);

    const tokenAcesso = (await http('POST', '/api/admin/tokens', {
      nome: `Token HTTP ${sufixo}`,
      clienteId: cliente.id,
      parceiro: 'Integrador HTTP',
      status: 'ativo',
      observacao: 'Token validado por teste HTTP.'
    }, token)).dados;
    criados.tokens.push(tokenAcesso.id);
    if (!tokenAcesso.tokenGerado) throw new Error('Token completo nao foi retornado na criacao.');
    await http('PUT', `/api/admin/tokens/${tokenAcesso.id}`, {
      nome: `${tokenAcesso.nome} Editado`,
      clienteId: cliente.id,
      parceiro: tokenAcesso.parceiro,
      status: 'inativo',
      observacao: 'Editado pelo teste HTTP.'
    }, token);

    const usuario = (await http('POST', '/api/admin/usuarios', {
      nome: `Usuario HTTP ${sufixo}`,
      email: `usuario.http.${sufixo}@teste.local`,
      perfil: 'operador',
      status: 'ativo'
    }, token)).dados;
    criados.usuarios.push(usuario.id);
    await http('PUT', `/api/admin/usuarios/${usuario.id}`, {
      nome: `${usuario.nome} Editado`,
      email: usuario.email,
      perfil: 'visualizador',
      status: 'ativo'
    }, token);

    const publicacaoOriginal = (await http('GET', '/api/admin/publicacao', undefined, token)).dados;
    await http('PUT', '/api/admin/publicacao', {
      ambiente: 'homologacao',
      dominioPrincipal: 'cliente-http.local',
      subdominioApi: 'api.cliente-http.local',
      urlBaseApi: 'https://api.cliente-http.local',
      urlBaseDocumentacao: 'https://api.cliente-http.local/swagger'
    }, token);
    await http('PUT', '/api/admin/publicacao', publicacaoOriginal, token);

    await http('PUT', '/api/admin/identidade', {
      nomeLoja: 'Cliente integrado',
      logoUrl: '/brand/logo-s-novo.jpg'
    }, token);

    const logs = (await http('GET', '/api/admin/logs', undefined, token)).dados;
    for (const log of logs.filter((item) => item.apiId === api.id)) {
      criados.logs.push(log.id);
    }

    console.log('Teste HTTP ponta a ponta concluido com sucesso.');
  } finally {
    for (const id of criados.logs) await http('DELETE', `/api/admin/logs/${id}`, undefined, token, true);
    for (const id of criados.tokens) await http('DELETE', `/api/admin/tokens/${id}`, undefined, token, true);
    for (const id of criados.usuarios) await http('DELETE', `/api/admin/usuarios/${id}`, undefined, token, true);
    for (const id of criados.apis) await http('DELETE', `/api/admin/apis/${id}`, undefined, token, true);
    for (const id of criados.conexoes) await http('DELETE', `/api/admin/conexoes/${id}`, undefined, token, true);
    for (const id of criados.clientes) await http('DELETE', `/api/admin/clientes/${id}`, undefined, token, true);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import cors from '@fastify/cors';
import staticFiles from '@fastify/static';
import Fastify from 'fastify';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { env } from './config/env.js';
import * as seed from './data/mockStore.js';
import { PersistentStore } from './database/PersistentStore.js';
import {
  ApiCadastrada,
  Cliente,
  ClienteConsumidor,
  ConexaoBanco,
  LogChamada,
  ParametroApi,
  TipoParametro,
  TokenAcesso,
  Usuario,
  UsuarioEmpresa
} from './domain/types.js';
import { erro, sucesso } from './http/responses.js';
import { ConnectionFactory } from './modules/conexoes/ConnectionFactory.js';
import { OpenApiGenerator } from './modules/docs/OpenApiGenerator.js';
import { ApiExecutionEngine } from './modules/engine/ApiExecutionEngine.js';
import { SqlExecutor } from './modules/engine/SqlExecutor.js';

type Perfil = 'admin' | 'operador' | 'visualizador';
type Sessao = { usuarioId: string; perfil: Perfil; empresaId?: string; empresasIds: string[] };

const agora = () => new Date().toISOString();
const somenteDigitos = (valor = '') => valor.replace(/\D/g, '');
const normalizarRota = (rota = '') => (rota.startsWith('/') ? rota : `/${rota}`).replace(/\/+/g, '/');
const baseLocal = () => env.appPublicUrl.replace(/\/+$/, '');

function hashSenha(senha: string) {
  return createHash('sha256').update(`senha:${senha}:${env.jwtSecret}`).digest('hex');
}

function senhaConfere(usuario: Usuario, senha?: string) {
  if (!senha) return false;
  return usuario.senhaHash === hashSenha(senha) || usuario.senhaHash === senha;
}

function hashToken(token: string) {
  return createHash('sha256').update(`${token}:${env.tokenHashPepper}`).digest('hex');
}

function mascararToken(token: string) {
  return `${token.slice(0, 12)}********${token.slice(-6)}`;
}

function criptografarSenhaConexao(senha: string) {
  if (!senha) return '';
  return `criptografado:${Buffer.from(senha, 'utf8').toString('base64')}`;
}

function semSenha(conexao: ConexaoBanco) {
  return { ...conexao, senhaCriptografada: conexao.senhaCriptografada ? '********' : '' };
}

function montarUrlPublica(empresa: Cliente | undefined, rota: string) {
  const caminho = normalizarRota(rota);
  const dominio = empresa?.dominioApi || empresa?.subdominioApi || empresa?.dominioPrincipal;
  const local = `${(empresa?.urlBaseLocal || baseLocal()).replace(/\/+$/, '')}${caminho}`;
  const basePublica = empresa?.urlBaseApi || (dominio ? `https://${dominio.replace(/^https?:\/\//i, '').replace(/\/+$/, '')}` : '');
  const publica = basePublica ? `${basePublica.replace(/\/+$/, '')}${caminho}` : undefined;
  return { local, publica };
}

function inferirCampos(sql: string) {
  const aliases = Array.from(sql.matchAll(/\sAS\s+["']?([a-zA-Z_][a-zA-Z0-9_]*)["']?/gi)).map((match) => match[1]);
  return Array.from(new Set(aliases)).map((alias) => ({
      origem: alias,
      nomePublico: alias,
      tipo: (alias.toLowerCase().includes('valor') || alias.toLowerCase().includes('total') ? 'numero' : 'texto') as TipoParametro,
    descricao: `Campo publico ${alias}.`,
    exemplo: alias.toLowerCase().includes('valor') ? 100 : `Exemplo de ${alias}`
  }));
}

function gerarPreview(api: ApiCadastrada, empresa?: Cliente) {
  const urls = montarUrlPublica(empresa, api.endpoint);
  const quantidadeMaximaPorPagina = api.regras?.quantidadeMaximaPorPagina ?? 200;
  return {
    metodoHttp: api.metodoHttp,
    rota: api.endpoint,
    urlLocal: urls.local,
    urlPublica: urls.publica,
    autenticacao: api.exigeToken === false ? 'Sem token' : 'Bearer Token',
    parametros: api.parametros,
    exemploChamada: `${api.metodoHttp} ${urls.publica || urls.local}`,
    exemploResposta: {
      sucesso: true,
      meta: { pagina: 1, quantidadePorPagina: quantidadeMaximaPorPagina, totalRegistros: 1, totalPaginas: 1, temProxima: false, temAnterior: false },
      dados: [Object.fromEntries((api.campos ?? []).map((campo) => [campo.nomePublico, campo.exemplo]))]
    },
    erros: [
      { codigo: 'TOKEN_NAO_INFORMADO', mensagem: 'Informe o token de acesso.' },
      { codigo: 'PARAMETRO_OBRIGATORIO_NAO_INFORMADO', mensagem: 'Informe os parametros obrigatorios.' },
      { codigo: 'ERRO_EXECUCAO_API_PUBLICA', mensagem: 'Erro ao executar API publicada.' }
    ]
  };
}

function parametrosTestePadrao(api: ApiCadastrada) {
  const parametros = api.parametros ?? [];
  if (!parametros.length) return { pagina: 1, pageSize: 500 };
  const entradas: Array<[string, unknown]> = parametros.map((parametro) => [parametro.nomePublico, parametro.exemplo || parametro.valorPadrao || null]);
  entradas.push(['pagina', 1], ['pageSize', 500]);
  return Object.fromEntries(entradas);
}

function regrasPadrao(api?: ApiCadastrada): ApiCadastrada['regras'] {
  return {
    ...(api?.regras ?? {}),
    paginacaoPermitida: api?.regras?.paginacaoPermitida ?? true,
    quantidadeMaximaPorPagina: api?.regras?.quantidadeMaximaPorPagina ?? 200,
    timeoutMs: api?.regras?.timeoutMs ?? 30000
  };
}

function normalizarPaginacao(entrada: Record<string, unknown>, api: ApiCadastrada) {
  const pagina = Math.max(Number(entrada.pagina ?? entrada.page ?? 1) || 1, 1);
  // Default 500 facilita carga inicial em integrações; o limite máximo protege o banco e pode ser ajustado por API.
  const padraoPageSize = 500;
  const maximo = Math.max(Number(api.regras?.quantidadeMaximaPorPagina ?? 200) || 200, 1);
  const solicitado = Math.max(Number(entrada.quantidadePorPagina ?? entrada.pageSize ?? entrada.limit ?? padraoPageSize) || padraoPageSize, 1);
  const quantidadePorPagina = Math.min(solicitado, maximo);
  return { pagina, quantidadePorPagina };
}

function aplicarPaginacao<T>(registros: T[], pagina: number, quantidadePorPagina: number) {
  const totalRegistros = registros.length;
  const totalPaginas = Math.max(Math.ceil(totalRegistros / quantidadePorPagina), 1);
  const inicio = (pagina - 1) * quantidadePorPagina;
  const dados = registros.slice(inicio, inicio + quantidadePorPagina);
  return {
    dados,
    meta: {
      pagina,
      quantidadePorPagina,
      totalRegistros,
      totalPaginas,
      temProxima: pagina < totalPaginas,
      temAnterior: pagina > 1
    }
  };
}

export async function buildApp() {
  const app = Fastify({ logger: true });
  const sessoes = new Map<string, Sessao>();
  const conexaoFactory = new ConnectionFactory();
  const docs = new OpenApiGenerator();
  const engine = new ApiExecutionEngine();
  const sqlExecutor = new SqlExecutor();
  const store = new PersistentStore();
  await store.iniciar(seed);

  const { clientes: empresas, conexoes, apis, tokens, logs, usuarios, usuariosEmpresas, clientesConsumidores } = store;

  async function garantirCompatibilidadeDadosExistentes() {
    const primeiraEmpresa = empresas[0];
    if (primeiraEmpresa) {
      for (const usuario of usuarios) {
        const jaTemEmpresa = usuariosEmpresas.some((vinculo) =>
          vinculo.usuarioId === usuario.id &&
          vinculo.ativo &&
          empresas.some((empresa) => empresa.id === vinculo.empresaId)
        );
        if (!jaTemEmpresa) {
          const vinculo: UsuarioEmpresa = {
            id: `vinculo-${usuario.id}-${primeiraEmpresa.id}`,
            usuarioId: usuario.id,
            empresaId: primeiraEmpresa.id,
            perfil: usuario.perfil,
            empresaPadrao: true,
            ativo: true
          };
          usuariosEmpresas.unshift(vinculo);
          await store.salvar('usuariosEmpresas', vinculo);
        }
      }
    }

    for (const conexao of conexoes) {
      if (!conexao.empresaId) {
        conexao.empresaId = conexao.clienteId;
        conexao.nomeConexao = conexao.nomeConexao || conexao.nome;
        await store.salvar('conexoes', conexao);
      }
    }

    for (const api of apis) {
      if (!api.empresaId) {
        api.empresaId = api.clienteId;
        api.nomeApi = api.nomeApi || api.nome;
        api.rotaPublica = api.rotaPublica || api.endpoint;
        api.ativa = api.ativa ?? api.status === 'publicado';
        api.exigeToken = api.exigeToken ?? true;
        api.permitePaginacao = api.permitePaginacao ?? api.paginacaoHabilitada;
        api.regras = regrasPadrao(api);
        api.apiSql = { ...(api.apiSql || { id: randomUUID(), sqlOriginal: api.sqlBase || '', dataCadastro: agora() }), parametrosTeste: api.apiSql?.parametrosTeste ?? parametrosTestePadrao(api), dataAtualizacao: agora() };
        await store.salvar('apis', api);
      }
      if (!api.apiSql?.parametrosTeste || !api.regras) {
        api.regras = regrasPadrao(api);
        api.apiSql = { ...(api.apiSql || { id: randomUUID(), sqlOriginal: api.sqlBase || '', dataCadastro: agora() }), parametrosTeste: api.apiSql?.parametrosTeste ?? parametrosTestePadrao(api), dataAtualizacao: agora() };
        await store.salvar('apis', api);
      }
    }
  }

  await garantirCompatibilidadeDadosExistentes();

  function obterBearer(request: { headers: Record<string, string | string[] | undefined> }) {
    const authorization = request.headers.authorization;
    const header = Array.isArray(authorization) ? authorization[0] : authorization;
    return header?.replace(/^Bearer\s+/i, '').trim();
  }

  function obterSessao(request: { headers: Record<string, string | string[] | undefined> }) {
    const bearer = obterBearer(request);
    return bearer ? sessoes.get(bearer) : undefined;
  }

  function empresasDoUsuario(usuarioId: string) {
    return usuariosEmpresas
      .filter((vinculo) => vinculo.usuarioId === usuarioId && vinculo.ativo)
      .map((vinculo) => {
        const empresa = empresas.find((item) => item.id === vinculo.empresaId);
        return empresa ? { ...empresa, perfil: vinculo.perfil, empresaPadrao: vinculo.empresaPadrao } : undefined;
      })
      .filter(Boolean) as Array<Cliente & { perfil: Perfil; empresaPadrao?: boolean }>;
  }

  function exigirSessao(request: { headers: Record<string, string | string[] | undefined> }, reply: any) {
    const sessao = obterSessao(request);
    if (!sessao) {
      reply.status(401).send(erro('SESSAO_INVALIDA', 'Faca login novamente para continuar.'));
      return undefined;
    }
    return sessao;
  }

  function empresaContexto(request: { headers: Record<string, string | string[] | undefined>; query?: any }, reply: any) {
    const sessao = exigirSessao(request, reply);
    if (!sessao) return undefined;
    const headerEmpresa = request.headers['x-empresa-id'];
    const empresaIdInformada = request.query?.empresaId || (Array.isArray(headerEmpresa) ? headerEmpresa[0] : headerEmpresa);
    const empresaId = empresaIdInformada || sessao.empresaId;
    if (!empresaId || !sessao.empresasIds.includes(empresaId)) {
      reply.status(403).send(erro('EMPRESA_NAO_SELECIONADA', 'Selecione uma empresa vinculada ao usuario para operar o portal.'));
      return undefined;
    }
    return { sessao, empresaId: String(empresaId) };
  }

  function exigirAdmin(request: { headers: Record<string, string | string[] | undefined> }, reply: any) {
    const sessao = exigirSessao(request, reply);
    if (!sessao) return undefined;
    if (sessao.perfil !== 'admin') {
      reply.status(403).send(erro('ACESSO_NEGADO', 'Somente administradores podem executar esta operacao.'));
      return undefined;
    }
    return sessao;
  }

  function vincularUsuarioEmpresa(usuarioId: string, empresaId: string, perfil: Perfil, empresaPadrao = false) {
    const existente = usuariosEmpresas.find((item) => item.usuarioId === usuarioId && item.empresaId === empresaId);
    if (existente) {
      existente.perfil = perfil;
      existente.ativo = true;
      existente.empresaPadrao = existente.empresaPadrao || empresaPadrao;
      return existente;
    }
    const vinculo: UsuarioEmpresa = { id: randomUUID(), usuarioId, empresaId, perfil, empresaPadrao, ativo: true };
    usuariosEmpresas.unshift(vinculo);
    return vinculo;
  }

  function validarTokenPublico(request: { headers: Record<string, string | string[] | undefined> }, api: ApiCadastrada) {
    if (api.exigeToken === false) return { valido: true as const };
    const bearer = obterBearer(request);
    if (!bearer) {
      return { valido: false as const, status: 401, codigo: 'TOKEN_NAO_INFORMADO', mensagem: 'Informe o token de acesso no cabecalho Authorization: Bearer.' };
    }
    const tokenHash = hashToken(bearer);
    const token = tokens.find(
      (item) =>
        item.status === 'ativo' &&
        item.empresaId === (api.empresaId || api.clienteId) &&
        item.tokenHash === tokenHash
    );
    if (!token) {
      return { valido: false as const, status: 401, codigo: 'TOKEN_INVALIDO', mensagem: 'Token invalido, inativo ou sem permissao para esta API.' };
    }
    if (token.expiraEm && new Date(token.expiraEm) < new Date()) {
      return { valido: false as const, status: 401, codigo: 'TOKEN_EXPIRADO', mensagem: 'Token expirado. Solicite um novo token para a Control S.' };
    }
    return { valido: true as const, token };
  }

  function normalizarParametro(valor: unknown, normalizacao?: string) {
    if (valor === undefined || valor === null || valor === '') return undefined;
    const texto = String(valor);
    if (normalizacao === 'removerMascara') return texto.replace(/\D/g, '');
    if (normalizacao === 'maiusculo') return texto.trim().toUpperCase();
    if (normalizacao === 'minusculo') return texto.trim().toLowerCase();
    if (normalizacao === 'trim') return texto.trim();
    return valor;
  }

  function prepararParametrosApi(api: ApiCadastrada, entrada: Record<string, unknown>) {
    const parametrosSql: Record<string, string | number | boolean | null> = {};
    const erros: { codigo: string; mensagem: string }[] = [];
    for (const parametro of api.parametros ?? []) {
      const valorNormalizado = normalizarParametro(entrada[parametro.nomePublico], parametro.normalizacao);
      if (parametro.obrigatorio && (valorNormalizado === undefined || valorNormalizado === null || valorNormalizado === '')) {
        erros.push({ codigo: 'PARAMETRO_OBRIGATORIO_NAO_INFORMADO', mensagem: `Informe o parametro ${parametro.nomePublico}.` });
      }
      parametrosSql[parametro.nomeTecnico] = (valorNormalizado ?? parametro.valorPadrao ?? null) as string | number | boolean | null;
    }
    const grupos = api.regras?.exigirAoMenosUmGrupo ?? [];
    if (grupos.length) {
      const algumGrupoCompleto = grupos.some((grupo) =>
        grupo.every((nome) => {
          const parametro = api.parametros.find((item) => item.nomePublico === nome || item.nomeTecnico === nome);
          const chave = parametro?.nomeTecnico ?? nome;
          return parametrosSql[chave] !== null && parametrosSql[chave] !== undefined && parametrosSql[chave] !== '';
        })
      );
      if (!algumGrupoCompleto) erros.push({ codigo: 'FILTRO_OBRIGATORIO_NAO_INFORMADO', mensagem: 'Informe ao menos um dos criterios obrigatorios da API.' });
    }
    const periodo = api.regras?.periodoObrigatorioEmConjunto;
    if (periodo) {
      const [inicioNome, fimNome] = periodo;
      const inicioParam = api.parametros.find((item) => item.nomePublico === inicioNome || item.nomeTecnico === inicioNome);
      const fimParam = api.parametros.find((item) => item.nomePublico === fimNome || item.nomeTecnico === fimNome);
      const inicio = parametrosSql[inicioParam?.nomeTecnico ?? inicioNome];
      const fim = parametrosSql[fimParam?.nomeTecnico ?? fimNome];
      if ((inicio && !fim) || (!inicio && fim)) erros.push({ codigo: 'PERIODO_INVALIDO', mensagem: `Informe ${inicioNome} e ${fimNome} em conjunto.` });
    }
    return { parametrosSql, erros };
  }

  function registrarLog(log: Partial<LogChamada>) {
    const registro: LogChamada = {
      id: randomUUID(),
      empresaId: log.empresaId,
      apiId: log.apiId || '',
      clienteConsumidorId: log.clienteConsumidorId,
      tokenId: log.tokenId,
      tokenUtilizado: log.tokenUtilizado,
      metodoHttp: log.metodoHttp,
      endpoint: log.endpoint,
      origemAcesso: log.origemAcesso,
      statusHttp: log.statusHttp ?? 200,
      latenciaMs: log.latenciaMs ?? log.tempoRespostaMs ?? 0,
      tempoRespostaMs: log.tempoRespostaMs ?? log.latenciaMs ?? 0,
      origemIp: log.origemIp || '',
      horario: log.horario || agora(),
      dataHora: log.dataHora || agora(),
      payloadResumo: log.payloadResumo,
      parametrosRecebidos: log.parametrosRecebidos,
      totalRegistros: log.totalRegistros,
      mensagemErro: log.mensagemErro,
      erroCodigo: log.erroCodigo
    };
    logs.unshift(registro);
    void store.salvar('logs', registro);
    return registro;
  }

  await app.register(cors, { origin: true });
  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_request, body, done) => done(null, body));

  const frontendDist = join(process.cwd(), 'apps', 'frontend', 'dist');
  if (existsSync(frontendDist)) {
    await app.register(staticFiles, { root: frontendDist, prefix: '/' });
  }

  app.get('/saude', async () => sucesso({ produto: 'Control S API Hub', status: 'operacional', ambiente: env.nodeEnv, banco: env.productDatabaseProvider }));

  app.post<{ Body: { email?: string; senha?: string; empresaId?: string } }>('/api/auth/login', async (request, reply) => {
    const email = request.body?.email?.trim().toLowerCase();
    const senha = request.body?.senha;
    const usuario = usuarios.find((item) => item.email.toLowerCase() === email && item.status === 'ativo');
    if (!usuario) return reply.status(401).send(erro('CREDENCIAIS_INVALIDAS', 'E-mail ou senha invalidos.'));
    // CONTROL S - ALTERAÇÃO MON: corrige obrigatoriedade de senha no primeiro acesso.
    if (usuario.primeiroAcesso) return reply.status(403).send(erro('PRIMEIRO_ACESSO_NECESSARIO', 'Defina sua senha de primeiro acesso para entrar no Control S API Hub.'));
    if (!senhaConfere(usuario, senha)) return reply.status(401).send(erro('CREDENCIAIS_INVALIDAS', 'E-mail ou senha invalidos.'));

    if (senha && usuario.senhaHash === senha) {
      usuario.senhaHash = hashSenha(senha);
      await store.salvar('usuarios', usuario);
    }

    const empresasUsuario = empresasDoUsuario(usuario.id);
    if (!empresasUsuario.length) {
      if (usuario.perfil !== 'admin') return reply.status(403).send(erro('USUARIO_SEM_EMPRESA', 'Usuario nao possui empresa vinculada. Solicite acesso a um administrador.'));
      const token = randomUUID();
      sessoes.set(token, { usuarioId: usuario.id, perfil: usuario.perfil, empresasIds: [] });
      return sucesso({
        token,
        exigeCadastroEmpresa: true,
        usuario: { id: usuario.id, nome: usuario.nome, nomeUsuario: usuario.nome, email: usuario.email, perfil: usuario.perfil },
        empresas: [],
        empresaSelecionadaId: null
      });
    }
    const empresaSelecionada =
      empresasUsuario.find((empresa) => empresa.id === request.body?.empresaId) ||
      (empresasUsuario.length === 1 ? empresasUsuario[0] : undefined);
    if (!empresaSelecionada) return sucesso({ exigeSelecaoEmpresa: true, empresas: empresasUsuario.map((empresa) => ({ id: empresa.id, nomeEmpresa: empresa.nomeEmpresa, nomeFantasia: empresa.nomeFantasia, perfil: empresa.perfil })) });

    const token = randomUUID();
    const vinculo = usuariosEmpresas.find((item) => item.usuarioId === usuario.id && item.empresaId === empresaSelecionada.id);
    sessoes.set(token, { usuarioId: usuario.id, perfil: vinculo?.perfil ?? usuario.perfil, empresaId: empresaSelecionada.id, empresasIds: empresasUsuario.map((empresa) => empresa.id) });
    return sucesso({
      token,
      usuario: { id: usuario.id, nome: usuario.nome, nomeUsuario: usuario.nome, email: usuario.email, perfil: vinculo?.perfil ?? usuario.perfil },
      empresas: empresasUsuario.map((empresa) => ({ id: empresa.id, nomeEmpresa: empresa.nomeEmpresa, nomeFantasia: empresa.nomeFantasia, perfil: empresa.perfil })),
      empresaSelecionadaId: empresaSelecionada.id
    });
  });

  app.post<{ Body: { email?: string; novaSenha?: string } }>('/api/auth/primeiro-acesso', async (request, reply) => {
    const email = request.body?.email?.trim().toLowerCase();
    const novaSenha = request.body?.novaSenha ?? '';
    const usuario = usuarios.find((item) => item.email.toLowerCase() === email && item.status === 'ativo');
    if (!usuario) return reply.status(404).send(erro('USUARIO_NAO_ENCONTRADO', 'Usuario nao encontrado ou inativo.'));
    // CONTROL S - ALTERAÇÃO MON: corrige obrigatoriedade de senha no primeiro acesso.
    if (!usuario.primeiroAcesso) return reply.status(400).send(erro('PRIMEIRO_ACESSO_JA_CONCLUIDO', 'Este usuario ja definiu a senha inicial.'));
    if (novaSenha.length < 6) return reply.status(400).send(erro('SENHA_INVALIDA', 'A senha deve ter pelo menos 6 caracteres.'));
    usuario.senhaHash = hashSenha(novaSenha);
    usuario.primeiroAcesso = false;
    await store.salvar('usuarios', usuario);
    return sucesso({ mensagem: 'Senha definida com sucesso. Realize o login com a nova senha.' });
  });

  app.post<{ Body: { empresaId?: string } }>('/api/auth/selecionar-empresa', async (request, reply) => {
    const sessao = exigirSessao(request, reply);
    if (!sessao) return;
    const empresaId = request.body?.empresaId;
    if (!empresaId || !sessao.empresasIds.includes(empresaId)) return reply.status(403).send(erro('EMPRESA_NAO_AUTORIZADA', 'Usuario nao esta vinculado a empresa informada.'));
    sessao.empresaId = empresaId;
    return sucesso({ empresaSelecionadaId: empresaId });
  });

  app.get('/api/admin/dashboard', async (request, reply) => {
    const ctx = empresaContexto(request, reply);
    if (!ctx) return;
    const empresaApis = apis.filter((api) => (api.empresaId || api.clienteId) === ctx.empresaId);
    const empresaLogs = logs.filter((log) => log.empresaId === ctx.empresaId || empresaApis.some((api) => api.id === log.apiId));
    return sucesso({
      totalApis: empresaApis.length,
      apisPublicadas: empresaApis.filter((api) => api.status === 'publicado' && api.ativa !== false).length,
      apisRascunho: empresaApis.filter((api) => api.status === 'rascunho').length,
      conexoesAtivas: conexoes.filter((conexao) => (conexao.empresaId || conexao.clienteId) === ctx.empresaId && conexao.status === 'ativa').length,
      clientesAtivos: clientesConsumidores.filter((cliente) => cliente.empresaId === ctx.empresaId && cliente.status === 'ativo').length,
      tokensAtivos: tokens.filter((token) => token.empresaId === ctx.empresaId && token.status === 'ativo').length,
      chamadasUltimas24h: empresaLogs.filter((log) => Date.now() - new Date(log.dataHora || log.horario).getTime() <= 24 * 60 * 60 * 1000).length,
      errosRecentes: empresaLogs.filter((log) => log.statusHttp >= 400).length,
      principaisApisConsumidas: empresaApis.map((api) => ({ nome: api.nome, chamadas: empresaLogs.filter((log) => log.apiId === api.id).length })).sort((a, b) => b.chamadas - a.chamadas).slice(0, 5),
      ultimasPublicacoes: empresaApis.filter((api) => api.publicadaEm || api.ultimaPublicacao).map((api) => ({ nome: api.nome, versao: api.versao, endpoint: api.endpoint, publicadoEm: api.publicadaEm || api.ultimaPublicacao })).slice(0, 5),
      statusConexoes: conexoes.filter((conexao) => (conexao.empresaId || conexao.clienteId) === ctx.empresaId).map((conexao) => ({ id: conexao.id, nome: conexao.nome, status: conexao.status, ultimaValidacao: conexao.ultimaValidacao }))
    });
  });

  app.get('/api/admin/empresas', async (request, reply) => {
    const sessao = exigirSessao(request, reply);
    if (!sessao) return;
    if (sessao.perfil === 'admin' && !sessao.empresasIds.length) return sucesso([]);
    return sucesso(empresas.filter((empresa) => sessao.empresasIds.includes(empresa.id)));
  });
  app.get('/api/admin/clientes', async (request, reply) => {
    const sessao = exigirSessao(request, reply);
    if (!sessao) return;
    if (sessao.perfil === 'admin' && !sessao.empresasIds.length) return sucesso([]);
    return sucesso(empresas.filter((empresa) => sessao.empresasIds.includes(empresa.id)));
  });

  async function salvarEmpresa(request: any, reply: any, id?: string) {
    const sessao = exigirAdmin(request, reply);
    if (!sessao) return;
    const body = request.body ?? {};
    if (!body.nomeEmpresa?.trim()) return reply.status(400).send(erro('DADOS_EMPRESA_INVALIDOS', 'Informe o nome da empresa.'));
    const cnpj = body.cnpj ? somenteDigitos(body.cnpj) : '';
    if (cnpj && empresas.some((empresa) => empresa.id !== id && somenteDigitos(empresa.cnpj) === cnpj)) return reply.status(409).send(erro('CNPJ_JA_CADASTRADO', 'Ja existe uma empresa cadastrada com este CNPJ.'));
    const nomeNormalizado = body.nomeEmpresa.trim().toLowerCase();
    if (empresas.some((empresa) => empresa.id !== id && empresa.nomeEmpresa.trim().toLowerCase() === nomeNormalizado)) {
      return reply.status(409).send(erro('EMPRESA_JA_CADASTRADA', 'Ja existe uma empresa cadastrada com este nome.'));
    }
    const atual = id ? empresas.find((empresa) => empresa.id === id) : undefined;
    if (id && !atual) return reply.status(404).send(erro('EMPRESA_NAO_ENCONTRADA', 'Empresa nao encontrada.'));
    const empresa: Cliente = {
      id: atual?.id || randomUUID(),
      nomeEmpresa: body.nomeEmpresa.trim(),
      nomeFantasia: body.nomeFantasia?.trim() || body.nomeEmpresa.trim(),
      cnpj,
      codigoInterno: body.codigoInterno?.trim() || atual?.codigoInterno || body.nomeEmpresa.trim().toUpperCase().replace(/\W+/g, '_'),
      responsavel: body.responsavel?.trim() || '',
      email: body.email?.trim() || '',
      telefone: body.telefone?.trim() || '',
      ambiente: body.ambiente || atual?.ambiente || 'homologacao',
      status: body.status || atual?.status || 'ativo',
      observacoes: body.observacoes || '',
      dominioPrincipal: body.dominioPrincipal || body.dominioApi || '',
      dominioApi: body.dominioApi || body.subdominioApi || body.dominioPrincipal || '',
      subdominioApi: body.subdominioApi || body.dominioApi || '',
      urlBaseLocal: body.urlBaseLocal || atual?.urlBaseLocal || baseLocal(),
      urlBaseApi: body.urlBaseApi?.replace(/\/+$/, '') || atual?.urlBaseApi,
      dataCadastro: atual?.dataCadastro || agora(),
      dataAtualizacao: agora()
    };
    if (atual) Object.assign(atual, empresa);
    else empresas.unshift(empresa);
    await store.salvar('clientes', empresa);

    if (!atual) {
      const vinculo = vincularUsuarioEmpresa(sessao.usuarioId, empresa.id, 'admin', true);
      await store.salvar('usuariosEmpresas', vinculo);
      if (!sessao.empresasIds.includes(empresa.id)) sessao.empresasIds.push(empresa.id);
      sessao.empresaId = empresa.id;
      sessao.perfil = 'admin';
    }
    return reply.status(atual ? 200 : 201).send(sucesso(empresa));
  }

  app.post('/api/admin/empresas', (request, reply) => salvarEmpresa(request, reply));
  app.post('/api/admin/clientes', (request, reply) => salvarEmpresa(request, reply));
  app.put<{ Params: { id: string } }>('/api/admin/empresas/:id', (request, reply) => salvarEmpresa(request, reply, request.params.id));
  app.put<{ Params: { id: string } }>('/api/admin/clientes/:id', (request, reply) => salvarEmpresa(request, reply, request.params.id));
  app.delete<{ Params: { id: string } }>('/api/admin/empresas/:id', async (request, reply) => {
    const sessao = exigirAdmin(request, reply);
    if (!sessao) return;
    const id = request.params.id;
    const index = empresas.findIndex((empresa) => empresa.id === id);
    if (index < 0) return reply.status(404).send(erro('EMPRESA_NAO_ENCONTRADA', 'Empresa nao encontrada.'));
    if (conexoes.some((conexao) => (conexao.empresaId || conexao.clienteId) === id) || apis.some((api) => (api.empresaId || api.clienteId) === id)) {
      return reply.status(409).send(erro('EMPRESA_EM_USO', 'Nao e possivel excluir empresa vinculada a conexoes ou APIs.'));
    }
    empresas.splice(index, 1);
    await store.excluir('clientes', id);
    for (const vinculo of usuariosEmpresas.filter((item) => item.empresaId === id)) {
      vinculo.ativo = false;
      await store.salvar('usuariosEmpresas', vinculo);
    }
    sessao.empresasIds = sessao.empresasIds.filter((empresaId) => empresaId !== id);
    if (sessao.empresaId === id) sessao.empresaId = sessao.empresasIds[0];
    return sucesso({ id, excluido: true });
  });
  app.delete<{ Params: { id: string } }>('/api/admin/clientes/:id', (request, reply) => app.inject({ method: 'DELETE', url: `/api/admin/empresas/${request.params.id}`, headers: request.headers as any }).then((res) => reply.status(res.statusCode).send(JSON.parse(res.body))));

  app.get('/api/admin/usuarios', async (request, reply) => {
    if (!exigirAdmin(request, reply)) return;
    return sucesso(usuarios.map(({ senhaHash, ...usuario }) => ({ ...usuario, empresasIds: usuariosEmpresas.filter((vinculo) => vinculo.usuarioId === usuario.id && vinculo.ativo).map((vinculo) => vinculo.empresaId) })));
  });
  app.post<{ Body: { nome?: string; email?: string; perfil?: Perfil; status?: 'ativo' | 'inativo'; empresasIds?: string[] } }>('/api/admin/usuarios', async (request, reply) => {
    const sessao = exigirAdmin(request, reply);
    if (!sessao) return;
    const body = request.body ?? {};
    if (!body.nome || !body.email || !body.perfil) return reply.status(400).send(erro('DADOS_USUARIO_INVALIDOS', 'Preencha nome, e-mail e perfil do usuario.'));
    const empresasAutorizadas = body.empresasIds?.length ? body.empresasIds : [sessao.empresaId].filter(Boolean) as string[];
    if (!empresasAutorizadas.length) return reply.status(400).send(erro('EMPRESA_USUARIO_NAO_INFORMADA', 'Selecione ao menos uma empresa para o usuario.'));
    if (empresasAutorizadas.some((empresaId) => !sessao.empresasIds.includes(empresaId))) return reply.status(403).send(erro('EMPRESA_NAO_AUTORIZADA', 'Voce so pode vincular usuarios as empresas que acessa.'));
    if (usuarios.some((usuario) => usuario.email.toLowerCase() === body.email!.toLowerCase())) return reply.status(409).send(erro('EMAIL_JA_CADASTRADO', 'Ja existe um usuario cadastrado com este e-mail.'));
    // CONTROL S - ALTERAÇÃO MON: corrige obrigatoriedade de senha no primeiro acesso.
    const usuario: Usuario = { id: randomUUID(), nome: body.nome, email: body.email.toLowerCase(), perfil: body.perfil, status: body.status || 'ativo', primeiroAcesso: true, criadoEm: agora() };
    usuarios.unshift(usuario);
    await store.salvar('usuarios', usuario);
    for (const empresaId of empresasAutorizadas) {
      const vinculo = vincularUsuarioEmpresa(usuario.id, empresaId, body.perfil, false);
      await store.salvar('usuariosEmpresas', vinculo);
    }
    return reply.status(201).send(sucesso({ ...usuario, empresasIds: usuariosEmpresas.filter((v) => v.usuarioId === usuario.id).map((v) => v.empresaId) }));
  });
  app.put<{ Params: { id: string }; Body: { nome?: string; email?: string; perfil?: Perfil; status?: 'ativo' | 'inativo'; empresasIds?: string[] } }>('/api/admin/usuarios/:id', async (request, reply) => {
    const sessao = exigirAdmin(request, reply);
    if (!sessao) return;
    const usuario = usuarios.find((item) => item.id === request.params.id);
    if (!usuario) return reply.status(404).send(erro('USUARIO_NAO_ENCONTRADO', 'Usuario nao encontrado.'));
    const body = request.body ?? {};
    if (!body.nome || !body.email || !body.perfil) return reply.status(400).send(erro('DADOS_USUARIO_INVALIDOS', 'Preencha nome, e-mail e perfil do usuario.'));
    if (usuarios.some((item) => item.id !== usuario.id && item.email.toLowerCase() === body.email!.toLowerCase())) return reply.status(409).send(erro('EMAIL_JA_CADASTRADO', 'Ja existe outro usuario cadastrado com este e-mail.'));
    usuario.nome = body.nome;
    usuario.email = body.email.toLowerCase();
    usuario.perfil = body.perfil;
    usuario.status = body.status || usuario.status;
    await store.salvar('usuarios', usuario);
    if (body.empresasIds?.length) {
      if (body.empresasIds.some((empresaId) => !sessao.empresasIds.includes(empresaId))) return reply.status(403).send(erro('EMPRESA_NAO_AUTORIZADA', 'Voce so pode vincular usuarios as empresas que acessa.'));
      for (const vinculo of usuariosEmpresas.filter((item) => item.usuarioId === usuario.id)) {
        vinculo.ativo = body.empresasIds.includes(vinculo.empresaId);
        await store.salvar('usuariosEmpresas', vinculo);
      }
      for (const empresaId of body.empresasIds) {
        const vinculo = vincularUsuarioEmpresa(usuario.id, empresaId, body.perfil, false);
        await store.salvar('usuariosEmpresas', vinculo);
      }
    }
    return sucesso({ ...usuario, empresasIds: usuariosEmpresas.filter((v) => v.usuarioId === usuario.id && v.ativo).map((v) => v.empresaId) });
  });
  app.delete<{ Params: { id: string } }>('/api/admin/usuarios/:id', async (request, reply) => {
    if (!exigirAdmin(request, reply)) return;
    const index = usuarios.findIndex((item) => item.id === request.params.id);
    if (index < 0) return reply.status(404).send(erro('USUARIO_NAO_ENCONTRADO', 'Usuario nao encontrado.'));
    usuarios.splice(index, 1);
    await store.excluir('usuarios', request.params.id);
    for (const vinculo of usuariosEmpresas.filter((item) => item.usuarioId === request.params.id)) await store.excluir('usuariosEmpresas', vinculo.id);
    return sucesso({ id: request.params.id, excluido: true });
  });

  app.get('/api/admin/conexoes', async (request, reply) => {
    const ctx = empresaContexto(request, reply);
    if (!ctx) return;
    return sucesso(conexoes.filter((conexao) => (conexao.empresaId || conexao.clienteId) === ctx.empresaId).map(semSenha));
  });
  app.post('/api/admin/conexoes', async (request: any, reply) => {
    const ctx = empresaContexto(request, reply);
    if (!ctx) return;
    const body = request.body ?? {};
    if (!body.nome && !body.nomeConexao) return reply.status(400).send(erro('DADOS_CONEXAO_INVALIDOS', 'Informe o nome da conexao.'));
    if (!body.tipoBanco || !body.host || !body.porta || !body.bancoOuServico || !body.usuario) return reply.status(400).send(erro('DADOS_CONEXAO_INVALIDOS', 'Preencha banco, host, porta, base/service e usuario.'));
    if (conexoes.some((item) => (item.empresaId || item.clienteId) === ctx.empresaId && item.nome.toLowerCase() === String(body.nome || body.nomeConexao).toLowerCase())) return reply.status(409).send(erro('CONEXAO_DUPLICADA', 'Ja existe uma conexao com este nome nesta empresa.'));
    const conexao: ConexaoBanco = {
      id: randomUUID(),
      nome: body.nome || body.nomeConexao,
      nomeConexao: body.nomeConexao || body.nome,
      clienteId: ctx.empresaId,
      empresaId: ctx.empresaId,
      tipoBanco: body.tipoBanco,
      host: body.host,
      porta: Number(body.porta),
      bancoOuServico: body.bancoOuServico,
      usuario: body.usuario,
      senhaCriptografada: criptografarSenhaConexao(body.senha || ''),
      stringConexaoOpcional: body.stringConexaoOpcional || '',
      ambiente: body.ambiente || 'homologacao',
      status: body.status || 'ativa',
      observacoes: body.observacoes || '',
      dataCadastro: agora(),
      dataAtualizacao: agora()
    };
    conexoes.unshift(conexao);
    await store.salvar('conexoes', conexao);
    return reply.status(201).send(sucesso(semSenha(conexao)));
  });
  app.put<{ Params: { id: string } }>('/api/admin/conexoes/:id', async (request: any, reply) => {
    const ctx = empresaContexto(request, reply);
    if (!ctx) return;
    const conexao = conexoes.find((item) => item.id === request.params.id && (item.empresaId || item.clienteId) === ctx.empresaId);
    if (!conexao) return reply.status(404).send(erro('CONEXAO_NAO_ENCONTRADA', 'Conexao nao encontrada.'));
    const body = request.body ?? {};
    Object.assign(conexao, {
      nome: body.nome || body.nomeConexao || conexao.nome,
      nomeConexao: body.nomeConexao || body.nome || conexao.nomeConexao,
      tipoBanco: body.tipoBanco || conexao.tipoBanco,
      host: body.host || conexao.host,
      porta: Number(body.porta || conexao.porta),
      bancoOuServico: body.bancoOuServico || conexao.bancoOuServico,
      usuario: body.usuario || conexao.usuario,
      stringConexaoOpcional: body.stringConexaoOpcional || '',
      ambiente: body.ambiente || conexao.ambiente,
      status: body.status || conexao.status,
      observacoes: body.observacoes || '',
      dataAtualizacao: agora()
    });
    if (body.senha) conexao.senhaCriptografada = criptografarSenhaConexao(body.senha);
    await store.salvar('conexoes', conexao);
    return sucesso(semSenha(conexao));
  });
  app.delete<{ Params: { id: string } }>('/api/admin/conexoes/:id', async (request, reply) => {
    const ctx = empresaContexto(request, reply);
    if (!ctx) return;
    const index = conexoes.findIndex((item) => item.id === request.params.id && (item.empresaId || item.clienteId) === ctx.empresaId);
    if (index < 0) return reply.status(404).send(erro('CONEXAO_NAO_ENCONTRADA', 'Conexao nao encontrada.'));
    if (apis.some((api) => api.conexaoId === request.params.id)) return reply.status(409).send(erro('CONEXAO_EM_USO', 'Nao e possivel excluir conexao vinculada a API.'));
    conexoes.splice(index, 1);
    await store.excluir('conexoes', request.params.id);
    return sucesso({ id: request.params.id, excluido: true });
  });
  app.post<{ Params: { id: string } }>('/api/admin/conexoes/:id/testar', async (request, reply) => {
    const ctx = empresaContexto(request, reply);
    if (!ctx) return;
    const conexao = conexoes.find((item) => item.id === request.params.id && (item.empresaId || item.clienteId) === ctx.empresaId);
    if (!conexao) return reply.status(404).send(erro('CONEXAO_NAO_ENCONTRADA', 'Conexao nao encontrada.'));
    const resultado = await conexaoFactory.testar(conexao);
    conexao.ultimaValidacao = resultado.dataHora;
    await store.salvar('conexoes', conexao);
    return sucesso(resultado);
  });

  app.get('/api/admin/apis', async (request, reply) => {
    const ctx = empresaContexto(request, reply);
    if (!ctx) return;
    return sucesso(apis.filter((api) => (api.empresaId || api.clienteId) === ctx.empresaId).map((api) => ({ ...api, previewDocumentacao: gerarPreview(api, empresas.find((empresa) => empresa.id === ctx.empresaId)) })));
  });
  app.post('/api/admin/apis', async (request: any, reply) => {
    const ctx = empresaContexto(request, reply);
    if (!ctx) return;
    const body = request.body ?? {};
    if (!body.nome && !body.nomeApi) return reply.status(400).send(erro('DADOS_API_INVALIDOS', 'Informe o nome da API.'));
    if (!body.endpoint && !body.rotaPublica) return reply.status(400).send(erro('DADOS_API_INVALIDOS', 'Informe a rota publica da API.'));
    if (body.metodoHttp && body.metodoHttp !== 'GET') return reply.status(400).send(erro('METODO_HTTP_NAO_SUPORTADO', 'Nesta versao, o Control S API Hub publica somente APIs de consulta pelo metodo GET.'));
    if (!body.conexaoId || !conexoes.some((conexao) => conexao.id === body.conexaoId && (conexao.empresaId || conexao.clienteId) === ctx.empresaId)) return reply.status(400).send(erro('CONEXAO_NAO_ENCONTRADA', 'Selecione uma conexao valida da empresa.'));
    const endpoint = normalizarRota(body.endpoint || body.rotaPublica);
    if (apis.some((api) => (api.empresaId || api.clienteId) === ctx.empresaId && api.endpoint === endpoint)) return reply.status(409).send(erro('API_DUPLICADA', 'Ja existe uma API cadastrada com esta rota nesta empresa.'));
    const api: ApiCadastrada = {
      id: randomUUID(),
      nome: body.nome || body.nomeApi,
      nomeApi: body.nomeApi || body.nome,
      codigoInterno: body.codigoInterno || String(body.nome || body.nomeApi).toUpperCase().replace(/\W+/g, '_'),
      clienteId: ctx.empresaId,
      empresaId: ctx.empresaId,
      descricao: body.descricao || 'API corporativa criada pelo Control S API Hub.',
      versao: body.versao || '1.0.0',
      categoria: body.categoria || 'Corporativo',
      status: 'rascunho',
      metodoHttp: 'GET',
      endpoint,
      rotaPublica: endpoint,
      origemDados: 'Consulta SQL cadastrada',
      conexaoId: body.conexaoId,
      tipoExecucao: 'consultaSql',
      autenticacao: 'bearerToken',
      paginacaoHabilitada: body.paginacaoHabilitada ?? true,
      ativa: true,
      exigeToken: body.exigeToken ?? true,
      permitePaginacao: body.permitePaginacao ?? true,
      timeoutSegundos: Number(body.timeoutSegundos || 30),
      dataCriacao: agora(),
      dataAtualizacao: agora(),
      sqlBase: body.sqlBase || '',
      apiSql: { id: randomUUID(), sqlOriginal: body.sqlBase || '', parametrosTeste: body.parametrosTeste ?? { pagina: 1, pageSize: 500 }, dataCadastro: agora(), dataAtualizacao: agora() },
      parametros: body.parametros || [],
      campos: body.campos || [],
      regras: regrasPadrao({ regras: body.regras } as ApiCadastrada)
    };
    apis.unshift(api);
    await store.salvar('apis', api);
    return reply.status(201).send(sucesso({ ...api, previewDocumentacao: gerarPreview(api, empresas.find((empresa) => empresa.id === ctx.empresaId)) }));
  });
  app.put<{ Params: { id: string } }>('/api/admin/apis/:id', async (request: any, reply) => {
    const ctx = empresaContexto(request, reply);
    if (!ctx) return;
    const api = apis.find((item) => item.id === request.params.id && (item.empresaId || item.clienteId) === ctx.empresaId);
    if (!api) return reply.status(404).send(erro('API_NAO_ENCONTRADA', 'API nao encontrada.'));
    const body = request.body ?? {};
    if (body.metodoHttp && body.metodoHttp !== 'GET') return reply.status(400).send(erro('METODO_HTTP_NAO_SUPORTADO', 'Nesta versao, o Control S API Hub publica somente APIs de consulta pelo metodo GET.'));
    const endpoint = body.endpoint || body.rotaPublica ? normalizarRota(body.endpoint || body.rotaPublica) : api.endpoint;
    if (apis.some((item) => item.id !== api.id && (item.empresaId || item.clienteId) === ctx.empresaId && item.endpoint === endpoint)) return reply.status(409).send(erro('API_DUPLICADA', 'Ja existe outra API cadastrada com esta rota nesta empresa.'));
    if (body.conexaoId && !conexoes.some((conexao) => conexao.id === body.conexaoId && (conexao.empresaId || conexao.clienteId) === ctx.empresaId)) return reply.status(400).send(erro('CONEXAO_NAO_ENCONTRADA', 'Selecione uma conexao valida da empresa.'));
    Object.assign(api, {
      nome: body.nome || body.nomeApi || api.nome,
      nomeApi: body.nomeApi || body.nome || api.nomeApi,
      codigoInterno: body.codigoInterno || api.codigoInterno,
      descricao: body.descricao || api.descricao,
      versao: body.versao || api.versao,
      categoria: body.categoria || api.categoria,
      metodoHttp: 'GET',
      endpoint,
      rotaPublica: endpoint,
      conexaoId: body.conexaoId || api.conexaoId,
      paginacaoHabilitada: body.paginacaoHabilitada ?? api.paginacaoHabilitada,
      permitePaginacao: body.permitePaginacao ?? api.permitePaginacao,
      exigeToken: body.exigeToken ?? api.exigeToken,
      timeoutSegundos: Number(body.timeoutSegundos || api.timeoutSegundos || 30),
      ativa: body.ativa ?? api.ativa,
      dataAtualizacao: agora()
    });
    if (typeof body.sqlBase === 'string') {
      api.sqlBase = body.sqlBase;
      api.apiSql = { ...(api.apiSql || { id: randomUUID(), dataCadastro: agora() }), sqlOriginal: body.sqlBase, sqlTratada: body.sqlBase, parametrosTeste: body.parametrosTeste ?? api.apiSql?.parametrosTeste ?? parametrosTestePadrao(api), dataAtualizacao: agora() };
      api.campos = inferirCampos(body.sqlBase);
    }
    if (Array.isArray(body.parametros)) api.parametros = body.parametros.map((parametro: ParametroApi) => ({ ...parametro, id: parametro.id || randomUUID() }));
    api.regras = regrasPadrao({ ...api, regras: { ...api.regras, ...(body.regras || {}) } });
    await store.salvar('apis', api);
    return sucesso({ ...api, previewDocumentacao: gerarPreview(api, empresas.find((empresa) => empresa.id === ctx.empresaId)) });
  });
  app.delete<{ Params: { id: string } }>('/api/admin/apis/:id', async (request, reply) => {
    const ctx = empresaContexto(request, reply);
    if (!ctx) return;
    const index = apis.findIndex((api) => api.id === request.params.id && (api.empresaId || api.clienteId) === ctx.empresaId);
    if (index < 0) return reply.status(404).send(erro('API_NAO_ENCONTRADA', 'API nao encontrada.'));
    apis.splice(index, 1);
    await store.excluir('apis', request.params.id);
    return sucesso({ id: request.params.id, excluido: true });
  });
  app.put<{ Params: { id: string }; Body: { sqlBase: string; parametrosTeste?: Record<string, unknown> } }>('/api/admin/apis/:id/sql', async (request, reply) => {
    const ctx = empresaContexto(request, reply);
    if (!ctx) return;
    const api = apis.find((item) => item.id === request.params.id && (item.empresaId || item.clienteId) === ctx.empresaId);
    if (!api) return reply.status(404).send(erro('API_NAO_ENCONTRADA', 'API nao encontrada.'));
    api.sqlBase = request.body.sqlBase || '';
    api.apiSql = { ...(api.apiSql || { id: randomUUID(), dataCadastro: agora() }), sqlOriginal: api.sqlBase, sqlTratada: api.sqlBase, parametrosTeste: request.body.parametrosTeste ?? api.apiSql?.parametrosTeste ?? parametrosTestePadrao(api), dataAtualizacao: agora() };
    api.campos = inferirCampos(api.sqlBase);
    api.dataAtualizacao = agora();
    await store.salvar('apis', api);
    return sucesso({ api, camposInferidos: api.campos, previewDocumentacao: gerarPreview(api, empresas.find((empresa) => empresa.id === ctx.empresaId)) });
  });
  app.put<{ Params: { id: string }; Body: { parametros?: ParametroApi[]; regras?: ApiCadastrada['regras']; parametrosTeste?: Record<string, unknown> } }>('/api/admin/apis/:id/parametros', async (request, reply) => {
    const ctx = empresaContexto(request, reply);
    if (!ctx) return;
    const api = apis.find((item) => item.id === request.params.id && (item.empresaId || item.clienteId) === ctx.empresaId);
    if (!api) return reply.status(404).send(erro('API_NAO_ENCONTRADA', 'API nao encontrada.'));
    if (!Array.isArray(request.body.parametros)) return reply.status(400).send(erro('PARAMETROS_INVALIDOS', 'Informe a lista de parametros da API.'));
    api.parametros = request.body.parametros.map((parametro) => ({ ...parametro, id: parametro.id || randomUUID() }));
    api.regras = regrasPadrao({ ...api, regras: { ...api.regras, ...(request.body.regras || {}) } });
    api.apiSql = { ...(api.apiSql || { id: randomUUID(), sqlOriginal: api.sqlBase || '', dataCadastro: agora() }), parametrosTeste: request.body.parametrosTeste ?? api.apiSql?.parametrosTeste ?? parametrosTestePadrao(api), dataAtualizacao: agora() };
    api.dataAtualizacao = agora();
    await store.salvar('apis', api);
    return sucesso({ ...api, previewDocumentacao: gerarPreview(api, empresas.find((empresa) => empresa.id === ctx.empresaId)) });
  });
  app.post<{ Params: { id: string }; Body: { parametros?: Record<string, string> } }>('/api/admin/apis/:id/testar-sql', async (request, reply) => {
    const ctx = empresaContexto(request, reply);
    if (!ctx) return;
    const api = apis.find((item) => item.id === request.params.id && (item.empresaId || item.clienteId) === ctx.empresaId);
    if (!api) return reply.status(404).send(erro('API_NAO_ENCONTRADA', 'API nao encontrada.'));
    const conexao = conexoes.find((item) => item.id === api.conexaoId);
    if (!conexao) return reply.status(400).send(erro('CONEXAO_NAO_ENCONTRADA', 'Conexao da API nao encontrada.'));
    const inicio = Date.now();
    try {
      const registros = await sqlExecutor.executar(conexao, api.sqlBase, request.body?.parametros ?? {});
      api.apiSql = { ...(api.apiSql || { id: randomUUID(), dataCadastro: agora() }), sqlOriginal: api.sqlBase, parametrosTeste: request.body?.parametros ?? api.apiSql?.parametrosTeste ?? parametrosTestePadrao(api), ultimoTesteOk: true, ultimaExecucaoTeste: agora(), previewResposta: registros, dataAtualizacao: agora() };
      api.campos = api.campos?.length ? api.campos : inferirCampos(api.sqlBase);
      await store.salvar('apis', api);
      registrarLog({ empresaId: ctx.empresaId, apiId: api.id, metodoHttp: 'TESTE_SQL', endpoint: api.endpoint, statusHttp: 200, tempoRespostaMs: Date.now() - inicio, origemIp: request.ip, origemAcesso: 'local', parametrosRecebidos: request.body?.parametros, totalRegistros: Array.isArray(registros) ? registros.length : 0 });
      return sucesso({ colunas: Array.isArray(registros) && registros[0] ? Object.keys(registros[0]) : api.campos.map((campo) => campo.nomePublico), quantidadeLinhas: Array.isArray(registros) ? registros.length : 0, amostra: registros }, { pagina: 1, quantidadePorPagina: Array.isArray(registros) ? registros.length : 0, totalRegistros: Array.isArray(registros) ? registros.length : 0 });
    } catch (error) {
      api.apiSql = { ...(api.apiSql || { id: randomUUID(), dataCadastro: agora() }), sqlOriginal: api.sqlBase, parametrosTeste: request.body?.parametros ?? api.apiSql?.parametrosTeste ?? parametrosTestePadrao(api), ultimoTesteOk: false, ultimaExecucaoTeste: agora(), dataAtualizacao: agora() };
      await store.salvar('apis', api);
      registrarLog({ empresaId: ctx.empresaId, apiId: api.id, metodoHttp: 'TESTE_SQL', endpoint: api.endpoint, statusHttp: 400, tempoRespostaMs: Date.now() - inicio, origemIp: request.ip, origemAcesso: 'local', mensagemErro: error instanceof Error ? error.message : 'Erro ao executar SQL.', erroCodigo: 'ERRO_EXECUCAO_SQL' });
      return reply.status(400).send(erro('ERRO_EXECUCAO_SQL', error instanceof Error ? error.message : 'Erro ao executar consulta SQL.'));
    }
  });
  app.post<{ Params: { id: string } }>('/api/admin/apis/:id/validar', async (request, reply) => {
    const ctx = empresaContexto(request, reply);
    if (!ctx) return;
    const api = apis.find((item) => item.id === request.params.id && (item.empresaId || item.clienteId) === ctx.empresaId);
    if (!api) return reply.status(404).send(erro('API_NAO_ENCONTRADA', 'API nao encontrada.'));
    if (!api.sqlBase?.trim()) return reply.status(400).send(erro('SQL_NAO_INFORMADO', 'Informe e salve a consulta SQL antes de validar a API.'));
    if (!api.conexaoId) return reply.status(400).send(erro('CONEXAO_NAO_INFORMADA', 'Informe a conexao da API.'));
    return sucesso({ valida: true, previewDocumentacao: gerarPreview(api, empresas.find((empresa) => empresa.id === ctx.empresaId)) });
  });
  app.post<{ Params: { id: string } }>('/api/admin/apis/:id/publicar', async (request, reply) => {
    const ctx = empresaContexto(request, reply);
    if (!ctx) return;
    const api = apis.find((item) => item.id === request.params.id && (item.empresaId || item.clienteId) === ctx.empresaId);
    if (!api) return reply.status(404).send(erro('API_NAO_ENCONTRADA', 'API nao encontrada.'));
    if (!api.sqlBase?.trim()) return reply.status(400).send(erro('SQL_NAO_INFORMADO', 'Informe e salve a consulta SQL antes de publicar a API.'));
    api.status = 'publicado';
    api.ativa = true;
    api.publicadaEm = agora();
    api.ultimaPublicacao = api.publicadaEm;
    api.dataAtualizacao = agora();
    await store.salvar('apis', api);
    return sucesso({ ...api, urls: montarUrlPublica(empresas.find((empresa) => empresa.id === ctx.empresaId), api.endpoint), previewDocumentacao: gerarPreview(api, empresas.find((empresa) => empresa.id === ctx.empresaId)) });
  });
  app.post<{ Params: { id: string } }>('/api/admin/apis/:id/despublicar', async (request, reply) => {
    const ctx = empresaContexto(request, reply);
    if (!ctx) return;
    const api = apis.find((item) => item.id === request.params.id && (item.empresaId || item.clienteId) === ctx.empresaId);
    if (!api) return reply.status(404).send(erro('API_NAO_ENCONTRADA', 'API nao encontrada.'));
    api.status = 'despublicado';
    api.ativa = false;
    api.dataAtualizacao = agora();
    await store.salvar('apis', api);
    return sucesso(api);
  });
  app.get<{ Params: { id: string } }>('/api/admin/apis/:id/openapi.json', async (request, reply) => {
    const ctx = empresaContexto(request, reply);
    if (!ctx) return;
    const api = apis.find((item) => item.id === request.params.id && (item.empresaId || item.clienteId) === ctx.empresaId);
    if (!api) return reply.status(404).send(erro('API_NAO_ENCONTRADA', 'API nao encontrada.'));
    return docs.gerar(api, montarUrlPublica(empresas.find((empresa) => empresa.id === ctx.empresaId), api.endpoint).publica || baseLocal());
  });

  app.get('/api/admin/clientes-consumidores', async (request, reply) => {
    const ctx = empresaContexto(request, reply);
    if (!ctx) return;
    return sucesso(clientesConsumidores.filter((cliente) => cliente.empresaId === ctx.empresaId));
  });
  app.post('/api/admin/clientes-consumidores', async (request: any, reply) => {
    const ctx = empresaContexto(request, reply);
    if (!ctx) return;
    const body = request.body ?? {};
    if (!body.nomeCliente) return reply.status(400).send(erro('DADOS_CLIENTE_CONSUMIDOR_INVALIDOS', 'Informe o nome do cliente consumidor.'));
    if (clientesConsumidores.some((cliente) => cliente.empresaId === ctx.empresaId && cliente.nomeCliente.toLowerCase() === body.nomeCliente.toLowerCase())) return reply.status(409).send(erro('CLIENTE_CONSUMIDOR_DUPLICADO', 'Ja existe cliente consumidor com este nome nesta empresa.'));
    const tokenBruto = `cs_${ctx.empresaId.replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase()}_${randomUUID().replace(/-/g, '')}`;
    const consumidor: ClienteConsumidor = { id: randomUUID(), empresaId: ctx.empresaId, nomeCliente: body.nomeCliente, descricao: body.descricao || '', emailResponsavel: body.emailResponsavel || '', telefone: body.telefone || '', tokenMascarado: mascararToken(tokenBruto), tokenHash: hashToken(tokenBruto), status: body.status || 'ativo', dataExpiracaoToken: body.dataExpiracaoToken || undefined, observacoes: body.observacoes || '', dataCadastro: agora(), dataAtualizacao: agora() };
    clientesConsumidores.unshift(consumidor);
    await store.salvar('clientesConsumidores', consumidor);
    const token: TokenAcesso = { id: randomUUID(), nome: `Token ${consumidor.nomeCliente}`, clienteId: ctx.empresaId, empresaId: ctx.empresaId, clienteConsumidorId: consumidor.id, parceiro: consumidor.nomeCliente, tokenMascarado: consumidor.tokenMascarado, tokenHash: consumidor.tokenHash, status: consumidor.status, expiraEm: consumidor.dataExpiracaoToken, observacao: consumidor.observacoes, criadoEm: agora() };
    tokens.unshift(token);
    await store.salvar('tokens', token);
    return reply.status(201).send(sucesso({ ...consumidor, tokenGerado: tokenBruto }));
  });
  app.put<{ Params: { id: string } }>('/api/admin/clientes-consumidores/:id', async (request: any, reply) => {
    const ctx = empresaContexto(request, reply);
    if (!ctx) return;
    const consumidor = clientesConsumidores.find((item) => item.id === request.params.id && item.empresaId === ctx.empresaId);
    if (!consumidor) return reply.status(404).send(erro('CLIENTE_CONSUMIDOR_NAO_ENCONTRADO', 'Cliente consumidor nao encontrado.'));
    const body = request.body ?? {};
    Object.assign(consumidor, { nomeCliente: body.nomeCliente || consumidor.nomeCliente, descricao: body.descricao || '', emailResponsavel: body.emailResponsavel || '', telefone: body.telefone || '', status: body.status || consumidor.status, dataExpiracaoToken: body.dataExpiracaoToken || undefined, observacoes: body.observacoes || '', dataAtualizacao: agora() });
    await store.salvar('clientesConsumidores', consumidor);
    for (const token of tokens.filter((item) => item.clienteConsumidorId === consumidor.id)) {
      token.status = consumidor.status;
      token.expiraEm = consumidor.dataExpiracaoToken;
      token.parceiro = consumidor.nomeCliente;
      await store.salvar('tokens', token);
    }
    return sucesso(consumidor);
  });
  app.post<{ Params: { id: string } }>('/api/admin/clientes-consumidores/:id/regenerar-token', async (request, reply) => {
    const ctx = empresaContexto(request, reply);
    if (!ctx) return;
    const consumidor = clientesConsumidores.find((item) => item.id === request.params.id && item.empresaId === ctx.empresaId);
    if (!consumidor) return reply.status(404).send(erro('CLIENTE_CONSUMIDOR_NAO_ENCONTRADO', 'Cliente consumidor nao encontrado.'));
    const tokenBruto = `cs_${ctx.empresaId.replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase()}_${randomUUID().replace(/-/g, '')}`;
    consumidor.tokenMascarado = mascararToken(tokenBruto);
    consumidor.tokenHash = hashToken(tokenBruto);
    consumidor.dataAtualizacao = agora();
    await store.salvar('clientesConsumidores', consumidor);
    for (const token of tokens.filter((item) => item.clienteConsumidorId === consumidor.id)) {
      token.tokenMascarado = consumidor.tokenMascarado;
      token.tokenHash = consumidor.tokenHash;
      await store.salvar('tokens', token);
    }
    return sucesso({ ...consumidor, tokenGerado: tokenBruto });
  });
  app.delete<{ Params: { id: string } }>('/api/admin/clientes-consumidores/:id', async (request, reply) => {
    const ctx = empresaContexto(request, reply);
    if (!ctx) return;
    const index = clientesConsumidores.findIndex((item) => item.id === request.params.id && item.empresaId === ctx.empresaId);
    if (index < 0) return reply.status(404).send(erro('CLIENTE_CONSUMIDOR_NAO_ENCONTRADO', 'Cliente consumidor nao encontrado.'));
    clientesConsumidores.splice(index, 1);
    await store.excluir('clientesConsumidores', request.params.id);
    return sucesso({ id: request.params.id, excluido: true });
  });

  app.get('/api/admin/tokens', async (request, reply) => {
    const ctx = empresaContexto(request, reply);
    if (!ctx) return;
    return sucesso(tokens.filter((token) => token.empresaId === ctx.empresaId || token.clienteId === ctx.empresaId));
  });
  app.post('/api/admin/tokens', async (request: any, reply) => {
    const ctx = empresaContexto(request, reply);
    if (!ctx) return;
    const body = request.body ?? {};
    if (!body.nome || !body.parceiro) return reply.status(400).send(erro('DADOS_TOKEN_INVALIDOS', 'Preencha nome e parceiro do token.'));
    const consumidorExistente = body.clienteConsumidorId
      ? clientesConsumidores.find((cliente) => cliente.id === body.clienteConsumidorId && cliente.empresaId === ctx.empresaId)
      : undefined;
    const consumidor =
      consumidorExistente ||
      ({
        id: randomUUID(),
        empresaId: ctx.empresaId,
        nomeCliente: body.parceiro,
        descricao: body.observacao || '',
        emailResponsavel: body.emailResponsavel || '',
        telefone: '',
        tokenMascarado: '',
        status: body.status || 'ativo',
        dataExpiracaoToken: body.expiraEm || undefined,
        observacoes: body.observacao || '',
        dataCadastro: agora(),
        dataAtualizacao: agora()
      } as ClienteConsumidor);
    const tokenBruto = `cs_${ctx.empresaId.replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase()}_${randomUUID().replace(/-/g, '')}`;
    consumidor.tokenMascarado = mascararToken(tokenBruto);
    consumidor.tokenHash = hashToken(tokenBruto);
    if (!consumidorExistente) {
      clientesConsumidores.unshift(consumidor);
      await store.salvar('clientesConsumidores', consumidor);
    } else {
      await store.salvar('clientesConsumidores', consumidor);
    }
    const token: TokenAcesso = {
      id: randomUUID(),
      nome: body.nome,
      clienteId: ctx.empresaId,
      empresaId: ctx.empresaId,
      clienteConsumidorId: consumidor.id,
      parceiro: body.parceiro,
      tokenMascarado: consumidor.tokenMascarado,
      tokenHash: consumidor.tokenHash,
      status: body.status || 'ativo',
      expiraEm: body.expiraEm || undefined,
      observacao: body.observacao || '',
      criadoEm: agora()
    };
    tokens.unshift(token);
    await store.salvar('tokens', token);
    return reply.status(201).send(sucesso({ ...token, tokenGerado: tokenBruto }));
  });
  app.put<{ Params: { id: string } }>('/api/admin/tokens/:id', async (request: any, reply) => {
    const ctx = empresaContexto(request, reply);
    if (!ctx) return;
    const token = tokens.find((item) => item.id === request.params.id && (item.empresaId === ctx.empresaId || item.clienteId === ctx.empresaId));
    if (!token) return reply.status(404).send(erro('TOKEN_NAO_ENCONTRADO', 'Token nao encontrado.'));
    const body = request.body ?? {};
    token.nome = body.nome || token.nome;
    token.parceiro = body.parceiro || token.parceiro;
    token.status = body.status || token.status;
    token.expiraEm = body.expiraEm || undefined;
    token.observacao = body.observacao || '';
    await store.salvar('tokens', token);
    return sucesso(token);
  });
  app.delete<{ Params: { id: string } }>('/api/admin/tokens/:id', async (request, reply) => {
    const ctx = empresaContexto(request, reply);
    if (!ctx) return;
    const index = tokens.findIndex((item) => item.id === request.params.id && (item.empresaId === ctx.empresaId || item.clienteId === ctx.empresaId));
    if (index < 0) return reply.status(404).send(erro('TOKEN_NAO_ENCONTRADO', 'Token nao encontrado.'));
    tokens.splice(index, 1);
    await store.excluir('tokens', request.params.id);
    return sucesso({ id: request.params.id, excluido: true });
  });
  app.get('/api/admin/logs', async (request, reply) => {
    const ctx = empresaContexto(request, reply);
    if (!ctx) return;
    const empresaApis = apis.filter((api) => (api.empresaId || api.clienteId) === ctx.empresaId).map((api) => api.id);
    return sucesso(logs.filter((log) => log.empresaId === ctx.empresaId || empresaApis.includes(log.apiId)));
  });
  app.delete<{ Params: { id: string } }>('/api/admin/logs/:id', async (request, reply) => {
    const ctx = empresaContexto(request, reply);
    if (!ctx) return;
    const index = logs.findIndex((log) => log.id === request.params.id && (log.empresaId === ctx.empresaId || apis.some((api) => api.id === log.apiId && (api.empresaId || api.clienteId) === ctx.empresaId)));
    if (index < 0) return reply.status(404).send(erro('LOG_NAO_ENCONTRADO', 'Log nao encontrado.'));
    logs.splice(index, 1);
    await store.excluir('logs', request.params.id);
    return sucesso({ id: request.params.id, excluido: true });
  });

  app.get('/api/admin/identidade', async () => sucesso(store.identidade));
  app.put('/api/admin/identidade', async (request: any) => {
    store.identidade.nomeLoja = request.body?.nomeLoja?.trim() || request.body?.nome?.trim() || store.identidade.nomeLoja;
    store.identidade.logoUrl = request.body?.logoUrl?.trim() || store.identidade.logoUrl;
    if (Object.prototype.hasOwnProperty.call(request.body ?? {}, 'descricaoCurta')) {
      store.identidade.descricaoCurta = request.body?.descricaoCurta?.trim() || '';
    } else {
      store.identidade.descricaoCurta = store.identidade.descricaoCurta || 'Loja integrada';
    }
    await store.salvarConfiguracao('identidade_loja', store.identidade);
    return sucesso(store.identidade);
  });
  app.get('/api/admin/publicacao', async (request, reply) => {
    const ctx = empresaContexto(request, reply);
    if (!ctx) return;
    const empresa = empresas.find((item) => item.id === ctx.empresaId);
    const base = empresa?.urlBaseApi || (empresa?.dominioApi ? `https://${empresa.dominioApi}` : empresa?.urlBaseLocal || baseLocal());
    return sucesso({ ...store.publicacao, dominioPrincipal: empresa?.dominioPrincipal || '', subdominioApi: empresa?.subdominioApi || '', urlBaseLocal: empresa?.urlBaseLocal || baseLocal(), urlBaseApi: base, urlBaseDocumentacao: `${base}/swagger` });
  });
  app.put('/api/admin/publicacao', async (request: any, reply) => {
    const ctx = empresaContexto(request, reply);
    if (!ctx) return;
    const empresa = empresas.find((item) => item.id === ctx.empresaId);
    if (!empresa) return reply.status(404).send(erro('EMPRESA_NAO_ENCONTRADA', 'Empresa nao encontrada.'));
    empresa.ambiente = request.body?.ambiente || empresa.ambiente;
    empresa.dominioPrincipal = request.body?.dominioPrincipal || empresa.dominioPrincipal;
    empresa.subdominioApi = request.body?.subdominioApi || empresa.subdominioApi;
    empresa.urlBaseApi = request.body?.urlBaseApi?.replace(/\/+$/, '') || empresa.urlBaseApi;
    empresa.dominioApi = request.body?.urlBaseApi?.replace(/^https?:\/\//i, '').replace(/\/+$/, '') || request.body?.subdominioApi || empresa.dominioApi;
    empresa.urlBaseLocal = request.body?.urlBaseLocal || empresa.urlBaseLocal || baseLocal();
    empresa.dataAtualizacao = agora();
    await store.salvar('clientes', empresa);
    const base = empresa.urlBaseApi || (empresa.dominioApi ? `https://${empresa.dominioApi}` : empresa.urlBaseLocal || baseLocal());
    return sucesso({ ...store.publicacao, ambiente: empresa.ambiente, dominioPrincipal: empresa.dominioPrincipal || '', subdominioApi: empresa.subdominioApi || '', urlBaseLocal: empresa.urlBaseLocal || baseLocal(), urlBaseApi: base, urlBaseDocumentacao: `${base}/swagger` });
  });

  app.get('/documentacao/openapi.json', async (request) => {
    const empresaId = (request.query as any)?.empresaId;
    const apisPublicadas = apis.filter((api) => api.status === 'publicado' && api.ativa !== false && (!empresaId || (api.empresaId || api.clienteId) === empresaId));
    return {
      openapi: '3.0.3',
      info: { title: 'Documentacao publica - Control S API Hub', description: 'Catalogo publico gerado somente com APIs publicadas e ativas.', version: '1.0.0' },
      servers: [{ url: baseLocal(), description: 'URL local do Control S API Hub' }],
      paths: Object.assign({}, ...apisPublicadas.map((api) => docs.gerar(api, montarUrlPublica(empresas.find((empresa) => empresa.id === (api.empresaId || api.clienteId)), api.endpoint).publica || baseLocal()).paths)),
      components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'Token' } } }
    };
  });
  app.get('/swagger', async (_request, reply) => reply.type('text/html').send(`<!doctype html><html lang="pt-BR"><head><title>Control S API Hub - Swagger Publico</title><link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"></head><body><div id="swagger-ui"></div><script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script><script>SwaggerUIBundle({url:'/documentacao/openapi.json',dom_id:'#swagger-ui',docExpansion:'list'});</script></body></html>`));
  app.get('/documentacao', async (_request, reply) => reply.redirect('/swagger'));

  app.get('/v1/parceiros/comissoes', async (request, reply) => {
    const api = apis.find((item) => item.endpoint === '/v1/parceiros/comissoes' && item.status === 'publicado' && item.ativa !== false);
    if (!api) return reply.status(404).send(erro('API_PUBLICADA_NAO_ENCONTRADA', 'API publicada nao encontrada para o endpoint informado.'));
    const autorizacao = validarTokenPublico(request, api);
    if (!autorizacao.valido) return reply.status(autorizacao.status).send(erro(autorizacao.codigo, autorizacao.mensagem));
    const inicio = Date.now();
    const resultado = engine.executarParceirosComissoes(api, request.query as Record<string, string | undefined>);
    registrarLog({ empresaId: api.empresaId || api.clienteId, apiId: api.id, clienteConsumidorId: autorizacao.token?.clienteConsumidorId, tokenId: autorizacao.token?.id, metodoHttp: 'GET', endpoint: api.endpoint, statusHttp: resultado.status, tempoRespostaMs: Date.now() - inicio, origemIp: request.ip, origemAcesso: 'local', parametrosRecebidos: request.query as Record<string, unknown>, totalRegistros: Array.isArray((resultado.body as any).dados) ? (resultado.body as any).dados.length : 0, erroCodigo: resultado.status >= 400 ? (resultado.body as any).erro?.codigo : undefined });
    return reply.status(resultado.status).send(resultado.body);
  });
  app.all('/v1/*', async (request, reply) => {
    const path = request.url.split('?')[0];
    const api = apis.find((item) => item.endpoint === path && item.status === 'publicado' && item.ativa !== false && item.metodoHttp === request.method);
    if (!api) return reply.status(404).send(erro('API_PUBLICADA_NAO_ENCONTRADA', 'API publicada nao encontrada para o endpoint informado.'));
    const autorizacao = validarTokenPublico(request, api);
    if (!autorizacao.valido) return reply.status(autorizacao.status).send(erro(autorizacao.codigo, autorizacao.mensagem));
    const conexao = conexoes.find((item) => item.id === api.conexaoId);
    if (!conexao) return reply.status(400).send(erro('CONEXAO_NAO_ENCONTRADA', 'Conexao da API nao encontrada.'));
    const inicio = Date.now();
    try {
      const entrada = request.method === 'GET' ? (request.query as Record<string, string>) : ((request.body ?? {}) as Record<string, string>);
      const { parametrosSql, erros } = prepararParametrosApi(api, entrada);
      if (erros.length) {
        registrarLog({ empresaId: api.empresaId || api.clienteId, apiId: api.id, clienteConsumidorId: autorizacao.token?.clienteConsumidorId, tokenId: autorizacao.token?.id, metodoHttp: request.method, endpoint: api.endpoint, statusHttp: 400, tempoRespostaMs: Date.now() - inicio, origemIp: request.ip, origemAcesso: 'local', parametrosRecebidos: entrada, erroCodigo: erros[0].codigo, mensagemErro: erros[0].mensagem });
        return reply.status(400).send({ sucesso: false, erro: erros[0] });
      }
      const { pagina, quantidadePorPagina } = normalizarPaginacao(entrada, api);
      const paginacaoAtiva = api.permitePaginacao !== false && api.paginacaoHabilitada !== false && api.regras?.paginacaoPermitida !== false;
      const timeoutConfiguradoMs = Number(api.regras?.timeoutMs || (api.timeoutSegundos ? api.timeoutSegundos * 1000 : 15000));
      const timeoutMs = Math.min(Math.max(timeoutConfiguradoMs || 15000, 5000), 15000);
      const registros = await sqlExecutor.executar(conexao, api.sqlBase, parametrosSql, paginacaoAtiva ? {
        timeoutMs,
        paginacao: { pagina, quantidadePorPagina }
      } : { timeoutMs });
      const lista = Array.isArray(registros) ? registros : [];
      const possuiProximaPagina = paginacaoAtiva && lista.length > quantidadePorPagina;
      const dadosRetorno = paginacaoAtiva ? lista.slice(0, quantidadePorPagina) : lista;
      const paginado = paginacaoAtiva
        ? {
            dados: dadosRetorno,
            meta: {
              pagina,
              quantidadePorPagina,
              totalRegistros: dadosRetorno.length,
              totalPaginas: possuiProximaPagina ? pagina + 1 : pagina,
              temProxima: possuiProximaPagina,
              temAnterior: pagina > 1
            }
          }
        : {
            dados: lista,
            meta: {
              pagina: 1,
              quantidadePorPagina: lista.length,
              totalRegistros: lista.length,
              totalPaginas: 1,
              temProxima: false,
              temAnterior: false
            }
          };
      registrarLog({ empresaId: api.empresaId || api.clienteId, apiId: api.id, clienteConsumidorId: autorizacao.token?.clienteConsumidorId, tokenId: autorizacao.token?.id, metodoHttp: request.method, endpoint: api.endpoint, statusHttp: 200, tempoRespostaMs: Date.now() - inicio, origemIp: request.ip, origemAcesso: 'local', parametrosRecebidos: entrada, totalRegistros: dadosRetorno.length });
      return sucesso(paginado.dados, paginado.meta);
    } catch (error) {
      const mensagemErro = error instanceof Error ? error.message : 'Erro ao executar API publicada.';
      const ocorreuTimeout = /timeout|timed out|etimeout|cancel/i.test(mensagemErro);
      const statusHttp = ocorreuTimeout ? 504 : 500;
      const codigoErro = ocorreuTimeout ? 'TEMPO_LIMITE_CONSULTA' : 'ERRO_EXECUCAO_API_PUBLICA';
      const mensagemPublica = ocorreuTimeout
        ? 'A consulta excedeu o tempo limite permitido. Reduza o período, utilize paginação ou tente novamente.'
        : mensagemErro;
      registrarLog({ empresaId: api.empresaId || api.clienteId, apiId: api.id, metodoHttp: request.method, endpoint: api.endpoint, statusHttp, tempoRespostaMs: Date.now() - inicio, origemIp: request.ip, origemAcesso: 'local', erroCodigo: codigoErro, mensagemErro });
      return reply.status(statusHttp).send(erro(codigoErro, mensagemPublica));
    }
  });

  app.setNotFoundHandler(async (request, reply) => {
    const accept = request.headers.accept ?? '';
    const querHtml = typeof accept === 'string' && accept.includes('text/html');
    if (querHtml && existsSync(join(frontendDist, 'index.html'))) return reply.sendFile('index.html');
    return reply.status(404).send(erro('ROTA_NAO_ENCONTRADA', 'Rota nao encontrada.'));
  });

  return app;
}

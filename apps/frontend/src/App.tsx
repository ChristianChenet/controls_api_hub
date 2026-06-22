import {
  Activity,
  Building2,
  ChevronLeft,
  ChevronRight,
  Database,
  Edit3,
  FileCode2,
  Globe2,
  KeyRound,
  LayoutDashboard,
  Play,
  RefreshCw,
  Save,
  Settings,
  TerminalSquare,
  Trash2,
  UserCog
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';

const API_BASE = window.location.port === '5173' ? 'http://localhost:3335' : '';

type MenuId =
  | 'dashboard'
  | 'clientes'
  | 'conexoes'
  | 'apis'
  | 'editor'
  | 'consumidores'
  | 'tokens'
  | 'usuarios'
  | 'logs'
  | 'dominios'
  | 'configuracoes';

type Cliente = {
  id: string;
  nomeEmpresa: string;
  nomeFantasia: string;
  cnpj: string;
  codigoInterno: string;
  responsavel: string;
  email: string;
  telefone: string;
  ambiente: string;
  status: string;
  observacoes?: string;
  dominioPrincipal: string;
  subdominioApi: string;
  dataCadastro: string;
};
type Conexao = {
  id: string;
  clienteId?: string;
  nome: string;
  tipoBanco: 'oracle' | 'sqlserver' | 'firebird';
  host: string;
  porta: number;
  bancoOuServico: string;
  usuario: string;
  ambiente: string;
  status: string;
  observacoes?: string;
  ultimaValidacao?: string;
};
type RetornoTesteConexao = {
  sucesso: boolean;
  mensagem: string;
  dataHora: string;
  detalhes?: Record<string, unknown>;
};
type ApiCadastrada = {
  id: string;
  nome: string;
  codigoInterno: string;
  descricao: string;
  versao: string;
  categoria: string;
  status: string;
  metodoHttp: string;
  endpoint: string;
  clienteId: string;
  conexaoId: string;
  paginacaoHabilitada: boolean;
  sqlBase: string;
  ultimaPublicacao?: string;
  parametros: Record<string, unknown>[];
  regras: Record<string, unknown>;
  campos: { nomePublico: string; tipo: string; exemplo: string | number | boolean | null }[];
  apiSql?: {
    parametrosTeste?: Record<string, unknown>;
    previewResposta?: unknown;
  };
  previewDocumentacao?: {
    metodoHttp: string;
    rota: string;
    urlLocal: string;
    urlPublica?: string;
    autenticacao: string;
    parametros?: Record<string, unknown>[];
    exemploChamada: string;
    exemploResposta: unknown;
    erros: { codigo: string; mensagem: string }[];
  };
};
type LogChamada = { id: string; horario: string; apiId: string; statusHttp: number; latenciaMs: number; origemIp: string; erroCodigo?: string };
type Usuario = { id: string; nome: string; email: string; perfil: string; status: string; primeiroAcesso: boolean; criadoEm: string; empresasIds?: string[] };
type UsuarioLogado = { id: string; nome: string; email: string; perfil: string };
type Identidade = { nomeLoja: string; logoUrl: string; descricaoCurta?: string };
type EmpresaLogin = { id: string; nomeEmpresa: string; nomeFantasia: string; perfil: string };
type PublicacaoConfig = {
  ambiente: 'local' | 'homologacao' | 'producao';
  dominioPrincipal: string;
  subdominioApi: string;
  urlBaseApi: string;
  urlBaseDocumentacao: string;
};
type TokenAcesso = {
  id: string;
  nome: string;
  clienteId: string;
  parceiro: string;
  tokenMascarado: string;
  status: string;
  expiraEm?: string;
  observacao?: string;
  criadoEm: string;
};
type ClienteConsumidor = {
  id: string;
  empresaId: string;
  nomeCliente: string;
  descricao?: string;
  emailResponsavel?: string;
  telefone?: string;
  tokenMascarado: string;
  status: string;
  dataExpiracaoToken?: string;
  observacoes?: string;
};
type ApiRequestError = Error & { codigo?: string };

const menu: [MenuId, string, typeof LayoutDashboard][] = [
  ['dashboard', 'Dashboard', LayoutDashboard],
  ['clientes', 'Empresas', Building2],
  ['conexoes', 'Conexoes', Database],
  ['apis', 'APIs', FileCode2],
  ['editor', 'Editor SQL', TerminalSquare],
  ['consumidores', 'Consumidores', UserCog],
  ['tokens', 'Tokens', KeyRound],
  ['usuarios', 'Usuarios', UserCog],
  ['logs', 'Logs', Activity],
  ['dominios', 'Dominios', Globe2],
  ['configuracoes', 'Configuracoes', Settings]
];

const subtitulosPagina: Record<MenuId, string> = {
  dashboard: 'Visao geral das APIs, conexoes, tokens e publicacoes.',
  clientes: 'Cadastro das empresas donas das conexoes, APIs, dominios e consumidores.',
  conexoes: 'Conexoes Oracle, SQL Server e Firebird utilizadas pelas APIs.',
  apis: 'Catalogo de endpoints corporativos publicados e em rascunho.',
  editor: 'SQL, parametros, teste da consulta e inferencia de campos publicos.',
  consumidores: 'Clientes que recebem token fixo para consumir as APIs publicadas.',
  tokens: 'Tokens fixos por cliente para consumo seguro das APIs.',
  usuarios: 'Usuarios do portal administrativo e perfis de acesso.',
  logs: 'Monitoramento de chamadas, latencia, status HTTP e erros.',
  dominios: 'URLs publicas, subdominios e enderecos de documentacao.',
  configuracoes: 'Identidade visual da loja integrada no portal.'
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('controlSApiHubToken');
  const temBody = options?.body !== undefined && options.body !== null;
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...(temBody ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {})
    },
    ...options
  });
  const payload = await response.json();
  if (!response.ok || payload.sucesso === false) {
    const error = new Error(payload.erro?.mensagem ?? 'Nao foi possivel concluir a operacao.') as ApiRequestError;
    error.codigo = payload.erro?.codigo;
    throw error;
  }
  return payload.dados ?? payload;
}

const identidadeControlS = { nome: 'Control S', subtitulo: 'API Hub', logoUrl: '/brand/logo-s-novo.jpg' };
const identidadeLojaPadrao: Identidade = { nomeLoja: 'Cliente integrado', descricaoCurta: 'Loja integrada', logoUrl: '/brand/logo-s-novo.jpg' };
const publicacaoPadrao: PublicacaoConfig = {
  ambiente: 'local',
  dominioPrincipal: 'localhost',
  subdominioApi: 'localhost:3335',
  urlBaseApi: window.location.origin,
  urlBaseDocumentacao: `${window.location.origin}/swagger`
};

function Logo({ compacto }: { compacto: boolean }) {
  return (
    <div className="logo">
      <img className="logoMark" src={identidadeControlS.logoUrl} alt={identidadeControlS.nome} />
      {!compacto && (
        <div>
          <strong>{identidadeControlS.nome}</strong>
          <span>{identidadeControlS.subtitulo}</span>
        </div>
      )}
    </div>
  );
}

function MarcaLoja({ identidade }: { identidade: Identidade }) {
  return (
    <div className="storeBrand">
      <img className="storeLogo" src={identidade.logoUrl} alt={identidade.nomeLoja} />
      <div>
        <span>{identidade.descricaoCurta || 'Loja integrada'}</span>
        <strong>{identidade.nomeLoja}</strong>
      </div>
    </div>
  );
}

function arquivoParaDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Nao foi possivel ler o arquivo do logo.'));
    reader.readAsDataURL(file);
  });
}

function normalizarBaseUrl(url = '') {
  return url.replace(/\/+$/, '');
}

function montarUrl(base: string, rota = '') {
  return `${normalizarBaseUrl(base)}${rota.startsWith('/') ? rota : `/${rota}`}`;
}

function isBasePublica(base = '') {
  return /^https?:\/\//i.test(base) && !/localhost|127\.0\.0\.1/i.test(base);
}

function urlsDocumentacaoApi(api: ApiCadastrada | undefined, publicacao: PublicacaoConfig) {
  const origemLocal = window.location.origin;
  const rota = api?.endpoint || '/v1/sua-api';
  const basePublica = isBasePublica(publicacao.urlBaseApi) ? publicacao.urlBaseApi : '';
  const docPublica = isBasePublica(publicacao.urlBaseDocumentacao) ? publicacao.urlBaseDocumentacao : (basePublica ? `${normalizarBaseUrl(basePublica)}/swagger` : '');
  return {
    endpointLocal: montarUrl(origemLocal, rota),
    swaggerLocal: montarUrl(origemLocal, '/swagger'),
    openApiLocal: montarUrl(origemLocal, '/documentacao/openapi.json'),
    openApiApiLocal: api ? montarUrl(origemLocal, `/api/admin/apis/${api.id}/openapi.json`) : '',
    endpointPublico: basePublica ? montarUrl(basePublica, rota) : '',
    swaggerPublico: docPublica,
    openApiPublico: basePublica ? montarUrl(basePublica, '/documentacao/openapi.json') : ''
  };
}

function parametrosTestePadraoFrontend(api?: ApiCadastrada) {
  const parametros = api?.parametros ?? [];
  if (!parametros.length) return { pagina: 1, pageSize: 500 };
  return Object.fromEntries(
    parametros
      .map((parametro) => [
        String(parametro.nomePublico ?? parametro.nomeParametro ?? 'parametro'),
        parametro.exemplo ?? parametro.valorPadrao ?? null
      ])
      .concat([
        ['pagina', 1],
        ['pageSize', 500]
      ])
  );
}

function aplicarApiNoEditor(api?: ApiCadastrada) {
  return {
    id: api?.id ?? '',
    sql: api?.sqlBase || sqlModelo,
    parametrosTeste: JSON.stringify(api?.apiSql?.parametrosTeste ?? parametrosTestePadraoFrontend(api), null, 2),
    parametrosApi: JSON.stringify(api?.parametros ?? [], null, 2),
    regras: JSON.stringify(api?.regras ?? {}, null, 2)
  };
}

function MetricCard({ titulo, valor, detalhe }: { titulo: string; valor: string | number; detalhe: string }) {
  return (
    <article className="metricCard">
      <span>{titulo}</span>
      <strong>{valor}</strong>
      <small>{detalhe}</small>
    </article>
  );
}

function Badge({ value }: { value: string | number }) {
  const texto = String(value);
  const ok = ['ativo', 'ativa', 'publicado', '200', 'Ativo', 'Ativa', 'Publicado'].includes(texto);
  const warn = ['400', '401', 'inativa', 'Inativa', 'rascunho'].includes(texto);
  return <span className={ok ? 'badge ok' : warn ? 'badge warn' : ''}>{texto}</span>;
}

function StatusBar({ mensagem, erro, onClose }: { mensagem: string; erro: string; onClose: () => void }) {
  if (!mensagem && !erro) return null;
  return (
    <div className={erro ? 'statusBar error' : 'statusBar'}>
      <span>{erro || mensagem}</span>
      <button type="button" className="statusClose" onClick={onClose} aria-label="Fechar mensagem">×</button>
    </div>
  );
}

const sqlModelo = `SELECT
  TIT.FORNECEDOR AS codigoParceiro,
  FORN.NOME AS nomeParceiro,
  COALESCE(fis.CPF, jur.CNPJ) AS documentoParceiro,
  PVC.PEDIDO AS pedido,
  PVC.DATA_EMISSAO AS dataPedido,
  PVC.VALOR_TOTAL AS valorPedido
FROM vdpvendacomissao COM
LEFT JOIN VDPVENDAC PVC ON COM.PedidoSequencial = PVC.PedidoSequencial
LEFT JOIN CPTITULO TIT ON PVC.PEDIDO = TIT.TITULO
LEFT JOIN CGPESSOA FORN ON TIT.FORNECEDOR = FORN.PESSOA
LEFT JOIN CGFISICA fis ON COM.Vendedor = fis.PESSOA
LEFT JOIN CGJURIDICA jur ON COM.Vendedor = jur.PESSOA
WHERE (:documentoParceiro IS NULL OR documentoParceiro = :documentoParceiro)
  AND (:dataInicial IS NULL OR PVC.DATA_EMISSAO >= :dataInicial)
  AND (:dataFinal IS NULL OR PVC.DATA_EMISSAO < :dataFinalMaisUmDia)`;

export function App() {
  const [autenticado, setAutenticado] = useState(Boolean(localStorage.getItem('controlSApiHubToken')));
  const [usuarioLogado, setUsuarioLogado] = useState<UsuarioLogado | null>(() => {
    const bruto = localStorage.getItem('controlSApiHubUser');
    return bruto ? JSON.parse(bruto) as UsuarioLogado : null;
  });
  const [compacto, setCompacto] = useState(false);
  const [pagina, setPagina] = useState<MenuId>('dashboard');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [conexoes, setConexoes] = useState<Conexao[]>([]);
  const [apis, setApis] = useState<ApiCadastrada[]>([]);
  const [logs, setLogs] = useState<LogChamada[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [tokens, setTokens] = useState<TokenAcesso[]>([]);
  const [clientesConsumidores, setClientesConsumidores] = useState<ClienteConsumidor[]>([]);
  const [identidadeLoja, setIdentidadeLoja] = useState<Identidade>(() => {
    const bruto = localStorage.getItem('controlSApiHubBrand');
    return bruto ? JSON.parse(bruto) as Identidade : identidadeLojaPadrao;
  });
  const [identidadeForm, setIdentidadeForm] = useState<Identidade>(() => {
    const bruto = localStorage.getItem('controlSApiHubBrand');
    return bruto ? JSON.parse(bruto) as Identidade : identidadeLojaPadrao;
  });
  const [publicacao, setPublicacao] = useState<PublicacaoConfig>(publicacaoPadrao);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [emailPrimeiroAcesso, setEmailPrimeiroAcesso] = useState('');
  const [apiSelecionadaId, setApiSelecionadaId] = useState('');
  const [sqlAtual, setSqlAtual] = useState(sqlModelo);
  const [parametrosTeste, setParametrosTeste] = useState('{\n  "documentoParceiro": "12345678000190"\n}');
  const [resultadoTeste, setResultadoTeste] = useState('');
  const [testandoConexaoId, setTestandoConexaoId] = useState('');
  const [parametrosApiJson, setParametrosApiJson] = useState('[]');
  const [regrasApiJson, setRegrasApiJson] = useState('{}');
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [conexaoEditando, setConexaoEditando] = useState<Conexao | null>(null);
  const [apiEditando, setApiEditando] = useState<ApiCadastrada | null>(null);
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null);
  const [tokenEditando, setTokenEditando] = useState<TokenAcesso | null>(null);
  const [consumidorEditando, setConsumidorEditando] = useState<ClienteConsumidor | null>(null);
  const [empresasParaLogin, setEmpresasParaLogin] = useState<EmpresaLogin[]>([]);
  const [loginPendente, setLoginPendente] = useState<{ email: string; senha: string } | null>(null);
  const titulo = useMemo(() => menu.find(([id]) => id === pagina)?.[1] ?? 'Dashboard', [pagina]);
  const apiSelecionada = apis.find((api) => api.id === apiSelecionadaId) ?? apis[0];
  const urlsApiSelecionada = urlsDocumentacaoApi(apiSelecionada, publicacao);
  const isAdmin = usuarioLogado?.perfil === 'admin';
  const menuVisivel = menu.filter(([id]) => id !== 'usuarios' || isAdmin);

  async function carregarDados(apiIdParaPreservar = apiSelecionadaId) {
    if (!autenticado) return;
    const usuarioSeguro = isAdmin
      ? request<Usuario[]>('/api/admin/usuarios').catch(() => [])
      : Promise.resolve([]);
    const [clientesDados, usuariosDados, identidadeDados, publicacaoDados] = await Promise.all([
      request<Cliente[]>('/api/admin/clientes'),
      usuarioSeguro,
      request<Identidade>('/api/admin/identidade'),
      request<PublicacaoConfig>('/api/admin/publicacao')
    ]);
    setClientes(clientesDados);
    setUsuarios(usuariosDados);
    setIdentidadeLoja(identidadeDados);
    setIdentidadeForm(identidadeDados);
    setPublicacao(publicacaoDados);
    localStorage.setItem('controlSApiHubBrand', JSON.stringify(identidadeDados));
    if (!clientesDados.length) {
      setConexoes([]);
      setApis([]);
      setLogs([]);
      setClientesConsumidores([]);
      setTokens([]);
      setPagina('clientes');
      return;
    }
    const [conexoesDados, apisDados, logsDados, consumidoresDados, tokensDados] = await Promise.all([
      request<Conexao[]>('/api/admin/conexoes'),
      request<ApiCadastrada[]>('/api/admin/apis'),
      request<LogChamada[]>('/api/admin/logs'),
      request<ClienteConsumidor[]>('/api/admin/clientes-consumidores'),
      request<TokenAcesso[]>('/api/admin/tokens')
    ]);
    setConexoes(conexoesDados);
    setApis(apisDados);
    setLogs(logsDados);
    setClientesConsumidores(consumidoresDados);
    setTokens(tokensDados);
    const apiPreservada = apisDados.find((api) => api.id === apiIdParaPreservar) ?? apisDados[0];
    const editor = aplicarApiNoEditor(apiPreservada);
    setApiSelecionadaId(editor.id);
    setSqlAtual(editor.sql);
    setParametrosTeste(editor.parametrosTeste);
    setParametrosApiJson(editor.parametrosApi);
    setRegrasApiJson(editor.regras);
    if (!apiPreservada) {
      setSqlAtual(sqlModelo);
      setParametrosTeste(JSON.stringify(parametrosTestePadraoFrontend(), null, 2));
      setParametrosApiJson('[]');
      setRegrasApiJson('{}');
    }
  }

  useEffect(() => {
    carregarDados().catch((error) => falhar(error));
  }, [autenticado]);

  function avisar(texto: string) {
    setMensagem(texto);
    setErro('');
  }

  function falhar(error: unknown) {
    const apiError = error as ApiRequestError;
    if (apiError.codigo === 'SESSAO_INVALIDA' || apiError.codigo === 'EMPRESA_NAO_SELECIONADA') {
      localStorage.removeItem('controlSApiHubToken');
      localStorage.removeItem('controlSApiHubUser');
      setUsuarioLogado(null);
      setAutenticado(false);
      setErro('Sua sessao expirou. Entre novamente para continuar.');
      setMensagem('');
      return;
    }
    setErro(error instanceof Error ? error.message : 'Erro inesperado.');
    setMensagem('');
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const dados = await request<{ token?: string; usuario?: UsuarioLogado; exigeSelecaoEmpresa?: boolean; exigeCadastroEmpresa?: boolean; empresas?: EmpresaLogin[] }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: form.get('email'), senha: form.get('senha') })
      });
      if (dados.exigeSelecaoEmpresa) {
        setEmpresasParaLogin(dados.empresas ?? []);
        setLoginPendente({ email: String(form.get('email') ?? ''), senha: String(form.get('senha') ?? '') });
        avisar('Selecione a empresa para entrar no portal.');
        return;
      }
      if (!dados.token || !dados.usuario) throw new Error('Nao foi possivel iniciar a sessao.');
      localStorage.setItem('controlSApiHubToken', dados.token);
      localStorage.setItem('controlSApiHubUser', JSON.stringify(dados.usuario));
      setUsuarioLogado(dados.usuario);
      setAutenticado(true);
      setEmpresasParaLogin([]);
      setLoginPendente(null);
      setMensagem('');
      setErro('');
    } catch (error) {
      const apiError = error as ApiRequestError;
      // CONTROL S - ALTERAÇÃO MON: corrige obrigatoriedade de senha no primeiro acesso.
      if (apiError.codigo === 'PRIMEIRO_ACESSO_NECESSARIO') {
        setEmailPrimeiroAcesso(String(form.get('email') ?? ''));
        setErro('');
        setMensagem('Defina sua senha de primeiro acesso para entrar.');
        return;
      }
      falhar(error);
    }
  }

  async function selecionarEmpresaLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!loginPendente) return;
    const form = new FormData(event.currentTarget);
    try {
      const dados = await request<{ token: string; usuario: UsuarioLogado }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ ...loginPendente, empresaId: form.get('empresaId') })
      });
      localStorage.setItem('controlSApiHubToken', dados.token);
      localStorage.setItem('controlSApiHubUser', JSON.stringify(dados.usuario));
      setUsuarioLogado(dados.usuario);
      setAutenticado(true);
      setEmpresasParaLogin([]);
      setLoginPendente(null);
      setMensagem('');
      setErro('');
    } catch (error) {
      falhar(error);
    }
  }

  async function definirSenhaPrimeiroAcesso(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      // CONTROL S - ALTERAÇÃO MON: corrige obrigatoriedade de senha no primeiro acesso.
      await request('/api/auth/primeiro-acesso', {
        method: 'POST',
        body: JSON.stringify({ email: emailPrimeiroAcesso || form.get('email'), novaSenha: form.get('novaSenha') })
      });
      setEmailPrimeiroAcesso('');
      avisar('Senha definida. Entre com a nova senha.');
    } catch (error) {
      falhar(error);
    }
  }

  async function salvarCliente(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      nomeEmpresa: form.get('nomeEmpresa'),
      nomeFantasia: form.get('nomeFantasia'),
      cnpj: '',
      codigoInterno: '',
      responsavel: '',
      email: '',
      telefone: '',
      ambiente: 'homologacao',
      status: form.get('status'),
      dominioPrincipal: form.get('dominioPrincipal'),
      subdominioApi: form.get('subdominioApi'),
      observacoes: form.get('observacoes')
    };
    try {
      await request(clienteEditando ? `/api/admin/clientes/${clienteEditando.id}` : '/api/admin/clientes', {
        method: clienteEditando ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      });
      formElement.reset();
      setClienteEditando(null);
      await carregarDados();
      avisar(clienteEditando ? 'Empresa atualizada com sucesso.' : 'Empresa cadastrada com sucesso.');
    } catch (error) {
      falhar(error);
    }
  }

  async function excluirCliente(id: string) {
    if (!window.confirm('Deseja realmente excluir este cliente?')) return;
    try {
      await request(`/api/admin/clientes/${id}`, { method: 'DELETE' });
      if (clienteEditando?.id === id) setClienteEditando(null);
      await carregarDados();
      avisar('Empresa excluida.');
    } catch (error) {
      falhar(error);
    }
  }

  async function criarConexao(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const payload = {
        nome: form.get('nome'),
        clienteId: form.get('clienteId'),
        tipoBanco: form.get('tipoBanco'),
        host: form.get('host'),
        porta: Number(form.get('porta')),
        bancoOuServico: form.get('bancoOuServico'),
        usuario: form.get('usuario'),
        senha: form.get('senha'),
        ambiente: form.get('ambiente'),
        status: form.get('status') || 'ativa',
        observacoes: form.get('observacoes')
      };
      await request(conexaoEditando ? `/api/admin/conexoes/${conexaoEditando.id}` : '/api/admin/conexoes', {
        method: conexaoEditando ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      });
      formElement.reset();
      setConexaoEditando(null);
      await carregarDados();
      avisar(conexaoEditando ? 'Conexao atualizada com sucesso.' : 'Conexao criada e ativada para uso no cadastro de APIs.');
    } catch (error) {
      falhar(error);
    }
  }

  async function testarConexao(id: string) {
    setTestandoConexaoId(id);
    setResultadoTeste('');
    try {
      const retorno = await request<RetornoTesteConexao>(`/api/admin/conexoes/${id}/testar`, { method: 'POST' });
      setResultadoTeste(JSON.stringify(retorno, null, 2));
      await carregarDados();
      if (!retorno.sucesso) {
        falhar(new Error(String(retorno.mensagem || 'Nao foi possivel conectar ao banco informado.')));
        return;
      }
      avisar('Conexao validada com sucesso no banco de dados.');
    } catch (error) {
      falhar(error);
    } finally {
      setTestandoConexaoId('');
    }
  }

  async function excluirConexao(id: string) {
    if (!window.confirm('Deseja realmente excluir esta conexao?')) return;
    try {
      await request(`/api/admin/conexoes/${id}`, { method: 'DELETE' });
      if (conexaoEditando?.id === id) setConexaoEditando(null);
      await carregarDados();
      avisar('Conexao excluida.');
    } catch (error) {
      falhar(error);
    }
  }

  async function criarApi(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const payload = {
        nome: form.get('nome'),
        codigoInterno: form.get('codigoInterno'),
        clienteId: form.get('clienteId'),
        descricao: form.get('descricao'),
        versao: form.get('versao'),
        categoria: form.get('categoria'),
        metodoHttp: form.get('metodoHttp'),
        endpoint: form.get('endpoint'),
        conexaoId: form.get('conexaoId'),
        paginacaoHabilitada: form.get('paginacaoHabilitada') === 'on'
      };
      const api = await request<ApiCadastrada>(apiEditando ? `/api/admin/apis/${apiEditando.id}` : '/api/admin/apis', {
        method: apiEditando ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...payload,
          paginacaoHabilitada: payload.paginacaoHabilitada || !apiEditando
        })
      });
      if (!apiEditando) {
        formElement.reset();
        setApiSelecionadaId(api.id);
        setSqlAtual(sqlModelo);
        setPagina('editor');
      }
      setApiEditando(null);
      await carregarDados(api.id);
      avisar(apiEditando ? 'API atualizada com sucesso.' : 'API criada em rascunho. Agora salve o SQL e publique.');
    } catch (error) {
      falhar(error);
    }
  }

  async function excluirApi(id: string) {
    if (!window.confirm('Deseja realmente excluir esta API? O endpoint deixara de existir.')) return;
    try {
      await request(`/api/admin/apis/${id}`, { method: 'DELETE' });
      if (apiEditando?.id === id) setApiEditando(null);
      if (apiSelecionadaId === id) setApiSelecionadaId('');
      await carregarDados(apiSelecionadaId === id ? '' : apiSelecionadaId);
      avisar('API excluida.');
    } catch (error) {
      falhar(error);
    }
  }

  async function salvarSql() {
    if (!apiSelecionada) return;
    const apiIdAtual = apiSelecionada.id;
    try {
      let parametrosTesteJson: Record<string, unknown> = {};
      try {
        parametrosTesteJson = JSON.parse(parametrosTeste || '{}');
      } catch {
        throw new Error('Os parametros de teste devem estar em JSON valido.');
      }
      const retorno = await request<{ api: ApiCadastrada; camposInferidos: ApiCadastrada['campos'] }>(`/api/admin/apis/${apiSelecionada.id}/sql`, {
        method: 'PUT',
        body: JSON.stringify({ sqlBase: sqlAtual, parametrosTeste: parametrosTesteJson })
      });
      await carregarDados(apiIdAtual);
      setApiSelecionadaId(apiIdAtual);
      setSqlAtual(retorno.api.sqlBase || sqlAtual);
      setParametrosTeste(JSON.stringify(retorno.api.apiSql?.parametrosTeste ?? parametrosTesteJson, null, 2));
      setResultadoTeste(JSON.stringify({ camposInferidos: retorno.camposInferidos }, null, 2));
      avisar('SQL salvo e campos publicos inferidos pelos aliases.');
    } catch (error) {
      falhar(error);
    }
  }

  async function salvarParametrosApi() {
    if (!apiSelecionada) return;
    try {
      let parametros;
      let regras;
      try {
        parametros = JSON.parse(parametrosApiJson || '[]');
        regras = JSON.parse(regrasApiJson || '{}');
      } catch {
        throw new Error('Parametros e regras devem estar em JSON valido.');
      }
      let parametrosTesteJson: Record<string, unknown> = {};
      try {
        parametrosTesteJson = JSON.parse(parametrosTeste || '{}');
      } catch {
        throw new Error('Os parametros de teste devem estar em JSON valido.');
      }
      if (!Array.isArray(parametros)) {
        throw new Error('A configuracao de parametros deve ser uma lista JSON.');
      }
      await request(`/api/admin/apis/${apiSelecionada.id}/parametros`, {
        method: 'PUT',
        body: JSON.stringify({ parametros, regras, parametrosTeste: parametrosTesteJson })
      });
      await carregarDados(apiSelecionada.id);
      avisar('Parametros e regras da API salvos com sucesso.');
    } catch (error) {
      falhar(error);
    }
  }

  async function testarSql() {
    if (!apiSelecionada) return;
    try {
      let parametros: Record<string, string> = {};
      try {
        parametros = JSON.parse(parametrosTeste || '{}');
      } catch {
        throw new Error('Os parametros de teste devem estar em JSON valido.');
      }
      const retorno = await request(`/api/admin/apis/${apiSelecionada.id}/testar-sql`, {
        method: 'POST',
        body: JSON.stringify({ parametros })
      });
      setResultadoTeste(JSON.stringify(retorno, null, 2));
      await carregarDados(apiSelecionada.id);
      avisar('Consulta executada no banco da conexao selecionada.');
    } catch (error) {
      falhar(error);
    }
  }

  async function criarUsuario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) {
      falhar(new Error('Somente administradores podem cadastrar usuarios.'));
      return;
    }
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await request(usuarioEditando ? `/api/admin/usuarios/${usuarioEditando.id}` : '/api/admin/usuarios', {
        method: usuarioEditando ? 'PUT' : 'POST',
        body: JSON.stringify({
          nome: form.get('nome'),
          email: form.get('email'),
          perfil: form.get('perfil'),
          status: form.get('status') || 'ativo',
          empresasIds: form.getAll('empresasIds')
        })
      });
      formElement.reset();
      setUsuarioEditando(null);
      await carregarDados();
      avisar(usuarioEditando ? 'Usuario atualizado com sucesso.' : 'Usuario criado. No primeiro acesso ele devera definir a propria senha.');
    } catch (error) {
      falhar(error);
    }
  }

  async function excluirUsuario(id: string) {
    if (!isAdmin) return;
    if (!window.confirm('Deseja realmente excluir este usuario?')) return;
    try {
      await request(`/api/admin/usuarios/${id}`, { method: 'DELETE' });
      if (usuarioEditando?.id === id) setUsuarioEditando(null);
      await carregarDados();
      avisar('Usuario excluido.');
    } catch (error) {
      falhar(error);
    }
  }

  async function publicarApi(id?: string) {
    const apiId = id ?? apiSelecionada?.id;
    if (!apiId) return;
    try {
      await request(`/api/admin/apis/${apiId}/publicar`, { method: 'POST' });
      await carregarDados();
      avisar('API publicada. O endpoint ja pode ser consumido no padrao /v1.');
    } catch (error) {
      falhar(error);
    }
  }

  async function despublicarApi(id: string) {
    try {
      await request(`/api/admin/apis/${id}/despublicar`, { method: 'POST' });
      await carregarDados();
      avisar('API despublicada. O endpoint publico foi retirado do catalogo ativo.');
    } catch (error) {
      falhar(error);
    }
  }

  async function salvarIdentidade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const arquivoLogo = form.get('logoArquivo');
      const logoUrl = arquivoLogo instanceof File && arquivoLogo.size > 0
        ? await arquivoParaDataUrl(arquivoLogo)
        : identidadeLoja.logoUrl;
      const novaIdentidade = await request<Identidade>('/api/admin/identidade', {
        method: 'PUT',
        body: JSON.stringify({
          nomeLoja: identidadeForm.nomeLoja,
          descricaoCurta: identidadeForm.descricaoCurta ?? '',
          logoUrl
        })
      });
      setIdentidadeLoja(novaIdentidade);
      setIdentidadeForm(novaIdentidade);
      localStorage.setItem('controlSApiHubBrand', JSON.stringify(novaIdentidade));
      avisar('Identidade do cliente aplicada no topo e no login.');
    } catch (error) {
      falhar(error);
    }
  }

  async function salvarPublicacao(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const novaPublicacao = await request<PublicacaoConfig>('/api/admin/publicacao', {
        method: 'PUT',
        body: JSON.stringify({
          ambiente: form.get('ambiente'),
          dominioPrincipal: form.get('dominioPrincipal'),
          subdominioApi: form.get('subdominioApi'),
          urlBaseLocal: form.get('urlBaseLocal'),
          urlBaseApi: form.get('urlBaseApi'),
          urlBaseDocumentacao: form.get('urlBaseDocumentacao')
        })
      });
      setPublicacao(novaPublicacao);
      avisar('Configuracao de URL publica salva. A documentacao OpenAPI ja usa essa URL.');
    } catch (error) {
      falhar(error);
    }
  }

  async function salvarToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const retorno = await request<TokenAcesso & { tokenGerado?: string }>(tokenEditando ? `/api/admin/tokens/${tokenEditando.id}` : '/api/admin/tokens', {
        method: tokenEditando ? 'PUT' : 'POST',
        body: JSON.stringify({
          nome: form.get('nome'),
          clienteId: form.get('clienteId'),
          parceiro: form.get('parceiro'),
          status: form.get('status'),
          expiraEm: form.get('expiraEm'),
          observacao: form.get('observacao')
        })
      });
      formElement.reset();
      setTokenEditando(null);
      await carregarDados();
      avisar(retorno.tokenGerado ? `Token criado. Copie agora: ${retorno.tokenGerado}` : 'Token atualizado com sucesso.');
    } catch (error) {
      falhar(error);
    }
  }

  async function salvarClienteConsumidor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const retorno = await request<ClienteConsumidor & { tokenGerado?: string }>(
        consumidorEditando ? `/api/admin/clientes-consumidores/${consumidorEditando.id}` : '/api/admin/clientes-consumidores',
        {
          method: consumidorEditando ? 'PUT' : 'POST',
          body: JSON.stringify({
            nomeCliente: form.get('nomeCliente'),
            descricao: form.get('descricao'),
            emailResponsavel: form.get('emailResponsavel'),
            telefone: form.get('telefone'),
            status: form.get('status'),
            dataExpiracaoToken: form.get('dataExpiracaoToken'),
            observacoes: form.get('observacoes')
          })
        }
      );
      formElement.reset();
      setConsumidorEditando(null);
      await carregarDados();
      avisar(retorno.tokenGerado ? `Cliente consumidor criado. Copie o token agora: ${retorno.tokenGerado}` : 'Cliente consumidor atualizado com sucesso.');
    } catch (error) {
      falhar(error);
    }
  }

  async function regenerarTokenConsumidor(id: string) {
    if (!window.confirm('Deseja regenerar o token deste cliente consumidor? O token anterior deixara de funcionar.')) return;
    try {
      const retorno = await request<ClienteConsumidor & { tokenGerado: string }>(`/api/admin/clientes-consumidores/${id}/regenerar-token`, { method: 'POST' });
      await carregarDados();
      avisar(`Token regenerado. Copie agora: ${retorno.tokenGerado}`);
    } catch (error) {
      falhar(error);
    }
  }

  async function excluirClienteConsumidor(id: string) {
    if (!window.confirm('Deseja realmente excluir este cliente consumidor?')) return;
    try {
      await request(`/api/admin/clientes-consumidores/${id}`, { method: 'DELETE' });
      if (consumidorEditando?.id === id) setConsumidorEditando(null);
      await carregarDados();
      avisar('Cliente consumidor excluido.');
    } catch (error) {
      falhar(error);
    }
  }

  async function excluirToken(id: string) {
    if (!window.confirm('Deseja realmente excluir este token?')) return;
    try {
      await request(`/api/admin/tokens/${id}`, { method: 'DELETE' });
      if (tokenEditando?.id === id) setTokenEditando(null);
      await carregarDados();
      avisar('Token excluido.');
    } catch (error) {
      falhar(error);
    }
  }

  async function excluirLog(id: string) {
    if (!window.confirm('Deseja realmente excluir este log?')) return;
    try {
      await request(`/api/admin/logs/${id}`, { method: 'DELETE' });
      await carregarDados();
      avisar('Log excluido.');
    } catch (error) {
      falhar(error);
    }
  }

  if (!autenticado) {
    return (
      <div className="loginScreen">
        <form className="loginPanel" onSubmit={empresasParaLogin.length ? selecionarEmpresaLogin : emailPrimeiroAcesso ? definirSenhaPrimeiroAcesso : login}>
          <Logo compacto={false} />
          <MarcaLoja identidade={identidadeLoja} />
          <h1>Portal administrativo</h1>
          <p>{empresasParaLogin.length ? 'Selecione a empresa para carregar somente os dados permitidos.' : emailPrimeiroAcesso ? 'Primeiro acesso: defina sua senha para utilizar o portal.' : 'Entre para criar conexoes, subir SQL, configurar APIs e publicar endpoints corporativos.'}</p>
          <StatusBar mensagem={mensagem} erro={erro} onClose={() => { setMensagem(''); setErro(''); }} />
          {empresasParaLogin.length ? (
            <>
              <label>Empresa
                <select name="empresaId" required>
                  <option value="">Selecione a empresa</option>
                  {empresasParaLogin.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nomeFantasia || empresa.nomeEmpresa}</option>)}
                </select>
              </label>
              <button className="primary" type="submit">Entrar nesta empresa</button>
              <button type="button" onClick={() => { setEmpresasParaLogin([]); setLoginPendente(null); setMensagem(''); }}>Voltar ao login</button>
            </>
          ) : (
            <>
          <label>E-mail<input name="email" defaultValue={emailPrimeiroAcesso || ''} placeholder="usuario@empresa.com.br" autoComplete="username" disabled={Boolean(emailPrimeiroAcesso)} /></label>
          {emailPrimeiroAcesso ? (
            <>
              <label>Nova senha<input name="novaSenha" type="password" minLength={6} required /></label>
              <button className="primary" type="submit">Definir senha</button>
              <button type="button" onClick={() => setEmailPrimeiroAcesso('')}>Voltar ao login</button>
            </>
          ) : (
            <>
              <label>Senha<input name="senha" type="password" placeholder="Digite sua senha" autoComplete="current-password" /></label>
              <button className="primary" type="submit">Entrar no API Hub</button>
            </>
          )}
            </>
          )}
          <small>CONTROL S CONSULTORIA - Direitos Reservados | CNPJ: 21.421.411/0001-20</small>
        </form>
      </div>
    );
  }

  const conteudo: Record<MenuId, JSX.Element> = {
    dashboard: (
      <>
        <section className="metrics">
          <div className="dashboardFilters">
            <label>Empresa<select><option>Todas as empresas</option>{clientes.map((cliente) => <option key={cliente.id}>{cliente.nomeFantasia}</option>)}</select></label>
            <label>Data inicial<input type="date" /></label>
            <label>Data final<input type="date" /></label>
            <button>Limpar</button>
            <button className="primary" onClick={() => carregarDados()}><RefreshCw size={14} /> Atualizar</button>
          </div>
          <MetricCard titulo="APIs cadastradas" valor={apis.length} detalhe="catalogo corporativo" />
          <MetricCard titulo="APIs publicadas" valor={apis.filter((api) => api.status === 'publicado').length} detalhe="disponiveis para consumo" />
          <MetricCard titulo="Rascunhos" valor={apis.filter((api) => api.status === 'rascunho').length} detalhe="aguardando SQL/publicacao" />
          <MetricCard titulo="Conexoes ativas" valor={conexoes.filter((conexao) => conexao.status === 'ativa').length} detalhe="Oracle, SQL Server, Firebird" />
          <MetricCard titulo="Empresas ativas" valor={clientes.filter((cliente) => cliente.status === 'ativo').length} detalhe="multiempresa habilitado" />
          <MetricCard titulo="Tokens ativos" valor={tokens.filter((token) => token.status === 'ativo').length} detalhe="acesso por cliente" />
          <MetricCard titulo="Chamadas registradas" valor={logs.length} detalhe="historico operacional" />
          <MetricCard titulo="Erros recentes" valor={logs.filter((log) => log.statusHttp >= 400).length} detalhe="status HTTP acima de 400" />
        </section>
        <section className="gridTwo">
          <div className="panel">
            <div className="panelHeader"><h2>Fluxo rapido</h2><button onClick={() => setPagina('conexoes')}>Criar conexao</button></div>
            <div className="workflow">
              <span>1. Login</span><span>2. Conexao</span><span>3. API</span><span>4. SQL</span><span>5. Publicar</span>
            </div>
          </div>
          <div className="panel">
            <div className="panelHeader"><h2>APIs recentes</h2><button onClick={() => carregarDados()}><RefreshCw size={14} /> Atualizar</button></div>
            <table><tbody>{apis.slice(0, 5).map((api) => <tr key={api.id}><td>{api.nome}</td><td>{api.endpoint}</td><td><Badge value={api.status} /></td></tr>)}</tbody></table>
          </div>
        </section>
      </>
    ),
    clientes: (
      <section className="gridTwo">
        <form className="panel formStack" onSubmit={salvarCliente} key={clienteEditando?.id ?? 'nova-empresa'}>
          <div className="panelHeader">
            <h2>{clienteEditando ? 'Editar empresa' : 'Nova empresa'}</h2>
            <div className="actions">
              {clienteEditando && <button type="button" onClick={() => setClienteEditando(null)}>Cancelar</button>}
              <button className="primary" type="submit">{clienteEditando ? 'Salvar empresa' : 'Cadastrar empresa'}</button>
            </div>
          </div>
          <div className="formGrid">
            <label>Empresa<input name="nomeEmpresa" required defaultValue={clienteEditando?.nomeEmpresa} placeholder="Nome da empresa" /></label>
            <label>Nome fantasia<input name="nomeFantasia" required defaultValue={clienteEditando?.nomeFantasia} placeholder="Nome comercial" /></label>
            <label>Status<select name="status" defaultValue={clienteEditando?.status ?? 'ativo'}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></label>
            <label>Dominio principal<input name="dominioPrincipal" defaultValue={clienteEditando?.dominioPrincipal} placeholder="cliente.com.br" /></label>
            <label>Subdominio API<input name="subdominioApi" defaultValue={clienteEditando?.subdominioApi} placeholder="api.cliente.com.br" /></label>
            <label>Observacoes<textarea name="observacoes" defaultValue={clienteEditando?.observacoes} /></label>
          </div>
        </form>
        <div className="panel">
          <div className="panelHeader"><h2>Empresas cadastradas</h2></div>
          <div className="tableWrap">
            <table>
              <thead><tr><th>Empresa</th><th>Dominio</th><th>Subdominio</th><th>Status</th><th>Acoes</th></tr></thead>
              <tbody>{clientes.map((cliente) => (
                <tr key={cliente.id}>
                  <td>{cliente.nomeFantasia}</td>
                  <td>{cliente.dominioPrincipal || '-'}</td>
                  <td>{cliente.subdominioApi}</td>
                  <td><Badge value={cliente.status} /></td>
                  <td className="actionCell">
                    <button onClick={() => setClienteEditando(cliente)}><Edit3 size={14} /> Editar</button>
                    <button className="danger" onClick={() => excluirCliente(cliente.id)}><Trash2 size={14} /> Excluir</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      </section>
    ),
    conexoes: (
      <section className="gridTwo">
        <form className="panel formStack" onSubmit={criarConexao} key={conexaoEditando?.id ?? 'nova-conexao'}>
          <div className="panelHeader">
            <h2>{conexaoEditando ? 'Editar conexao' : 'Nova conexao'}</h2>
            <div className="actions">
              {conexaoEditando && <button type="button" onClick={() => setConexaoEditando(null)}>Cancelar</button>}
              <button className="primary" type="submit">{conexaoEditando ? 'Salvar alteracoes' : 'Salvar conexao'}</button>
            </div>
          </div>
          <div className="formGrid">
            <label>Nome<input name="nome" required defaultValue={conexaoEditando?.nome} placeholder="ERP Producao" /></label>
            <label>Empresa<select name="clienteId" required defaultValue={conexaoEditando?.clienteId ?? clientes[0]?.id}>{clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nomeFantasia}</option>)}</select></label>
            <label>Tipo<select name="tipoBanco" required defaultValue={conexaoEditando?.tipoBanco ?? 'sqlserver'}><option value="sqlserver">SQL Server</option><option value="oracle">Oracle</option><option value="firebird">Firebird</option></select></label>
            <label>Ambiente<select name="ambiente" defaultValue={conexaoEditando?.ambiente ?? 'homologacao'}><option value="homologacao">Homologacao</option><option value="local">Local</option><option value="producao">Producao</option></select></label>
            <label>Status<select name="status" defaultValue={conexaoEditando?.status ?? 'ativa'}><option value="ativa">Ativa</option><option value="inativa">Inativa</option></select></label>
            <label>Host<input name="host" required defaultValue={conexaoEditando?.host} placeholder="localhost" /></label>
            <label>Porta<input name="porta" required type="number" defaultValue={conexaoEditando?.porta ?? 1433} /></label>
            <label>Banco / service / arquivo<input name="bancoOuServico" required defaultValue={conexaoEditando?.bancoOuServico} placeholder="ERP_DEMO ou C:\\Dados\\BASE.FDB" /></label>
            <label>Usuario<input name="usuario" required defaultValue={conexaoEditando?.usuario} placeholder="usuario_api" /></label>
            <label>Senha<input name="senha" type="password" placeholder={conexaoEditando ? 'Preencha apenas para trocar' : 'senha'} /></label>
            <label>Observacoes<textarea name="observacoes" defaultValue={conexaoEditando?.observacoes} placeholder="Detalhes operacionais da conexao" /></label>
          </div>
        </form>
        <div className="panel">
          <div className="panelHeader"><h2>Conexoes cadastradas</h2></div>
          <div className="tableWrap">
            <table>
              <thead><tr><th>Nome</th><th>Tipo</th><th>Host</th><th>Status</th><th>Ultima validacao</th><th>Acoes</th></tr></thead>
              <tbody>{conexoes.map((conexao) => (
                <tr key={conexao.id}>
                  <td>{conexao.nome}</td>
                  <td>{conexao.tipoBanco}</td>
                  <td>{conexao.host}:{conexao.porta}</td>
                  <td><Badge value={conexao.status} /></td>
                  <td>{conexao.ultimaValidacao ? new Date(conexao.ultimaValidacao).toLocaleString('pt-BR') : '-'}</td>
                  <td className="actionCell">
                    <button title="Testar conexao" disabled={testandoConexaoId === conexao.id} onClick={() => testarConexao(conexao.id)}>
                      <Play size={14} /> {testandoConexaoId === conexao.id ? 'Testando...' : 'Testar'}
                    </button>
                    <button title="Editar conexao" onClick={() => setConexaoEditando(conexao)}><Edit3 size={14} /> Editar</button>
                    <button className="danger" title="Excluir conexao" onClick={() => excluirConexao(conexao.id)}><Trash2 size={14} /> Excluir</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {resultadoTeste && (
            <div className="connectionResult">
              <strong>Retorno do teste de conexao</strong>
              <pre>{resultadoTeste}</pre>
            </div>
          )}
        </div>
      </section>
    ),
    apis: (
      <section className="gridTwo">
        <form className="panel formStack" onSubmit={criarApi} key={apiEditando?.id ?? 'nova-api'}>
          <div className="panelHeader">
            <h2>{apiEditando ? 'Editar API' : 'Criar API'}</h2>
            <div className="actions">
              {apiEditando && <button type="button" onClick={() => setApiEditando(null)}>Cancelar</button>}
              <button className="primary" type="submit">{apiEditando ? 'Salvar API' : 'Criar rascunho'}</button>
            </div>
          </div>
          <div className="formGrid">
            <label>Nome<input name="nome" required defaultValue={apiEditando?.nome} placeholder="Comissoes de parceiros" /></label>
            <label>Empresa<select name="clienteId" required defaultValue={apiEditando?.clienteId ?? clientes[0]?.id}>{clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nomeFantasia}</option>)}</select></label>
            <label>Codigo interno<input name="codigoInterno" defaultValue={apiEditando?.codigoInterno} placeholder="PARCEIROS_COMISSOES" /></label>
            <label>Versao<input name="versao" defaultValue={apiEditando?.versao ?? '1.0.0'} /></label>
            <label>Metodo<input name="metodoHttp" value="GET" readOnly title="Nesta versao, o API Hub publica somente APIs de consulta GET." /></label>
            <label>Endpoint<input name="endpoint" required defaultValue={apiEditando?.endpoint} placeholder="/v1/minha-api" /></label>
            <label>Categoria<input name="categoria" defaultValue={apiEditando?.categoria ?? 'Corporativo'} /></label>
            <label>Conexao<select name="conexaoId" required defaultValue={apiEditando?.conexaoId ?? conexoes[0]?.id}>{conexoes.map((conexao) => <option key={conexao.id} value={conexao.id}>{conexao.nome}</option>)}</select></label>
            <label className="checkLine"><input name="paginacaoHabilitada" type="checkbox" defaultChecked={apiEditando?.paginacaoHabilitada ?? true} /> Paginacao habilitada</label>
            <label>Descricao<textarea name="descricao" defaultValue={apiEditando?.descricao} placeholder="Descreva a finalidade corporativa da API" /></label>
          </div>
        </form>
        <div className="panel">
          <div className="panelHeader"><h2>APIs cadastradas</h2></div>
          <div className="tableWrap">
            <table>
              <thead><tr><th>Nome</th><th>Endpoint</th><th>Status</th><th>Acoes</th></tr></thead>
              <tbody>{apis.map((api) => (
                <tr key={api.id}>
                  <td>{api.nome}</td>
                  <td>{api.endpoint}</td>
                  <td><Badge value={api.status} /></td>
                  <td className="actionCell">
                    <button onClick={() => setApiEditando(api)}><Edit3 size={14} /> Editar</button>
                  <button onClick={() => { const editor = aplicarApiNoEditor(api); setApiSelecionadaId(editor.id); setSqlAtual(editor.sql); setParametrosTeste(editor.parametrosTeste); setParametrosApiJson(editor.parametrosApi); setRegrasApiJson(editor.regras); setPagina('editor'); }}><TerminalSquare size={14} /> SQL/Docs</button>
                    <button onClick={() => { setApiSelecionadaId(api.id); setApiEditando(api); }}><FileCode2 size={14} /> Docs</button>
                    <button onClick={() => window.open(`${window.location.origin}/swagger`, '_blank')}>Swagger</button>
                    {api.status === 'publicado'
                      ? <button onClick={() => despublicarApi(api.id)}>Despublicar</button>
                      : <button className="primary" onClick={() => publicarApi(api.id)}>Publicar</button>}
                    <button className="danger" onClick={() => excluirApi(api.id)}><Trash2 size={14} /> Excluir</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
        {(apiEditando || apiSelecionada) && (
          <div className="panel apiDocumentation">
            <div className="panelHeader">
              <h2>Documentacao da API</h2>
              <div className="actions">
                <button onClick={() => window.open(urlsDocumentacaoApi(apiEditando ?? apiSelecionada, publicacao).swaggerLocal, '_blank')}>Swagger local</button>
                {urlsDocumentacaoApi(apiEditando ?? apiSelecionada, publicacao).swaggerPublico && (
                  <button onClick={() => window.open(urlsDocumentacaoApi(apiEditando ?? apiSelecionada, publicacao).swaggerPublico, '_blank')}>Swagger publicado</button>
                )}
              </div>
            </div>
            {(() => {
              const api = apiEditando ?? apiSelecionada;
              const urls = urlsDocumentacaoApi(api, publicacao);
              return (
                <>
                  <div className="docGrid">
                    <div><span>Metodo</span><strong>{api?.metodoHttp || 'GET'}</strong></div>
                    <div><span>Status</span><strong>{api?.status || 'rascunho'}</strong></div>
                    <div><span>Rota</span><strong>{api?.endpoint || '/v1/sua-api'}</strong></div>
                    <div><span>Autenticacao</span><strong>Bearer Token</strong></div>
                  </div>
                  <label>Endpoint local para teste<input readOnly value={urls.endpointLocal} /></label>
                  <label>Swagger local<input readOnly value={urls.swaggerLocal} /></label>
                  <label>OpenAPI local<input readOnly value={urls.openApiLocal} /></label>
                  {urls.endpointPublico ? (
                    <>
                      <label>Endpoint publicado<input readOnly value={urls.endpointPublico} /></label>
                      <label>Swagger publicado<input readOnly value={urls.swaggerPublico} /></label>
                      <label>OpenAPI publicado<input readOnly value={urls.openApiPublico} /></label>
                    </>
                  ) : <p className="hint">Configure o dominio da empresa em Dominios para exibir as URLs publicadas.</p>}
                  <pre>{JSON.stringify(api?.previewDocumentacao ?? {
                    metodoHttp: api?.metodoHttp || 'GET',
                    rota: api?.endpoint || '/v1/sua-api',
                    urlLocal: urls.endpointLocal,
                    urlPublica: urls.endpointPublico || null,
                    autenticacao: 'Bearer Token',
                    exemploResposta: { sucesso: true, meta: { pagina: 1, quantidadePorPagina: 100, totalRegistros: 0 }, dados: [] }
                  }, null, 2)}</pre>
                </>
              );
            })()}
          </div>
        )}
      </section>
    ),
    editor: (
      <section className="editorLayout">
        <div className="panel">
          <div className="panelHeader">
            <h2>Editor SQL</h2>
            <div className="actions">
              <button onClick={salvarSql}><Save size={14} /> Salvar SQL</button>
              <button onClick={salvarParametrosApi}><Save size={14} /> Salvar parametros</button>
              <button onClick={testarSql}><Play size={14} /> Testar</button>
              <button className="primary" onClick={() => publicarApi()}>Publicar</button>
            </div>
          </div>
          <label>API<select value={apiSelecionada?.id ?? ''} onChange={(event) => { const api = apis.find((item) => item.id === event.target.value); const editor = aplicarApiNoEditor(api); setApiSelecionadaId(editor.id); setSqlAtual(editor.sql); setParametrosTeste(editor.parametrosTeste); setParametrosApiJson(editor.parametrosApi); setRegrasApiJson(editor.regras); }}>{apis.map((api) => <option key={api.id} value={api.id}>{api.nome}</option>)}</select></label>
          <textarea value={sqlAtual} onChange={(event) => setSqlAtual(event.target.value)} spellCheck={false} />
        </div>
        <div className="panel sidePanel">
          <h2>Documentacao da API</h2>
          <div className="docActions">
            <button onClick={() => window.open(urlsApiSelecionada.swaggerLocal, '_blank')}>Swagger local</button>
            {urlsApiSelecionada.swaggerPublico && <button onClick={() => window.open(urlsApiSelecionada.swaggerPublico, '_blank')}>Swagger publicado</button>}
          </div>
          <label>Endpoint local<input readOnly value={urlsApiSelecionada.endpointLocal} /></label>
          {urlsApiSelecionada.endpointPublico && <label>Endpoint publicado<input readOnly value={urlsApiSelecionada.endpointPublico} /></label>}
          <h2>Resultado</h2>
          <pre className="resultBox">{resultadoTeste || 'Salve e teste o SQL para visualizar os campos inferidos e o envelope de resposta.'}</pre>
          <h2>Parametros de teste</h2>
          <textarea className="paramText" value={parametrosTeste} onChange={(event) => setParametrosTeste(event.target.value)} spellCheck={false} />
          <h2>Parametros da API</h2>
          <textarea className="paramText tall" value={parametrosApiJson} onChange={(event) => setParametrosApiJson(event.target.value)} spellCheck={false} />
          <h2>Regras de validacao</h2>
          <textarea className="paramText tall" value={regrasApiJson} onChange={(event) => setRegrasApiJson(event.target.value)} spellCheck={false} />
          <h2>Campos publicos</h2>
          {(apiSelecionada?.campos ?? []).map((campo) => <span className="fieldChip" key={campo.nomePublico}>{campo.nomePublico}</span>)}
        </div>
      </section>
    ),
    consumidores: (
      <section className="gridTwo">
        <form className="panel formStack" onSubmit={salvarClienteConsumidor} key={consumidorEditando?.id ?? 'novo-consumidor'}>
          <div className="panelHeader">
            <h2>{consumidorEditando ? 'Editar cliente consumidor' : 'Novo cliente consumidor'}</h2>
            <div className="actions">
              {consumidorEditando && <button type="button" onClick={() => setConsumidorEditando(null)}>Cancelar</button>}
              <button className="primary" type="submit">{consumidorEditando ? 'Salvar cliente' : 'Criar e gerar token'}</button>
            </div>
          </div>
          <div className="formGrid">
            <label>Nome do cliente<input name="nomeCliente" required defaultValue={consumidorEditando?.nomeCliente} placeholder="Integrador, marketplace ou parceiro" /></label>
            <label>E-mail responsavel<input name="emailResponsavel" type="email" defaultValue={consumidorEditando?.emailResponsavel} placeholder="integrador@cliente.com.br" /></label>
            <label>Telefone<input name="telefone" defaultValue={consumidorEditando?.telefone} /></label>
            <label>Status<select name="status" defaultValue={consumidorEditando?.status ?? 'ativo'}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></label>
            <label>Expiracao do token<input name="dataExpiracaoToken" type="date" defaultValue={consumidorEditando?.dataExpiracaoToken?.slice(0, 10)} /></label>
            <label>Descricao<textarea name="descricao" defaultValue={consumidorEditando?.descricao} placeholder="Finalidade do consumo da API" /></label>
            <label>Observacoes<textarea name="observacoes" defaultValue={consumidorEditando?.observacoes} /></label>
          </div>
        </form>
        <div className="panel">
          <div className="panelHeader"><h2>Clientes consumidores</h2></div>
          <div className="tableWrap">
            <table>
              <thead><tr><th>Cliente</th><th>Responsavel</th><th>Token</th><th>Status</th><th>Acoes</th></tr></thead>
              <tbody>{clientesConsumidores.map((consumidor) => (
                <tr key={consumidor.id}>
                  <td>{consumidor.nomeCliente}</td>
                  <td>{consumidor.emailResponsavel || '-'}</td>
                  <td>{consumidor.tokenMascarado}</td>
                  <td><Badge value={consumidor.status} /></td>
                  <td className="actionCell">
                    <button onClick={() => setConsumidorEditando(consumidor)}><Edit3 size={14} /> Editar</button>
                    <button onClick={() => regenerarTokenConsumidor(consumidor.id)}><KeyRound size={14} /> Regenerar token</button>
                    <button className="danger" onClick={() => excluirClienteConsumidor(consumidor.id)}><Trash2 size={14} /> Excluir</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      </section>
    ),
    tokens: (
      <section className="gridTwo">
        <form className="panel formStack" onSubmit={salvarToken} key={tokenEditando?.id ?? 'novo-token'}>
          <div className="panelHeader">
            <h2>{tokenEditando ? 'Editar token' : 'Novo token'}</h2>
            <div className="actions">
              {tokenEditando && <button type="button" onClick={() => setTokenEditando(null)}>Cancelar</button>}
              <button className="primary" type="submit">{tokenEditando ? 'Salvar token' : 'Gerar token'}</button>
            </div>
          </div>
          <div className="formGrid">
            <label>Nome<input name="nome" required defaultValue={tokenEditando?.nome} placeholder="Token parceiro ecommerce" /></label>
            <label>Empresa<select name="clienteId" required defaultValue={tokenEditando?.clienteId ?? clientes[0]?.id}>{clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nomeFantasia}</option>)}</select></label>
            <label>Parceiro<input name="parceiro" required defaultValue={tokenEditando?.parceiro} placeholder="Nome do integrador" /></label>
            <label>Status<select name="status" defaultValue={tokenEditando?.status ?? 'ativo'}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></label>
            <label>Expira em<input name="expiraEm" type="date" defaultValue={tokenEditando?.expiraEm?.slice(0, 10)} /></label>
            <label>Observacao<textarea name="observacao" defaultValue={tokenEditando?.observacao} /></label>
          </div>
        </form>
        <div className="panel">
          <div className="panelHeader"><h2>Tokens cadastrados</h2></div>
          <div className="tableWrap">
            <table>
              <thead><tr><th>Nome</th><th>Parceiro</th><th>Token</th><th>Status</th><th>Acoes</th></tr></thead>
              <tbody>{tokens.map((token) => (
                <tr key={token.id}>
                  <td>{token.nome}</td>
                  <td>{token.parceiro}</td>
                  <td>{token.tokenMascarado}</td>
                  <td><Badge value={token.status} /></td>
                  <td className="actionCell">
                    <button onClick={() => setTokenEditando(token)}><Edit3 size={14} /> Editar</button>
                    <button className="danger" onClick={() => excluirToken(token.id)}><Trash2 size={14} /> Excluir</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      </section>
    ),
    usuarios: isAdmin ? (
      <section className="gridTwo userManagement">
        <form className="panel formStack" onSubmit={criarUsuario} key={usuarioEditando?.id ?? 'novo-usuario'}>
          <div className="panelHeader">
            <h2>{usuarioEditando ? 'Editar usuario' : 'Novo usuario'}</h2>
            <div className="actions">
              {usuarioEditando && <button type="button" onClick={() => setUsuarioEditando(null)}>Cancelar</button>}
              <button className="primary" type="submit">{usuarioEditando ? 'Salvar usuario' : 'Criar usuario'}</button>
            </div>
          </div>
          <div className="formGrid">
            <label>Nome<input name="nome" required defaultValue={usuarioEditando?.nome} placeholder="Nome do usuario" /></label>
            <label>E-mail<input name="email" type="email" required defaultValue={usuarioEditando?.email} placeholder="usuario@empresa.com.br" /></label>
            <label>Perfil<select name="perfil" required defaultValue={usuarioEditando?.perfil ?? 'operador'}><option value="operador">Operador</option><option value="admin">Administrador</option><option value="visualizador">Visualizador</option></select></label>
            <label>Status<select name="status" defaultValue={usuarioEditando?.status ?? 'ativo'}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></label>
            <fieldset className="companyAccess">
              <legend>Empresas com acesso</legend>
              {clientes.map((cliente) => (
                <label key={cliente.id} className="checkLine">
                  <input
                    name="empresasIds"
                    type="checkbox"
                    value={cliente.id}
                    defaultChecked={usuarioEditando ? usuarioEditando.empresasIds?.includes(cliente.id) : clientes.length === 1}
                  />
                  {cliente.nomeFantasia || cliente.nomeEmpresa}
                </label>
              ))}
            </fieldset>
          </div>
          <p className="hint">A senha nao e definida pelo administrador. O usuario cria a propria senha no primeiro acesso.</p>
        </form>
        <div className="panel">
          <div className="panelHeader"><h2>Usuarios cadastrados</h2></div>
          <div className="tableWrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Primeiro acesso</th><th>Status</th><th>Acoes</th></tr></thead><tbody>{usuarios.map((usuario) => <tr key={usuario.id}><td>{usuario.nome}</td><td>{usuario.email}</td><td>{usuario.perfil}</td><td>{usuario.primeiroAcesso ? 'pendente' : 'concluido'}</td><td><Badge value={usuario.status} /></td><td className="actionCell"><button onClick={() => setUsuarioEditando(usuario)}><Edit3 size={14} /> Editar</button><button className="danger" onClick={() => excluirUsuario(usuario.id)}><Trash2 size={14} /> Excluir</button></td></tr>)}</tbody></table></div>
        </div>
      </section>
    ) : <div className="panel"><h2>Acesso restrito</h2><p>Somente administradores podem gerenciar usuarios.</p></div>,
    logs: <div className="panel"><div className="panelHeader"><h2>Logs</h2><button onClick={() => carregarDados()}><RefreshCw size={14} /> Atualizar</button></div><div className="tableWrap"><table><thead><tr><th>Horario</th><th>API</th><th>Status</th><th>Latencia</th><th>Origem</th><th>Acoes</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td>{new Date(log.horario).toLocaleString('pt-BR')}</td><td>{log.apiId}</td><td><Badge value={log.statusHttp} /></td><td>{log.latenciaMs} ms</td><td>{log.origemIp}</td><td className="actionCell"><button className="danger" onClick={() => excluirLog(log.id)}><Trash2 size={14} /> Excluir</button></td></tr>)}</tbody></table></div></div>,
    dominios: (
      <section className="gridTwo settingsGrid">
        <form className="panel formStack" onSubmit={salvarPublicacao}>
          <div className="panelHeader">
            <h2>Dominios e publicacao</h2>
            <button className="primary" type="submit"><Save size={14} /> Salvar URL publica</button>
          </div>
          <div className="formGrid">
            <label>Ambiente<select name="ambiente" defaultValue={publicacao.ambiente}><option value="local">Local</option><option value="homologacao">Homologacao</option><option value="producao">Producao</option></select></label>
            <label>Dominio principal<input name="dominioPrincipal" required defaultValue={publicacao.dominioPrincipal} placeholder="cliente.com.br" /></label>
            <label>Subdominio da API<input name="subdominioApi" required defaultValue={publicacao.subdominioApi} placeholder="api.cliente.com.br" /></label>
            <label>URL local do servidor<input name="urlBaseLocal" defaultValue={window.location.origin} placeholder="http://IP_DO_SERVIDOR:3333" /></label>
            <label>URL base da API<input name="urlBaseApi" required defaultValue={publicacao.urlBaseApi} placeholder="https://api.cliente.com.br" /></label>
            <label>URL da documentacao<input name="urlBaseDocumentacao" required defaultValue={publicacao.urlBaseDocumentacao} placeholder="https://api.cliente.com.br/swagger" /></label>
          </div>
          <p className="hint">Esta tela define a URL que aparecera no Swagger/OpenAPI e no passo de entrega ao cliente. Na arquitetura com Nginx, a porta publica interna e 3333 e o backend Node roda na 3335.</p>
        </form>
        <div className="panel documentation">
          <div className="panelHeader"><h2>Previa de publicacao</h2><button onClick={() => window.open(publicacao.urlBaseDocumentacao, '_blank')}>Abrir documentacao</button></div>
          <p>Use estes enderecos para validar a publicacao e entregar ao integrador.</p>
          <pre>{`Endpoint local para teste:
${window.location.origin}/v1/parceiros/comissoes

Swagger local:
${window.location.origin}/swagger

OpenAPI local:
${window.location.origin}/documentacao/openapi.json

Endpoint publicado:
${publicacao.urlBaseApi}/v1/parceiros/comissoes

Swagger publicado:
${publicacao.urlBaseDocumentacao}

OpenAPI publicado:
${publicacao.urlBaseApi}/documentacao/openapi.json

Cabecalho obrigatorio:
Authorization: Bearer TOKEN_DO_CLIENTE`}</pre>
        </div>
      </section>
    ),
    configuracoes: (
      <section className="gridTwo settingsGrid">
        <form className="panel formStack" onSubmit={salvarIdentidade}>
          <div className="panelHeader"><h2>Identidade do cliente</h2><button className="primary" type="submit">Aplicar marca</button></div>
          <div className="formGrid">
            <label>Nome exibido no topo<input name="nomeLoja" value={identidadeForm.nomeLoja} onChange={(event) => setIdentidadeForm((atual) => ({ ...atual, nomeLoja: event.target.value }))} placeholder="Ar Condicionado" /></label>
            <label>Descricao curta<input name="descricaoCurta" value={identidadeForm.descricaoCurta ?? ''} onChange={(event) => setIdentidadeForm((atual) => ({ ...atual, descricaoCurta: event.target.value }))} placeholder="Monvizo" /></label>
            <label>Logo do cliente<input name="logoArquivo" type="file" accept="image/png,image/jpeg,image/webp" /></label>
          </div>
          <p className="hint">Use uma imagem horizontal ou quadrada em JPG, PNG ou WEBP. A lateral continua fixa com Control S; a marca do cliente fica estatica no canto direito do topo.</p>
        </form>
        <div className="panel brandPreview">
          <h2>Previa</h2>
          <MarcaLoja identidade={identidadeLoja} />
          <p>A marca da loja aparece como contexto da integração, sem alterar o nome do sistema.</p>
        </div>
      </section>
    )
  };

  return (
    <div className={compacto ? 'app compact' : 'app'}>
      <aside>
        <Logo compacto={compacto} />
        <nav>
          {menuVisivel.map(([id, label, Icon]) => (
            <button className={pagina === id ? 'active' : ''} key={id} onClick={() => setPagina(id)} title={label}>
              <Icon size={18} />
              {!compacto && <span>{label}</span>}
            </button>
          ))}
        </nav>
        <button className="collapse" onClick={() => setCompacto((value) => !value)}>
          {compacto ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!compacto && <span>Recolher menu</span>}
        </button>
      </aside>
      <main>
        <header>
          <div className="productTitle">
            <span className="eyebrow">Plataforma corporativa</span>
            <strong>Control S API Hub</strong>
          </div>
          <div className="pageTitle">
            <h1>{titulo === 'Dashboard' ? 'Dashboard Executivo' : titulo}</h1>
            <p>{subtitulosPagina[pagina]}</p>
          </div>
          <div className="clientBrand">
            <MarcaLoja identidade={identidadeLoja} />
          </div>
        </header>
        <StatusBar mensagem={mensagem} erro={erro} onClose={() => { setMensagem(''); setErro(''); }} />
        {conteudo[pagina]}
        <footer>CONTROL S CONSULTORIA - Direitos Reservados | CNPJ: 21.421.411/0001-20</footer>
      </main>
    </div>
  );
}

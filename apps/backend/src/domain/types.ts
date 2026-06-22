export type Ambiente = 'local' | 'homologacao' | 'producao';
export type StatusOperacional = 'ativo' | 'inativo' | 'rascunho' | 'publicado' | 'despublicado';
export type TipoBanco = 'oracle' | 'sqlserver' | 'firebird';
export type MetodoHttp = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type OrigemParametro = 'query' | 'path' | 'header' | 'body';
export type TipoParametro = 'texto' | 'numero' | 'data' | 'booleano' | 'documento' | 'lista';

export interface Cliente {
  id: string;
  nomeEmpresa: string;
  nomeFantasia: string;
  cnpj: string;
  codigoInterno: string;
  responsavel: string;
  email: string;
  telefone: string;
  ambiente: Ambiente;
  status: 'ativo' | 'inativo';
  observacoes?: string;
  dominioPrincipal: string;
  subdominioApi: string;
  dataCadastro: string;
  dataAtualizacao?: string;
  dominioApi?: string;
  urlBaseLocal?: string;
  urlBaseApi?: string;
}

export type Empresa = Cliente;

export interface UsuarioEmpresa {
  id: string;
  usuarioId: string;
  empresaId: string;
  perfil: 'admin' | 'operador' | 'visualizador';
  empresaPadrao?: boolean;
  ativo: boolean;
}

export interface ClienteConsumidor {
  id: string;
  empresaId: string;
  nomeCliente: string;
  descricao?: string;
  emailResponsavel?: string;
  telefone?: string;
  tokenMascarado: string;
  tokenHash?: string;
  status: 'ativo' | 'inativo';
  dataExpiracaoToken?: string;
  observacoes?: string;
  dataCadastro: string;
  dataAtualizacao?: string;
}

export interface ConexaoBanco {
  id: string;
  nome: string;
  clienteId: string;
  empresaId?: string;
  nomeConexao?: string;
  tipoBanco: TipoBanco;
  host: string;
  porta: number;
  bancoOuServico: string;
  usuario: string;
  senhaCriptografada: string;
  ambiente: Ambiente;
  status: 'ativa' | 'inativa';
  observacoes?: string;
  stringConexaoOpcional?: string;
  ultimaValidacao?: string;
  dataCadastro?: string;
  dataAtualizacao?: string;
}

export interface ParametroApi {
  id: string;
  nomeTecnico: string;
  nomePublico: string;
  tipo: TipoParametro;
  obrigatorio: boolean;
  origem: OrigemParametro;
  descricao: string;
  exemplo: string;
  validacao?: string;
  mascara?: string;
  normalizacao?: 'removerMascara' | 'maiusculo' | 'minusculo' | 'trim';
  valorPadrao?: string;
  valoresPermitidos?: string[];
}

export interface RegraNegocioApi {
  exigirAoMenosUmGrupo?: string[][];
  periodoObrigatorioEmConjunto?: [string, string];
  limiteMaximoIntervaloDias?: number;
  quantidadeMaximaPorPagina?: number;
  ordenacaoPadrao?: string;
  timeoutMs?: number;
  removerMascaraDocumento?: boolean;
  paginacaoPermitida?: boolean;
}

export interface CampoPublicoApi {
  origem: string;
  nomePublico: string;
  tipo: TipoParametro;
  descricao: string;
  exemplo: string | number | boolean | null;
}

export interface ApiCadastrada {
  id: string;
  nome: string;
  nomeApi?: string;
  codigoInterno: string;
  clienteId: string;
  empresaId?: string;
  descricao: string;
  versao: string;
  categoria: string;
  status: StatusOperacional;
  metodoHttp: MetodoHttp;
  endpoint: string;
  rotaPublica?: string;
  origemDados: string;
  conexaoId: string;
  tipoExecucao: 'consultaSql';
  autenticacao: 'bearerToken';
  paginacaoHabilitada: boolean;
  ativa?: boolean;
  exigeToken?: boolean;
  permitePaginacao?: boolean;
  timeoutSegundos?: number;
  publicadaEm?: string;
  dataCriacao: string;
  dataAtualizacao?: string;
  ultimaPublicacao?: string;
  sqlBase: string;
  apiSql?: {
    id: string;
    sqlOriginal: string;
    sqlTratada?: string;
    ultimoTesteOk?: boolean;
    ultimaExecucaoTeste?: string;
    previewDocumentacao?: unknown;
    previewResposta?: unknown;
    parametrosTeste?: Record<string, unknown>;
    dataCadastro?: string;
    dataAtualizacao?: string;
  };
  parametros: ParametroApi[];
  campos: CampoPublicoApi[];
  regras: RegraNegocioApi;
}

export interface TokenAcesso {
  id: string;
  nome: string;
  clienteId: string;
  empresaId?: string;
  clienteConsumidorId?: string;
  parceiro: string;
  tokenMascarado: string;
  tokenHash?: string;
  status: 'ativo' | 'inativo';
  expiraEm?: string;
  observacao?: string;
  criadoEm: string;
}

export interface LogChamada {
  id: string;
  empresaId?: string;
  apiId: string;
  clienteConsumidorId?: string;
  tokenId?: string;
  tokenUtilizado?: string;
  metodoHttp?: string;
  endpoint?: string;
  origemAcesso?: 'local' | 'publica';
  statusHttp: number;
  latenciaMs: number;
  tempoRespostaMs?: number;
  origemIp: string;
  horario: string;
  dataHora?: string;
  payloadResumo?: string;
  parametrosRecebidos?: Record<string, unknown>;
  totalRegistros?: number;
  mensagemErro?: string;
  erroCodigo?: string;
}

export interface Usuario {
  id: string;
  nome: string;
  nomeUsuario?: string;
  email: string;
  perfil: 'admin' | 'operador' | 'visualizador';
  status: 'ativo' | 'inativo';
  senhaHash?: string;
  primeiroAcesso: boolean;
  criadoEm: string;
}

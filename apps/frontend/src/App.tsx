import {
  Activity,
  AlertTriangle,
  BellRing,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Database,
  Edit3,
  FileCode2,
  Globe2,
  PlugZap,
  KeyRound,
  LayoutDashboard,
  Link2,
  LogOut,
  Play,
  RefreshCw,
  Save,
  Settings,
  TerminalSquare,
  Trash2,
  UserCog,
  UserX,
  Video,
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";

const API_BASE = window.location.port === "5173" ? "http://localhost:3335" : "";

type MenuId =
  | "dashboard"
  | "clientes"
  | "conexoes"
  | "integracoes"
  | "apis"
  | "editor"
  | "consumidores"
  | "tokens"
  | "usuarios"
  | "perfis"
  | "logs"
  | "dominios"
  | "configuracoes";

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
  tipoBanco: "oracle" | "sqlserver" | "firebird";
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
  campos: {
    nomePublico: string;
    tipo: string;
    exemplo: string | number | boolean | null;
  }[];
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
type LogChamada = {
  id: string;
  horario: string;
  apiId: string;
  statusHttp: number;
  latenciaMs: number;
  origemIp: string;
  erroCodigo?: string;
};
type Usuario = {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  status: string;
  primeiroAcesso: boolean;
  criadoEm: string;
  empresasIds?: string[];
  menusPermitidos?: MenuId[];
  perfilAcessoId?: string;
};
type UsuarioLogado = {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  menusPermitidos?: MenuId[];
  perfilAcessoId?: string;
  permissoesAcoes?: string[];
  tiposAlerta?: string[];
};
type PerfilAcesso = {
  id: string;
  nome: string;
  descricao?: string;
  menusPermitidos: MenuId[];
  permissoesAcoes?: string[];
  tiposAlerta?: string[];
  padrao?: boolean;
  ativo: boolean;
};
type Identidade = {
  nomeLoja: string;
  logoUrl: string;
  descricaoCurta?: string;
};
type EmpresaLogin = {
  id: string;
  nomeEmpresa: string;
  nomeFantasia: string;
  perfil: string;
};
type PublicacaoConfig = {
  ambiente: "local" | "homologacao" | "producao";
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
type Integracao = {
  id: string;
  empresaId: string;
  provedor: "gmobii";
  nome: string;
  urlBase: string;
  status: "ativa" | "inativa" | "erro";
  intervaloMinutos: number;
  limitePorLote: number;
  tokenConfigurado: boolean;
  ultimoCursor?: string;
  ultimaSincronizacao?: string;
  ultimoSucesso?: string;
  ultimaFalha?: string;
  totalRegistros: number;
  atualizadoEm?: string;
};
type ExecucaoIntegracao = {
  id: string;
  tipo: "teste" | "sincronizacao";
  status: "executando" | "sucesso" | "falha";
  iniciadaEm: string;
  finalizadaEm?: string;
  duracaoMs?: number;
  registrosRecebidos: number;
  registrosInseridos: number;
  registrosAtualizados: number;
  lotesProcessados: number;
  mensagem?: string;
};
type LogIntegracao = {
  id: string;
  nivel: "informacao" | "aviso" | "erro";
  evento: string;
  mensagem: string;
  statusHttp?: number;
  duracaoMs?: number;
  detalhes?: Record<string, unknown>;
  criadoEm: string;
};
type AlertaIntegracao = {
  id: string;
  integracaoId: string;
  severidade: "aviso" | "critico";
  titulo: string;
  mensagem: string;
  detalhes?: {
    numeroPedido?: string;
    versaoContrato?: string;
    campos?: Array<{
      campo: string;
      estado: "preenchido" | "nulo_recebido" | "ausente" | "em_branco";
      valor: unknown;
      produtoIndice?: number;
      produtoCodigo?: unknown;
      produtoDescricao?: unknown;
    }>;
    camposObrigatorios?: string[];
    problemasCriticos?: string[];
    origem?: string;
    tipoProblema?: string;
    divergenciasErp?: Array<{entidade:string;tipo?:string;campo:string;rotulo?:string;valor:unknown;codigoErp?:number;mensagem:string}>;
  };
  lido: boolean;
  criadoEm: string;
};
type DadoIntegracao = {
  id: string;
  chaveExterna: string;
  dataReferencia?: string;
  conteudo: Record<string, any>;
  excluido?: boolean;
  excluidoEm?: string;
  excluidoPor?: string;
  excluidoPorNome?: string;
  validacaoErp?: {
    status: "apto" | "pendente";
    atualizadoEm: string;
    detalhes: {
      cliente?: {codigoErp?:number;nome?:string;encontrado:boolean;origem?:string};
      vendedor?: {codigoErp?:number;nome?:string;encontrado:boolean;origem?:string};
      empresa?: {codigoErp?:number;nome?:string;encontrado:boolean};
      produtos?: Array<{indice:number;codigoRecebido:unknown;codigoErp?:number;descricao?:string;encontrado:boolean}>;
      pendencias?: Array<{entidade:string;campo:string;valor:unknown;mensagem:string}>;
    };
  };
};
type OpcaoConstrushow = { codigo: number; descricao: string };
type ConfiguracaoConstrushow = {
  conexaoId: string;
  estab: number;
  estabDescricao?: string;
  estabProduto: number;
  estabProdutoDescricao?: string;
  estabNc: number;
  idNotaConf: number;
  notaConfDescricao?: string;
  idCliente?: number;
  clienteNome?: string;
  idVendedor?: number;
  vendedorNome?: string;
  validadeCarrinho: number;
  diasPrevisaoEntrega?: number;
  integracaoAutomatica?: boolean;
  intervaloIntegracaoMinutos?: number;
  modoExclusaoPedidos?: "logica" | "definitiva";
  monitorarCancelamentos?: boolean;
  intervaloCancelamentosMinutos?: number;
  acaoCancelamentoGmobii?: "excluir" | "devolver";
  monitorarAprovacoes?: boolean;
  intervaloAprovacoesMinutos?: number;
  atualizadoEm?: string;
};
const chaveRascunhoConstrushow="controlS.gmobii.configuracaoConstrushow";
function lerRascunhoConstrushow(){try{return JSON.parse(localStorage.getItem(chaveRascunhoConstrushow)??"null") as ConfiguracaoConstrushow|null}catch{return null}}
type RegraNotificacaoEmail={ativo:boolean;envioImediato:boolean;repetirEnquantoAberto:boolean;destinatarios:string[]};
type ConfiguracaoNotificacaoEmail={ativo:boolean;inicio:string;fim:string;intervaloMinutos:number;remetente:string;provedorConfigurado?:boolean;chaveResend?:string;tipos:{integracao_critica:RegraNotificacaoEmail;erro_api:RegraNotificacaoEmail}};
type DadoIntegradoConstrushow = {
  id: string;
  pedido_gmobii: string;
  estab: number;
  id_carrinho?: number;
  id_nota?: string | number;
  situacao_carrinho?: string;
  passou_caixa?: "S" | "N";
  aprovacao_status?: string;
  cancelamento_acao?: "excluir"|"devolver";
  cancelamento_status?: "pendente"|"erro"|"bloqueado"|"concluido";
  cancelamento_status_http?: number;
  cancelamento_mensagem?: string;
  cancelamento_concluido_em?: string;
  eventos_pedido?: Array<{evento:string;nivel:"informacao"|"info"|"aviso"|"erro";mensagem:string;status_http?:number;duracao_ms?:number;detalhes?:Record<string,unknown>;criado_em:string}>;
  status: "integrado" | "existente" | "erro";
  mensagem?: string;
  dados_coletados: Record<string, any>;
  dados_construshow?: Record<string, any>;
  atualizado_em: string;
};
type DetalheCarrinhoConstrushow={
  pedidoGmobii:string;
  cabecalho:{estabelecimento:number;numeroCarrinho:number;numeroCartao?:string;abertura?:string;situacao?:string;codigoCliente?:number;cliente?:string;documento?:string;codigoVendedor?:number;vendedor?:string;observacao?:string;validade?:string;formaCompra?:number;prazoMedio?:number;taxaPrazo?:number;taxaFrete?:number;despesas?:number;juros?:number;total:number;totalDesconto:number;totalFrete:number;numeroNota?:string|number};
  itens:Array<{sequencia:number;codigo:string;descricao:string;unidade:string;quantidade:number;valorUnitario:number;valorTotal:number;desconto:number;entregar:string;quantidadeEntrega:number;previsaoEntrega?:string;cfop?:string;codigoVendedor?:number;localRetirada?:number}>;
};
const colunasIntegrados = [
  ["pedido", "Pedido GMOBii", 125],
  ["cliente", "Cliente", 190],
  ["documento", "Documento", 150],
  ["empresa", "Empresa", 125],
  ["criacao", "Criação", 165],
  ["estabelecimento", "Estabelecimento", 125],
  ["carrinho", "Carrinho", 105],
  ["nota", "Nota", 105],
  ["caixa", "Passou no caixa", 130],
  ["situacao", "Situação carrinho", 140],
  ["status", "Status", 105],
  ["tentativa", "Última tentativa", 165],
] as const;
function valorColunaIntegrado(item:DadoIntegradoConstrushow,id:string):unknown{
  if(id==="pedido")return item.pedido_gmobii;
  if(id==="cliente")return item.dados_coletados?.cliente;
  if(id==="documento")return item.dados_coletados?.cliente_documento;
  if(id==="empresa")return item.dados_coletados?.empresa;
  if(id==="criacao")return item.dados_coletados?.data_criacao;
  if(id==="estabelecimento")return item.estab;
  if(id==="carrinho")return item.id_carrinho;
  if(id==="nota")return item.id_nota;
  if(id==="caixa")return item.passou_caixa;
  if(id==="situacao")return item.situacao_carrinho;
  if(id==="status")return item.status;
  if(id==="tentativa")return item.atualizado_em;
  return "";
}
function descricaoSituacaoCarrinho(codigo:unknown){
  const valor=String(codigo??"").trim().toUpperCase();
  const descricoes:Record<string,string>={A:"Aberto",E:"Cancelado",F:"Finalizado"};
  if(!valor)return "Não disponível";
  return descricoes[valor]?`${valor} - ${descricoes[valor]}`:valor;
}
function situacaoOperacionalCarrinho(item:DadoIntegradoConstrushow){
  const acao=item.cancelamento_acao==="devolver"?"retornar":"excluir";
  if(item.cancelamento_status==="concluido")return item.cancelamento_acao==="devolver"?"Retornado no GMOBii":"Excluído no GMOBii";
  if(item.cancelamento_status==="pendente")return acao==="retornar"?"Aguardando retorno ao GMOBii":"Aguardando exclusão no GMOBii";
  if(item.cancelamento_status==="erro"||item.cancelamento_status==="bloqueado")return acao==="retornar"?"Falha ao retornar no GMOBii":"Falha ao excluir no GMOBii";
  return descricaoSituacaoCarrinho(item.situacao_carrinho);
}
function nomeEventoPedido(evento:string){const nomes:Record<string,string>={integracao_construshow_concluida:"Integração concluída no Construshow",integracao_construshow_falhou:"Falha na integração com o Construshow",cancelamento_gmobii_concluido:"Cancelamento comunicado à GMOBii",cancelamento_gmobii_falhou:"Falha ao comunicar cancelamento à GMOBii",carrinho_cancelado_movido_historico:"Carrinho cancelado arquivado",carrinho_cancelado_historico:"Carrinho cancelado no histórico",aprovacao_gmobii_concluida:"Aprovação enviada à GMOBii",aprovacao_gmobii_falhou:"Falha ao enviar aprovação à GMOBii",pedido_coletado_excluido:"Pedido coletado excluído",tentativa_integracao_excluida:"Tentativa de integração excluída"};return nomes[evento]??evento.replace(/_/g," ").replace(/^./,letra=>letra.toUpperCase())}
const colunasPedido = [
  ["numero_pedido", "Pedido", 120],
  ["cliente", "Cliente", 190],
  ["cliente_documento", "Documento do cliente", 155],
  ["cliente_codigo_erp", "Cód. ERP cliente", 130],
  ["vendedor", "Vendedor", 170],
  ["vendedor_documento", "Documento do vendedor", 165],
  ["vendedor_codigo_erp", "Cód. ERP vendedor", 140],
  ["empresa", "Empresa", 140],
  ["empresa_documento", "Documento da empresa", 165],
  ["empresa_codigo_erp", "Cód. ERP filial", 125],
  ["tipo_servico", "Serviço", 130],
  ["data_criacao", "Criação", 165],
  ["data_envio_producao", "Envio produção", 175],
  ["chapas_total", "Chapas", 90],
  ["deslocamentos", "Deslocamentos", 120],
  ["fita_borda_m", "Fita (m)", 90],
  ["observacoes", "Observações", 240],
  ["itens", "Itens", 80],
  ["produtos_codigos_erp", "Códigos ERP produtos", 190],
  ["produtos_erp", "Produtos no ERP", 135],
] as const;

function valorColunaPedido(dado:DadoIntegracao,id:string){
  const validacao=dado.validacaoErp?.detalhes;
  const aguardando=!dado.validacaoErp;
  if(id==="cliente_codigo_erp")return aguardando?"Aguardando validação":validacao?.cliente?.codigoErp??"Não localizado";
  if(id==="vendedor_codigo_erp")return aguardando?"Aguardando validação":validacao?.vendedor?.codigoErp??"Não localizado";
  if(id==="empresa_codigo_erp")return aguardando?"Aguardando validação":validacao?.empresa?.codigoErp??"Não localizada";
  if(id==="produtos_codigos_erp"){const produtos=validacao?.produtos??[];return produtos.length?produtos.map(p=>p.codigoErp??`${p.codigoRecebido??"?"} (não localizado)`).join(", "):"Não validado"}
  if(id==="produtos_erp"){const produtos=validacao?.produtos??[];return produtos.length?`${produtos.filter(p=>p.encontrado).length}/${produtos.length} localizados`:"Não validado"}
  return dado.conteudo[id];
}

const camposObrigatoriosPedido = new Set([
  "numero_pedido",
  "cliente_documento",
  "vendedor_documento",
  "empresa_documento",
  "data_criacao",
  "itens",
]);

function jsonCompletoPedido(dado: DadoIntegracao) {
  const origem = dado.conteudo ?? {};
  const pedido = {
    numero_pedido: origem.numero_pedido ?? dado.chaveExterna ?? null,
    cliente: origem.cliente ?? null,
    cliente_documento: origem.cliente_documento ?? null,
    vendedor: origem.vendedor ?? null,
    vendedor_documento: origem.vendedor_documento ?? null,
    empresa: origem.empresa ?? null,
    empresa_documento: origem.empresa_documento ?? null,
    tipo_servico: origem.tipo_servico ?? null,
    data_criacao: origem.data_criacao ?? null,
    data_envio_producao:
      origem.data_envio_producao ?? dado.dataReferencia ?? null,
    observacoes: origem.observacoes ?? null,
    chapas_total: origem.chapas_total ?? null,
    deslocamentos: origem.deslocamentos ?? null,
    fita_borda_m: origem.fita_borda_m ?? null,
    itens: origem.itens ?? null,
    ...origem,
  };
  return {
    pedidos: [pedido],
    total: 1,
    proximo_desde: pedido.data_envio_producao,
  };
}

function formatarData(valor: unknown, comHora = true) {
  if (!valor) return "-";
  const data = new Date(String(valor));
  if (Number.isNaN(data.getTime())) return String(valor);
  const dia = data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return comHora
    ? `${dia} ${data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}`
    : dia;
}
function formatarMoeda(valor:unknown){const numero=Number(valor??0);return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number.isFinite(numero)?numero:0)}

function dataParaFiltro(valor: unknown = new Date()) {
  const data = valor instanceof Date ? valor : new Date(String(valor));
  if (Number.isNaN(data.getTime())) return "";
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(data);
  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((item) => item.type === tipo)?.value ?? "";
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}
function primeiroDiaMesParaFiltro(){return `${dataParaFiltro().slice(0,7)}-01`}
function dataDentroDoPeriodo(valor:unknown,filtros:{dataInicial:string;dataFinal:string}){
  const data=dataParaFiltro(valor);
  if(!data)return false;
  return (!filtros.dataInicial||data>=filtros.dataInicial)&&(!filtros.dataFinal||data<=filtros.dataFinal);
}

function mensagemIntegracaoSegura(valor: unknown) {
  const mensagem=String(valor??"");
  if(/IDPEDIDO_/i.test(mensagem))return "O campo técnico CARRINHO.IDPEDIDO_GM estava ausente. A aplicação fará a criação automática antes da nova validação.";
  return mensagem;
}

const menu: [MenuId, string, typeof LayoutDashboard][] = [
  ["dashboard", "Indicadores APIs", LayoutDashboard],
  ["clientes", "Empresas", Building2],
  ["conexoes", "Conexoes", Database],
  ["integracoes", "Integrações", PlugZap],
  ["apis", "APIs", FileCode2],
  ["editor", "Editor SQL", TerminalSquare],
  ["consumidores", "Consumidores", UserCog],
  ["tokens", "Tokens", KeyRound],
  ["usuarios", "Usuarios", UserCog],
  ["perfis", "Direitos de acesso", UserCog],
  ["logs", "Logs", Activity],
  ["dominios", "Dominios", Globe2],
  ["configuracoes", "Configuracoes", Settings],
];

const gruposMenu: Array<{
  id: string;
  titulo: string;
  icone: typeof LayoutDashboard;
  itens: MenuId[];
}> = [
  {
    id: "integracoes",
    titulo: "Integrações",
    icone: PlugZap,
    itens: ["integracoes"],
  },
  {
    id: "apis",
    titulo: "APIs",
    icone: FileCode2,
    itens: [
      "dashboard",
      "apis",
      "editor",
      "consumidores",
      "tokens",
      "dominios",
      "logs",
    ],
  },
  {
    id: "configuracoes",
    titulo: "Configurações",
    icone: Settings,
    itens: ["clientes", "conexoes", "usuarios", "perfis", "configuracoes"],
  },
];
const direitosAcoes = [
  ["integracao.visualizar", "Visualizar integrações"],
  ["integracao.configurar", "Acessar configurações da integração"],
  ["integracao.sincronizar", "Executar sincronização"],
  ["integracao.ver_token", "Visualizar token protegido"],
  ["integracao.resolver_alerta", "Resolver alertas"],
  ["integracao.excluir_pedido", "Excluir pedido coletado não integrado"],
  ["notificacao.configurar", "Configurar notificações por e-mail"],
  ["api.publicar", "Publicar APIs"],
  ["api.editar", "Editar APIs"],
  ["api.excluir", "Excluir APIs"],
  ["cadastro.editar", "Editar cadastros"],
  ["cadastro.excluir", "Excluir cadastros"],
];
const direitosAlertas = [
  ["falha_integracao", "Falhas da integração"],
  ["divergencia_contrato", "Divergências da documentação"],
  ["dados_incompletos", "Dados coletados incompletos"],
];

function primeiroModuloPermitido(
  usuario?: Pick<UsuarioLogado, "perfil" | "menusPermitidos"> | null,
): MenuId {
  const ordem = gruposMenu.flatMap((grupo) => grupo.itens);
  return (
    ordem.find(
      (id) =>
        (id!=="perfis" || usuario?.perfil === "admin") &&
        (id!=="logs" || usuario?.perfil === "admin" || !usuario?.menusPermitidos?.length || usuario.menusPermitidos.includes("dashboard")) &&
        (!usuario?.menusPermitidos?.length ||
          usuario.menusPermitidos.includes(id)),
    ) ?? "dashboard"
  );
}

const subtitulosPagina: Record<MenuId, string> = {
  dashboard: "Visao geral das APIs, conexoes, tokens e publicacoes.",
  clientes:
    "Cadastro das empresas donas das conexoes, APIs, dominios e consumidores.",
  conexoes: "Conexoes Oracle, SQL Server e Firebird utilizadas pelas APIs.",
  integracoes:
    "Conectores externos, sincronizacoes, dados recebidos e saude operacional.",
  apis: "Catalogo de endpoints corporativos publicados e em rascunho.",
  editor: "SQL, parametros, teste da consulta e inferencia de campos publicos.",
  consumidores:
    "Clientes que recebem token fixo para consumir as APIs publicadas.",
  tokens: "Tokens fixos por cliente para consumo seguro das APIs.",
  usuarios: "Usuarios do portal administrativo e perfis de acesso.",
  perfis:
    "Perfis que definem os menus disponíveis para cada grupo de usuários.",
  logs: "Monitoramento de chamadas, latencia, status HTTP e erros.",
  dominios: "URLs publicas, subdominios e enderecos de documentacao.",
  configuracoes: "Identidade visual da loja integrada no portal.",
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("controlSApiHubToken");
  const temBody = options?.body !== undefined && options.body !== null;
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...(temBody ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
    ...options,
  });
  const payload = await response.json();
  if (!response.ok || payload.sucesso === false) {
    const error = new Error(
      payload.erro?.mensagem ?? "Nao foi possivel concluir a operacao.",
    ) as ApiRequestError;
    error.codigo = payload.erro?.codigo;
    throw error;
  }
  return payload.dados ?? payload;
}

const identidadeControlS = {
  nome: "Control S",
  subtitulo: "API Hub",
  logoUrl: "/brand/logo-s-novo.jpg",
};
const identidadeLojaPadrao: Identidade = {
  nomeLoja: "Empresa",
  descricaoCurta: "Empresa integrada",
  logoUrl: "/brand/logo-s-novo.jpg",
};
const publicacaoPadrao: PublicacaoConfig = {
  ambiente: "local",
  dominioPrincipal: "localhost",
  subdominioApi: "localhost:3335",
  urlBaseApi: window.location.origin,
  urlBaseDocumentacao: `${window.location.origin}/swagger`,
};

function Logo({ compacto }: { compacto: boolean }) {
  return (
    <div className="logo">
      <img
        className="logoMark"
        src={identidadeControlS.logoUrl}
        alt={identidadeControlS.nome}
      />
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
      <img
        className="storeLogo"
        src={identidade.logoUrl}
        alt={identidade.nomeLoja}
      />
      <div>
        <span>{identidade.descricaoCurta || "Loja integrada"}</span>
        <strong>{identidade.nomeLoja}</strong>
      </div>
    </div>
  );
}

function arquivoParaDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new Error("Nao foi possivel ler o arquivo do logo."));
    reader.readAsDataURL(file);
  });
}

function normalizarBaseUrl(url = "") {
  return url.replace(/\/+$/, "");
}

function montarUrl(base: string, rota = "") {
  return `${normalizarBaseUrl(base)}${rota.startsWith("/") ? rota : `/${rota}`}`;
}

function isBasePublica(base = "") {
  return /^https?:\/\//i.test(base) && !/localhost|127\.0\.0\.1/i.test(base);
}

function urlsDocumentacaoApi(
  api: ApiCadastrada | undefined,
  publicacao: PublicacaoConfig,
) {
  const origemLocal = window.location.origin;
  const rota = api?.endpoint || "/v1/sua-api";
  const basePublica = isBasePublica(publicacao.urlBaseApi)
    ? publicacao.urlBaseApi
    : "";
  const docPublica = isBasePublica(publicacao.urlBaseDocumentacao)
    ? publicacao.urlBaseDocumentacao
    : basePublica
      ? `${normalizarBaseUrl(basePublica)}/swagger`
      : "";
  return {
    endpointLocal: montarUrl(origemLocal, rota),
    swaggerLocal: montarUrl(origemLocal, "/swagger"),
    openApiLocal: montarUrl(origemLocal, "/documentacao/openapi.json"),
    openApiApiLocal: api
      ? montarUrl(origemLocal, `/api/admin/apis/${api.id}/openapi.json`)
      : "",
    endpointPublico: basePublica ? montarUrl(basePublica, rota) : "",
    swaggerPublico: docPublica,
    openApiPublico: basePublica
      ? montarUrl(basePublica, "/documentacao/openapi.json")
      : "",
  };
}

function parametrosTestePadraoFrontend(api?: ApiCadastrada) {
  const parametros = api?.parametros ?? [];
  if (!parametros.length) return { pagina: 1, pageSize: 500 };
  return Object.fromEntries(
    parametros
      .map((parametro) => [
        String(parametro.nomePublico ?? parametro.nomeParametro ?? "parametro"),
        parametro.exemplo ?? parametro.valorPadrao ?? null,
      ])
      .concat([
        ["pagina", 1],
        ["pageSize", 500],
      ]),
  );
}

function aplicarApiNoEditor(api?: ApiCadastrada) {
  return {
    id: api?.id ?? "",
    sql: api?.sqlBase || sqlModelo,
    parametrosTeste: JSON.stringify(
      api?.apiSql?.parametrosTeste ?? parametrosTestePadraoFrontend(api),
      null,
      2,
    ),
    parametrosApi: JSON.stringify(api?.parametros ?? [], null, 2),
    regras: JSON.stringify(api?.regras ?? {}, null, 2),
  };
}

function MetricCard({
  titulo,
  valor,
  detalhe,
  onClick,
}: {
  titulo: string;
  valor: string | number;
  detalhe: string;
  onClick?: () => void;
}) {
  return (
    <article
      className={`metricCard ${onClick ? "clickable" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(event) => {
        if (onClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <span>{titulo}</span>
      <strong>{valor}</strong>
      <small>{detalhe}</small>
    </article>
  );
}

function Badge({ value }: { value: string | number }) {
  const texto = String(value);
  const ok = [
    "ativo",
    "ativa",
    "publicado",
    "200",
    "Ativo",
    "Ativa",
    "Publicado",
  ].includes(texto);
  const warn = ["400", "401", "inativa", "Inativa", "rascunho"].includes(texto);
  return (
    <span className={ok ? "badge ok" : warn ? "badge warn" : ""}>{texto}</span>
  );
}

function StatusBar({
  mensagem,
  erro,
  onClose,
}: {
  mensagem: string;
  erro: string;
  onClose: () => void;
}) {
  if (!mensagem && !erro) return null;
  return (
    <div className={erro ? "statusBar error" : "statusBar"}>
      <span>{erro || mensagem}</span>
      <button
        type="button"
        className="statusClose"
        onClick={onClose}
        aria-label="Fechar mensagem"
      >
        ×
      </button>
    </div>
  );
}

function Modal({
  titulo,
  subtitulo,
  onClose,
  children,
  tipo = "padrao",
}: {
  titulo: string;
  subtitulo?: string;
  onClose: () => void;
  children: ReactNode;
  tipo?: "padrao" | "sucesso" | "erro";
}) {
  return (
    <div
      className="modalBackdrop"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className={`modalCard ${tipo}`}>
        <div className="modalHeader">
          <div>
            <span className="eyebrow">
              {tipo === "sucesso"
                ? "Operacao concluida"
                : tipo === "erro"
                  ? "Atencao"
                  : "Detalhes"}
            </span>
            <h2>{titulo}</h2>
            {subtitulo && <p>{subtitulo}</p>}
          </div>
          <button
            type="button"
            className="modalClose"
            onClick={onClose}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
        <div className="modalBody">{children}</div>
      </section>
    </div>
  );
}

type VideoTreinamentoGmobii={nome:string;titulo:string;formato:string;mimeType:string;tamanhoBytes:number;atualizadoEm:string;reproducaoNativa:boolean;url:string};
function tamanhoArquivo(valor:number){if(valor<1024)return `${valor} B`;if(valor<1024*1024)return `${(valor/1024).toFixed(1)} KB`;if(valor<1024*1024*1024)return `${(valor/1024/1024).toFixed(1)} MB`;return `${(valor/1024/1024/1024).toFixed(2)} GB`}

function DocumentacaoGmobii() {
  const [documentacaoAtiva,setDocumentacaoAtiva]=useState<"api"|"hub">("api");
  const [bibliotecaVideosAberta,setBibliotecaVideosAberta]=useState(false);
  const [videosTreinamento,setVideosTreinamento]=useState<VideoTreinamentoGmobii[]>([]);
  const [videoSelecionado,setVideoSelecionado]=useState<VideoTreinamentoGmobii|null>(null);
  const [pastaVideos,setPastaVideos]=useState("C:\\Control S API Hub\\videos\\GMOBii");
  const [carregandoVideos,setCarregandoVideos]=useState(false);
  const [erroVideos,setErroVideos]=useState("");
  const [linkVideoCopiado,setLinkVideoCopiado]=useState(false);
  function enderecoAreaVideos(nomeVideo?:string){
    const url=new URL(window.location.href);
    url.searchParams.set("pagina","integracoes");
    url.searchParams.set("secao","documentacao");
    url.searchParams.set("videos","1");
    if(nomeVideo)url.searchParams.set("video",nomeVideo);else url.searchParams.delete("video");
    return url;
  }
  function atualizarEnderecoVideos(nomeVideo?:string){window.history.replaceState({},"",enderecoAreaVideos(nomeVideo))}
  function fecharBibliotecaVideos(){
    setBibliotecaVideosAberta(false);
    const url=new URL(window.location.href);
    url.searchParams.delete("videos");url.searchParams.delete("video");
    window.history.replaceState({},"",url);
  }
  async function copiarLinkVideo(){
    const link=enderecoAreaVideos(videoSelecionado?.nome).toString();
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(link);
      else{const campo=document.createElement("textarea");campo.value=link;campo.style.position="fixed";campo.style.opacity="0";document.body.appendChild(campo);campo.select();document.execCommand("copy");campo.remove()}
      setLinkVideoCopiado(true);window.setTimeout(()=>setLinkVideoCopiado(false),2500);
    }catch{window.prompt("Copie o link do treinamento:",link)}
  }
  async function abrirBibliotecaVideos(nomeVideo?:string){
    setBibliotecaVideosAberta(true);setCarregandoVideos(true);setErroVideos("");
    atualizarEnderecoVideos(nomeVideo);
    try{const retorno=await request<{pasta:string;videos:VideoTreinamentoGmobii[]}>("/documentacao/gmobii-videos");setPastaVideos(retorno.pasta);setVideosTreinamento(retorno.videos);setVideoSelecionado((atual)=>{const selecionado=retorno.videos.find((video)=>video.nome===(nomeVideo??atual?.nome))??retorno.videos[0]??null;if(selecionado)atualizarEnderecoVideos(selecionado.nome);return selecionado})}catch(error){setErroVideos(error instanceof Error?error.message:"Não foi possível carregar os vídeos.")}finally{setCarregandoVideos(false)}
  }
  useEffect(()=>{const parametros=new URLSearchParams(window.location.search);if(parametros.get("videos")==="1")void abrirBibliotecaVideos(parametros.get("video")??undefined)},[]);
  const servicos = [
    ["Corte", "1001", "30535", "deslocamento"],
    ["Fita de borda", "1002", "1002", "m"],
    ["Furação 01 a 08 mm", "44985", "44994", "furo"],
    ["Furação 09 a 20 mm", "44986", "44995", "furo"],
    ["Furação 21 a 35 mm", "44984", "44993", "furo"],
    ["Pintura Lacca", "44988", "44997", "m2"],
    ["Puxador Cava", "44987", "44996", "un"],
    ["Tamponamento", "44990", "44999", "un"],
    ["Canal LED", "44989", "44998", "m"],
    ["Provençal", "44991", "45000", "peça"],
    ["Router", "41509", "41509", "peça"],
    ["MDF Flex", "43666", "43666", "peça"],
  ];
  return (
    <section className="documentationHub">
      <div className="documentationCover">
        <div>
          <span className="eyebrow">Documento integral de referência</span>
          <h2>{documentacaoAtiva==="api"?"GMOBii · API de pedidos em produção":"Control S API Hub · Integração GMOBii e Construshow"}</h2>
          <p>{documentacaoAtiva==="api"?"Contrato da API · Coleta 1.2 · Cancelamento 1.4 · Aprovação 1.6":"Guia operacional e técnico da implementação no Control S"}</p>
        </div>
        <div className="documentationActions">
          <Badge value="Contratos 1.2, 1.4 e 1.6" />
          <button className="videoLibraryButton" type="button" onClick={()=>void abrirBibliotecaVideos()}>
            <Video size={16}/> Vídeos
          </button>
          <button
            type="button"
            onClick={() =>
              window.open(
                "/documentacao/gmobii-original.pdf",
                "_blank",
                "noopener,noreferrer",
              )
            }
          >
            Coleta original
          </button>
          <button
            type="button"
            onClick={() =>
              window.open(
                "/documentacao/gmobii-cancelamento-original.pdf",
                "_blank",
                "noopener,noreferrer",
              )
            }
          >
            Cancelamento original
          </button>
          <button
            className="primary"
            type="button"
            onClick={() =>
              window.open(
                "/documentacao/gmobii-aprovacao-original.pdf",
                "_blank",
                "noopener,noreferrer",
              )
            }
          >
            Aprovação original
          </button>
        </div>
      </div>
      {bibliotecaVideosAberta&&<Modal titulo="Vídeos de treinamento GMOBii" subtitulo="Selecione um treinamento para assistir diretamente no servidor." onClose={fecharBibliotecaVideos}>
        <div className="trainingVideoLibrary">
          <div className="trainingVideoList">
            <div className="trainingVideoListHeader"><strong>Vídeos disponíveis</strong><button type="button" onClick={()=>void abrirBibliotecaVideos(videoSelecionado?.nome)} disabled={carregandoVideos}><RefreshCw size={14}/> Atualizar</button></div>
            {carregandoVideos?<div className="emptyState">Buscando vídeos...</div>:erroVideos?<div className="statusBar error"><span>{erroVideos}</span></div>:videosTreinamento.length?videosTreinamento.map((video)=><button type="button" key={video.nome} className={`trainingVideoItem ${videoSelecionado?.nome===video.nome?"selected":""}`} onClick={()=>{setVideoSelecionado(video);atualizarEnderecoVideos(video.nome);setLinkVideoCopiado(false)}}><Video size={18}/><span><strong>{video.titulo}</strong><small>{video.formato} · {tamanhoArquivo(video.tamanhoBytes)}</small></span></button>):<div className="emptyState"><strong>Nenhum vídeo encontrado.</strong><span>Copie os arquivos para:<br/><code>{pastaVideos}</code></span></div>}
          </div>
          <div className="trainingVideoPlayer">
            {videoSelecionado?<><div className="trainingVideoTitle"><div><span className="eyebrow">Treinamento GMOBii</span><h3>{videoSelecionado.titulo}</h3><p>{videoSelecionado.nome} · {tamanhoArquivo(videoSelecionado.tamanhoBytes)}</p></div><div className="actions"><button type="button" onClick={copiarLinkVideo}><Link2 size={14}/>{linkVideoCopiado?"Link copiado":"Copiar link"}</button><a className="buttonLink" href={videoSelecionado.url} target="_blank" rel="noreferrer">Abrir arquivo</a></div></div><video key={videoSelecionado.url} controls preload="metadata" src={videoSelecionado.url}><source src={videoSelecionado.url} type={videoSelecionado.mimeType}/>Seu navegador não conseguiu reproduzir este formato.</video>{!videoSelecionado.reproducaoNativa&&<p className="videoCompatibilityNote">Este formato pode depender dos codecs instalados no navegador. Se não reproduzir, use “Abrir arquivo”. Para máxima compatibilidade, prefira MP4 com vídeo H.264 e áudio AAC.</p>}</>:<div className="emptyState">Selecione um vídeo para iniciar.</div>}
          </div>
        </div>
        <p className="videoFolderPath"><strong>Pasta monitorada:</strong> <code>{pastaVideos}</code></p>
      </Modal>}
      <div className="documentationTabs" role="tablist" aria-label="Tipo de documentação">
        <button type="button" role="tab" aria-selected={documentacaoAtiva==="api"} className={documentacaoAtiva==="api"?"active":""} onClick={()=>setDocumentacaoAtiva("api")}><FileCode2 size={17}/><span><strong>API GMOBii</strong><small>Contrato, endpoints e exemplos</small></span></button>
        <button type="button" role="tab" aria-selected={documentacaoAtiva==="hub"} className={documentacaoAtiva==="hub"?"active":""} onClick={()=>setDocumentacaoAtiva("hub")}><Settings size={17}/><span><strong>Control S API Hub</strong><small>Implementação, operação e manutenção</small></span></button>
      </div>
      <div className={`docSections ${documentacaoAtiva==="api"?"showApiDocumentation":"showHubDocumentation"}`}>
        <article className="panel docFull apiDocumentation">
          <h2>1. Como a API funciona</h2>
          <p>
            API somente leitura. Todas as chamadas usam GET e retornam JSON em
            UTF-8. O integrador consulta quando necessário; a GMOBii não envia
            notificações. O pedido aparece após autorização para produção e
            representa aquele momento, mesmo se editado depois. Datas seguem ISO
            8601 UTC e valores monetários são BRL.
          </p>
        </article>
        <article className="panel apiDocumentation">
          <h2>2. Endereço e autenticação</h2>
          <pre>
            GET https://api.gmobii.com.br/functions/v1/production-orders{`\n`}
            Authorization: Bearer &lt;CHAVE_API&gt;{`\n`}ou x-api-key:
            &lt;CHAVE_API&gt;
          </pre>
          <p>
            A chave começa com <strong>gmb_</strong>, pertence à empresa e deve
            permanecer no servidor, em cofre ou variável de ambiente. Não deve
            aparecer em páginas, aplicativos, repositórios ou logs.
          </p>
        </article>
        <article className="panel apiDocumentation">
          <h2>3. Consultas disponíveis</h2>
          <p>
            <strong>Listar:</strong> ?desde=&lt;data&gt;&amp;limite=&lt;n&gt;.{" "}
            <strong>Pedido:</strong> ?numero=&lt;número&gt;. O limite padrão é
            50, aceita 1 a 200. A ordenação é do mais antigo ao mais novo. A
            resposta contém pedidos, total e proximo_desde.
          </p>
        </article>
        <article className="panel docFull apiDocumentation">
          <h2>4. Sincronização sem duplicidade</h2>
          <p>
            Consultar em lotes até receber menos registros que o limite.
            Processar por numero_pedido. Guardar proximo_desde somente após
            sucesso. Como desde usa comparação estrita, aplicar pequena
            sobreposição de tempo e descartar números já processados. Se a
            sobreposição puder ultrapassar 200 registros, deve-se alinhar outra
            estratégia com a GMOBii.
          </p>
        </article>
        <article className="panel docFull apiDocumentation">
          <h2>5. Estrutura do pedido</h2>
          <div className="contractGrid">
            {[
              "numero_pedido · texto obrigatório",
              "cliente · texto ou null",
              "cliente_documento · CPF/CNPJ obrigatório",
              "vendedor · texto ou null",
              "vendedor_documento · CPF obrigatório",
              "empresa · texto ou null",
              "empresa_documento · CNPJ obrigatório",
              "tipo_servico · texto ou null",
              "data_criacao · ISO 8601 obrigatório",
              "data_envio_producao · ISO 8601 ou null",
              "observacoes · texto ou null",
              "chapas_total · inteiro ou null",
              "deslocamentos · inteiro ou null",
              "fita_borda_m · inteiro ou null",
              "itens · lista obrigatória",
            ].map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <p>
            Requisitos adicionais do Control S: os documentos do cliente,
            vendedor e empresa devem estar preenchidos; os respectivos nomes
            são opcionais. Em cada item, codigo e quantidade são obrigatórios.
            Descrição e unidade são opcionais. Se o valor não vier ou vier
            zerado, o Control S consulta o preço no Construshow. Modalidades: normal,
            imediato, especial, especial-imediato e tiras_full.
          </p>
        </article>
        <article className="panel docFull apiDocumentation">
          <h2>6. Itens, códigos e valores</h2>
          <p>
            Cada item contém codigo, descricao, quantidade, unidade e valor.
            Unidades previstas: chapa, m, furo, m2, un, peca e deslocamento. O
            código e quantidade precisam estar preenchidos para permitir a
            integração. O valor recebido segue a regra atual da GMOBii. Quando
            estiver ausente ou zerado, a integração busca o preço unitário no
            Construshow e calcula o total pela quantidade. Descrição e unidade
            permanecem informativas e podem não ser fornecidas.
          </p>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Serviço</th>
                  <th>Normal</th>
                  <th>Imediato</th>
                  <th>Unidade</th>
                </tr>
              </thead>
              <tbody>
                {servicos.map((s) => (
                  <tr key={s[0]}>
                    {s.map((v) => (
                      <td key={v}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Chapas aparecem por cor/espessura; rolos de fita em metros;
            ferragens podem aparecer sem código individual. Canal LED, MDF Flex
            e Provençal podem ter valor null por estarem incluídos em outras
            linhas. Canal Gaveta 44992/45001 é reservado e não enviado.
          </p>
        </article>
        <article className="panel apiDocumentation">
          <h2>7. Respostas de erro</h2>
          <p>
            <strong>400 bad_request:</strong> data inválida.
            <br />
            <strong>401 unauthorized:</strong> chave ausente, inválida ou
            revogada.
            <br />
            <strong>404 not_found:</strong> pedido inexistente ou fora da
            produção.
            <br />
            <strong>405 method_not_allowed:</strong> método diferente de GET.
            <br />
            <strong>500 internal_error:</strong> falha temporária.
          </p>
        </article>
        <article className="panel docFull apiDocumentation">
          <h2>8. Exemplo de resposta</h2>
          <p>
            Dados fictícios da documentação, acrescidos dos documentos
            obrigatórios adotados pelo Control S.
          </p>
          <pre>
            {JSON.stringify(
              {
                pedidos: [
                  {
                    numero_pedido: "10000001",
                    cliente: "Cliente Exemplo",
                    cliente_documento: "12345678901",
                    vendedor: "Equipe Exemplo",
                    vendedor_documento: "98765432100",
                    empresa: "Revenda Exemplo",
                    empresa_documento: "12345678000190",
                    tipo_servico: "normal",
                    data_criacao: "2026-09-10T13:22:41.000Z",
                    data_envio_producao: "2026-09-10T14:05:12.517Z",
                    observacoes: null,
                    chapas_total: 1,
                    deslocamentos: 9,
                    fita_borda_m: 8,
                    itens: [
                      {
                        codigo: "CH-EX",
                        descricao: "MDF 15 mm",
                        quantidade: 1,
                        unidade: "chapa",
                        valor: 270,
                      },
                    ],
                  },
                ],
                total: 1,
                proximo_desde: "2026-09-10T14:05:12.517Z",
              },
              null,
              2,
            )}
          </pre>
        </article>
        <article className="panel docFull apiDocumentation">
          <h2>9. Compatibilidade e suporte</h2>
          <p>
            Desde a versão 1.2, chapas e rolos de fita aparecem em itens junto
            aos serviços. Pedidos autorizados antes dessa versão podem trazer
            apenas serviços. Os totais chapas_total e fita_borda_m continuam
            disponíveis quando enviados. Novos campos podem ser acrescentados e
            devem ser ignorados por consumidores antigos; o Control S os
            preserva no JSON original.
          </p>
        </article>
        <article className="panel docFull apiDocumentation">
          <h2>10. Devolver e excluir pedidos · versão 1.4</h2>
          <p>
            As ações utilizam <strong>POST</strong> no mesmo endereço da
            consulta, com a mesma chave da GMOBii. O monitoramento automático
            do Control S utiliza a exclusão quando o carrinho correspondente
            estiver com <code>SITUACAO = E</code> no ViaSoft.
          </p>
          <pre>{`POST https://api.gmobii.com.br/functions/v1/production-orders
x-api-key: gmb_xxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "acao": "excluir",
  "numero": "10000001",
  "motivo": "CANC"
}`}</pre>
          <p>
            Resposta 200 com situação <code>excluido</code> confirma o processo.
            Em uma repetição após timeout, 404 é considerado concluído. A
            resposta 409 indica pedido em produção, produzido ou alterado
            durante a operação; nesse caso o Control S interrompe as tentativas
            automáticas e cria um alerta crítico.
          </p>
          <p>
            A ação é definida em Configuração Construshow: <code>excluir</code>
            é o padrão; <code>devolver</code> libera o pedido para edição e
            mantém o mesmo número no reenvio. Em ambos os casos, o motivo
            enviado é CANC.
          </p>
        </article>
        <article className="panel docFull apiDocumentation">
          <h2>11. Aprovar pedido para produção · versão 1.6</h2>
          <p>
            Após a nota vinculada ao carrinho passar pelo caixa no Construshow,
            o Control S envia <strong>POST</strong> ao mesmo endpoint com a ação
            <code> produzir</code>. O número do pedido é obrigatório. Carrinho e
            nota são enviados como texto e ficam registrados na produção da
            GMOBii exatamente como informados.
          </p>
          <pre>{`POST https://api.gmobii.com.br/functions/v1/production-orders
x-api-key: gmb_xxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "acao": "produzir",
  "numero": "10000001",
  "numero_carrinho": "458213",
  "numero_nota": "000123456"
}`}</pre>
          <p>
            O Control S considera a aprovação concluída somente com HTTP 200 e
            <code> situacao: "em_producao"</code>. A chamada é idempotente:
            pode ser repetida após timeout ou erro 500. Campos ausentes, nulos
            ou vazios não apagam valores já registrados; um novo valor
            substitui o anterior.
          </p>
          <div className="contractGrid">
            <span>400 · corpo ou ação inválida</span>
            <span>401 · chave inválida ou revogada</span>
            <span>404 · pedido não encontrado</span>
            <span>409 · conflito de situação do pedido</span>
            <span>500 · falha temporária; tentar novamente</span>
            <span>200 + em_producao · aprovação confirmada</span>
          </div>
        </article>
        <article className="panel docFull hubDocumentation">
          <h2>1. Visão geral da implementação</h2>
          <p>
            O Control S API Hub consulta a GMOBii, preserva o JSON completo no
            PostgreSQL, confere o contrato, executa o De → Para no Oracle e cria
            o carrinho no Construshow em uma transação única. O pedido somente
            é gravado quando todos os campos e cadastros obrigatórios estiverem
            aptos. Reprocessamentos são idempotentes pelo número do pedido. Se
            um pedido já retornado ou excluído na GMOBii for recebido novamente
            após o cancelamento,
            a aplicação cria um novo carrinho e mantém o cancelado somente no
            histórico.
          </p>
          <div className="contractGrid">
            <span>1 · Coleta GMOBii</span><span>2 · Auditoria do JSON</span>
            <span>3 · Validação no ERP</span><span>4 · Carrinho transacional</span>
            <span>5 · Cancelamento/devolução</span><span>6 · Aprovação após caixa</span>
          </div>
        </article>
        <article className="panel docFull hubDocumentation">
          <h2>2. Dados, telas e operação</h2>
          <p>
            Dados coletados reúne a fila recebida, filtros, alertas do pedido,
            códigos ERP e o JSON integral. O número abre a conferência única.
            Dados integrados apresenta pedido, cliente, estabelecimento,
            carrinho, nota, caixa, situação e última tentativa. As duas grades
            permitem ordenar, redimensionar, mover e ocultar colunas.
            Em Dados integrados, o número do carrinho abre a consulta atual do
            Construshow com cabeçalho, cliente, vendedor, observações, itens,
            valores, previsão de entrega e totais.
            A situação informa o código e a descrição em português, como
            A - Aberto, E - Cancelado e F - Finalizado, além de indicar se o
            carrinho foi excluído ou retornado na GMOBii; todas essas situações
            podem ser utilizadas no filtro. O status abre o histórico
            completo dos eventos vinculados ao pedido, incluindo os dados
            enviados à API e as respostas recebidas. Esse histórico também
            mostra os carrinhos anteriores cancelados e qual ação foi realizada
            na GMOBii; somente o carrinho mais recente permanece vigente.
          </p>
          <p>
            A ação manual “Enviar para integração” repete a conferência e o De
            → Para antes de gravar. “Integrar pendentes” e “Tentar novamente”
            seguem a mesma regra. Um pedido com campo obrigatório ausente,
            produto não encontrado ou cadastro inválido nunca é parcialmente
            inserido.
          </p>
        </article>
        <article className="panel hubDocumentation">
          <h2>3. Configuração Construshow</h2>
          <p>
            Selecione a conexão Oracle, filial, estabelecimento dos produtos,
            estabelecimento e configuração do documento, cliente/vendedor
            padrão, validade do carrinho e dias para previsão de entrega. As
            listas são consultadas diretamente na base para reduzir configurações
            inválidas. A previsão possui padrão de 4 dias. A integração
            automática pode ser ativada com um intervalo próprio; em cada ciclo,
            todos os pedidos são validados novamente antes da criação do carrinho.
            A coleta planejada da conexão GMOBii está configurada para ocorrer a
            cada 2 minutos.
          </p>
        </article>
        <article className="panel hubDocumentation">
          <h2>4. Segurança e direitos</h2>
          <p>
            O token GMOBii e a senha Oracle não retornam abertos para o portal.
            Perfis definem acesso aos menus e ações, incluindo integração,
            visualização do token, resolução de alertas e exclusão. O modo de
            exclusão lógica ou definitiva é geral da Conf. Construshow.
          </p>
          <p>
            A permissão <strong>Acessar configurações da integração</strong>
            controla a exibição de Conexão GMOBii e Conf. Construshow. Sem acesso
            aos Indicadores APIs, o menu Logs de APIs também não é apresentado.
            Usuários não administradores autorizados a manter usuários podem
            cadastrar e editar contas comuns, mas não podem selecionar o perfil
            Administrador, o grupo Admin ou excluir contas; nesses casos somente
            a inativação fica disponível.
          </p>
        </article>
        <article className="panel docFull hubDocumentation">
          <h2>5. Automação Construshow → GMOBii</h2>
          <p>
            Para aprovação, o monitor relaciona NOTA e NOTACARRINHO pelo
            estabelecimento e número da nota. Quando MOSTRACAIXA for diferente
            de 1, considera PASSOUCAIXA = S e envia pedido, carrinho e nota à
            GMOBii. Para cancelamento, monitora CARRINHO.SITUACAO = E e executa
            a ação configurada. Cada operação mantém controle próprio de
            tentativas, resposta HTTP, conteúdo recebido, datas, logs e alertas
            críticos, evitando duplicidade mesmo após reinício do serviço.
          </p>
          <pre>{`SELECT NC.ESTAB, NC.IDNOTA, NC.IDCARRINHO,
       CASE WHEN N.MOSTRACAIXA <> 1 THEN 'S' ELSE 'N' END PASSOUCAIXA
FROM NOTA N
INNER JOIN NOTACARRINHO NC
        ON NC.ESTAB = N.ESTAB
       AND NC.IDNOTA = N.IDNOTA
WHERE NC.ESTAB = :estab
  AND NC.IDCARRINHO = :idCarrinho`}</pre>
        </article>
        <article className="panel docFull hubDocumentation">
          <h2>6. Estrutura Oracle e rastreabilidade</h2>
          <p>
            A criação do carrinho é transacional: cliente, vendedor, empresa,
            configuração do documento e todos os produtos são validados antes
            da primeira gravação. O cliente precisa estar marcado como
            PESSOADOCMCP.EHCLIENTE = S e o vendedor como
            PESSOADOC.EHREPRESENTANTE = S. Se um produto não existir, o pedido
            inteiro é bloqueado sem cabeçalho ou itens parciais.
          </p>
          <p>
            Os campos exclusivos da integração são CARRINHO.IDPEDIDO_GM,
            TOTDESCONTO_GM, TOTTAXAFRETE_GM e TOTAL_GM. A aplicação verifica e
            cria automaticamente os campos ausentes. Colunas com sufixo _MP
            não são utilizadas no fluxo GMOBii.
          </p>
          <p>
            A previsão de entrega dos itens nunca é gravada vazia. Ela é
            calculada pela data de criação do pedido somada aos dias definidos
            na Conf. Construshow, com padrão de 4 dias. O horário da criação é
            preservado. Essa regra atende à validação da tela de carrinho do
            ViaSoft sem tornar data_envio_producao obrigatória.
          </p>
          <p>
            O valor recebido da GMOBii mantém o tratamento original. Somente
            quando ele estiver ausente ou zerado, a integração consulta o preço
            unitário pela RETORNAITEMPRECO na filial configurada. Nesse fallback,
            o total do item é calculado pelo preço consultado multiplicado pela
            quantidade. A falta de valor na GMOBii não bloqueia o pedido.
          </p>
        </article>
        <article className="panel docFull hubDocumentation">
          <h2>7. Conferência, exclusão, logs e notificações</h2>
          <p>
            Dados coletados exibem a conferência documental e o De → Para do
            ERP antes da integração. Pedidos com campo obrigatório ausente ou
            cadastro obrigatório não localizado ficam bloqueados. Uma nova
            tentativa sempre repete as validações.
          </p>
          <p>
            A exclusão de dados coletados pode ser lógica ou definitiva,
            conforme a regra geral da Conf. Construshow. Na lógica, o pedido
            permanece auditável, aparece em vermelho pelo filtro Excluídos e
            não participa da integração. Falhas de integração podem gerar
            e-mail imediato e resumo periódico agrupado, conforme os
            destinatários configurados.
          </p>
          <p>
            Para informar mais de um destinatário, os e-mails são separados por
            ponto e vírgula. O envio utiliza a identidade visual instalada no
            servidor e continua funcionando mesmo se a imagem não estiver
            disponível. Alertas iguais permanecem consolidados para evitar
            notificações repetidas, e pendências de itens identificam o código e
            a descrição do produto afetado.
          </p>
          <p>
            Cada coleta, validação, tentativa, adequação estrutural, erro,
            exclusão, cancelamento e aprovação gera log com pedido, etapa,
            usuário e detalhes técnicos. O modal do pedido e o e-mail usam a
            mesma conferência para evitar diagnósticos divergentes.
          </p>
        </article>
        <article className="panel docFull hubDocumentation">
          <h2>8. Vídeos de treinamento</h2>
          <p>
            Estão disponíveis vídeos de treinamento para auxiliar no uso da
            integração GMOBii. Clique no botão <strong>Vídeos</strong>, no topo
            desta página, para escolher e assistir ao conteúdo desejado.
          </p>
        </article>
      </div>
    </section>
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
  const [autenticado, setAutenticado] = useState(
    Boolean(localStorage.getItem("controlSApiHubToken")),
  );
  const [usuarioLogado, setUsuarioLogado] = useState<UsuarioLogado | null>(
    () => {
      const bruto = localStorage.getItem("controlSApiHubUser");
      return bruto ? (JSON.parse(bruto) as UsuarioLogado) : null;
    },
  );
  const [compacto, setCompacto] = useState(false);
  const [gruposAbertos, setGruposAbertos] = useState<string[]>([
    "integracoes",
    "apis",
    "configuracoes",
  ]);
  const [secaoIntegracao, setSecaoIntegracao] = useState<
    | "indicadores"
    | "conexao"
    | "construshow"
    | "integrados"
    | "dados"
    | "historico"
    | "logs"
    | "documentacao"
  >(()=>new URLSearchParams(window.location.search).get("videos")==="1"?"documentacao":"dados");
  const [pagina, setPagina] = useState<MenuId>(() => {
    if(new URLSearchParams(window.location.search).get("videos")==="1")return "integracoes";
    const bruto = localStorage.getItem("controlSApiHubUser");
    return primeiroModuloPermitido(
      bruto ? (JSON.parse(bruto) as UsuarioLogado) : null,
    );
  });
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [conexoes, setConexoes] = useState<Conexao[]>([]);
  const [apis, setApis] = useState<ApiCadastrada[]>([]);
  const [logs, setLogs] = useState<LogChamada[]>([]);
  const [integracoes, setIntegracoes] = useState<Integracao[]>([]);
  const [execucoesIntegracao, setExecucoesIntegracao] = useState<
    ExecucaoIntegracao[]
  >([]);
  const [logsIntegracao, setLogsIntegracao] = useState<LogIntegracao[]>([]);
  const [alertasIntegracao, setAlertasIntegracao] = useState<
    AlertaIntegracao[]
  >([]);
  const [dadosIntegracao, setDadosIntegracao] = useState<DadoIntegracao[]>([]);
  const [paginaDadosIntegracao, setPaginaDadosIntegracao] = useState(1);
  const [metaDadosIntegracao, setMetaDadosIntegracao] = useState({
    pagina: 1,
    totalPaginas: 1,
    totalRegistros: 0,
    quantidadePorPagina: 20,
  });
  const [totalRegistrosLocais,setTotalRegistrosLocais]=useState(0);
  const [dadosRegistrosIndicadores,setDadosRegistrosIndicadores]=useState<DadoIntegracao[]>([]);
  const [filtrosIndicadores,setFiltrosIndicadores]=useState({dataInicial:primeiroDiaMesParaFiltro(),dataFinal:dataParaFiltro()});
  const [filtrosIntegracao, setFiltrosIntegracao] = useState({
    busca: "",
    tipoServico: "",
    somenteAlertas: "",
    situacaoExclusao: "ativos",
    dataInicial: dataParaFiltro(),
    dataFinal: dataParaFiltro(),
  });
  const [dadoJsonSelecionado, setDadoJsonSelecionado] =
    useState<DadoIntegracao | null>(null);
  const [logIntegracaoSelecionado, setLogIntegracaoSelecionado] =
    useState<LogIntegracao | null>(null);
  const [configurandoGrade, setConfigurandoGrade] = useState(false);
  const [colunasVisiveis, setColunasVisiveis] = useState<
    Record<string, boolean>
  >(() => Object.fromEntries(colunasPedido.map(([id]) => [id, true])));
  const [largurasColunas, setLargurasColunas] = useState<
    Record<string, number>
  >(() =>
    Object.fromEntries(colunasPedido.map(([id, , largura]) => [id, largura])),
  );
  const [ordemColunas, setOrdemColunas] = useState<string[]>(() => {
    try {
      const salva = JSON.parse(localStorage.getItem("controlS.gmobii.ordemColunas") ?? "[]") as string[];
      const validas = salva.filter((id) => colunasPedido.some(([coluna]) => coluna === id));
      return [...validas, ...colunasPedido.map(([id]) => id).filter((id) => !validas.includes(id))];
    } catch {
      return colunasPedido.map(([id]) => id);
    }
  });
  const [colunaArrastada, setColunaArrastada] = useState<string | null>(null);
  const [ordenacaoGrade, setOrdenacaoGrade] = useState<{
    campo: string;
    direcao: "asc" | "desc";
  }>({ campo: "data_envio_producao", direcao: "desc" });
  const [processandoIntegracao, setProcessandoIntegracao] = useState("");
  const [confirmarIntegracaoForcada, setConfirmarIntegracaoForcada] =
    useState(false);
  const [tokenGmobiiVisivel, setTokenGmobiiVisivel] = useState("");
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [perfisAcesso, setPerfisAcesso] = useState<PerfilAcesso[]>([]);
  const [perfilEditando, setPerfilEditando] = useState<PerfilAcesso | null>(
    null,
  );
  const [abaPerfil, setAbaPerfil] = useState<"menus" | "acoes" | "alertas">(
    "menus",
  );
  const [modalAlertas, setModalAlertas] = useState(false);
  const [alertaSelecionado, setAlertaSelecionado] =
    useState<AlertaIntegracao | null>(null);
  const [filtroAuditoria, setFiltroAuditoria] = useState<string | null>(null);
  const [indicadorSelecionado, setIndicadorSelecionado] = useState<
    "ultimoSucesso" | "execucoes" | "alertas" | "registros" | "statusIntegrados" | null
  >(null);
  const [situacaoDashboardSelecionada,setSituacaoDashboardSelecionada]=useState("");
  const [configuracaoConstrushow, setConfiguracaoConstrushow] =
    useState<ConfiguracaoConstrushow | null>(()=>lerRascunhoConstrushow());
  const [conexoesOracle, setConexoesOracle] = useState<Conexao[]>([]);
  const [opcoesFilial, setOpcoesFilial] = useState<OpcaoConstrushow[]>([]);
  const [opcoesFilialProduto, setOpcoesFilialProduto] = useState<
    OpcaoConstrushow[]
  >([]);
  const [opcoesFilialNota, setOpcoesFilialNota] = useState<OpcaoConstrushow[]>(
    [],
  );
  const [opcoesNota, setOpcoesNota] = useState<OpcaoConstrushow[]>([]);
  const [opcoesCliente, setOpcoesCliente] = useState<OpcaoConstrushow[]>([]);
  const [opcoesVendedor, setOpcoesVendedor] = useState<OpcaoConstrushow[]>([]);
  const [carregandoConstrushow, setCarregandoConstrushow] = useState("");
  const [dadosIntegradosConstrushow, setDadosIntegradosConstrushow] = useState<
    DadoIntegradoConstrushow[]
  >([]);
  const [filtrosDadosIntegrados,setFiltrosDadosIntegrados]=useState({
    busca:"",
    status:"",
    caixa:"",
    dataInicial:dataParaFiltro(),
    dataFinal:dataParaFiltro(),
  });
  const [configurandoGradeIntegrados,setConfigurandoGradeIntegrados]=useState(false);
  const [colunasVisiveisIntegrados,setColunasVisiveisIntegrados]=useState<Record<string,boolean>>(()=>{try{return {...Object.fromEntries(colunasIntegrados.map(([id])=>[id,true])),...JSON.parse(localStorage.getItem("controlS.gmobii.integrados.colunasVisiveis")??"{}")}}catch{return Object.fromEntries(colunasIntegrados.map(([id])=>[id,true]))}});
  const [largurasIntegrados,setLargurasIntegrados]=useState<Record<string,number>>(()=>{try{return {...Object.fromEntries(colunasIntegrados.map(([id,,largura])=>[id,largura])),...JSON.parse(localStorage.getItem("controlS.gmobii.integrados.larguras")??"{}")}}catch{return Object.fromEntries(colunasIntegrados.map(([id,,largura])=>[id,largura]))}});
  const [ordemIntegrados,setOrdemIntegrados]=useState<string[]>(()=>{try{const salva=JSON.parse(localStorage.getItem("controlS.gmobii.integrados.ordem")??"[]") as string[];const validas=salva.filter(id=>colunasIntegrados.some(([coluna])=>coluna===id));return [...validas,...colunasIntegrados.map(([id])=>id).filter(id=>!validas.includes(id))]}catch{return colunasIntegrados.map(([id])=>id)}});
  const [colunaIntegradosArrastada,setColunaIntegradosArrastada]=useState<string|null>(null);
  const [ordenacaoIntegrados,setOrdenacaoIntegrados]=useState<{campo:string;direcao:"asc"|"desc"}>({campo:"tentativa",direcao:"desc"});
  const [integracaoPedidoSelecionado, setIntegracaoPedidoSelecionado] =
    useState<DadoIntegradoConstrushow | null>(null);
  const [carrinhoSelecionado,setCarrinhoSelecionado]=useState<DetalheCarrinhoConstrushow|null>(null);
  const [carregandoCarrinho,setCarregandoCarrinho]=useState("");
  const [logPedidoSelecionado,setLogPedidoSelecionado]=useState<DadoIntegradoConstrushow|null>(null);
  const [integradoParaReprocessar, setIntegradoParaReprocessar] =
    useState<DadoIntegradoConstrushow | null>(null);
  const [integradoParaExcluir, setIntegradoParaExcluir] =
    useState<DadoIntegradoConstrushow | null>(null);
  const [pedidoParaIntegrar, setPedidoParaIntegrar] =
    useState<DadoIntegracao | null>(null);
  const [pedidoParaExcluir, setPedidoParaExcluir] =
    useState<DadoIntegracao | null>(null);
  const [tokens, setTokens] = useState<TokenAcesso[]>([]);
  const [clientesConsumidores, setClientesConsumidores] = useState<
    ClienteConsumidor[]
  >([]);
  const [identidadeLoja, setIdentidadeLoja] = useState<Identidade>(() => {
    const bruto = localStorage.getItem("controlSApiHubBrand");
    return bruto ? (JSON.parse(bruto) as Identidade) : identidadeLojaPadrao;
  });
  const [identidadeForm, setIdentidadeForm] = useState<Identidade>(() => {
    const bruto = localStorage.getItem("controlSApiHubBrand");
    return bruto ? (JSON.parse(bruto) as Identidade) : identidadeLojaPadrao;
  });
  const [configuracaoNotificacao,setConfiguracaoNotificacao]=useState<ConfiguracaoNotificacaoEmail>({ativo:false,inicio:"08:00",fim:"18:00",intervaloMinutos:60,remetente:"notificacao@controlsone.com.br",tipos:{integracao_critica:{ativo:true,envioImediato:true,repetirEnquantoAberto:true,destinatarios:[]},erro_api:{ativo:false,envioImediato:true,repetirEnquantoAberto:false,destinatarios:[]}}});
  const [publicacao, setPublicacao] =
    useState<PublicacaoConfig>(publicacaoPadrao);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [emailPrimeiroAcesso, setEmailPrimeiroAcesso] = useState("");
  const [modoAlterarSenha, setModoAlterarSenha] = useState(false);
  const [apiSelecionadaId, setApiSelecionadaId] = useState("");
  const [sqlAtual, setSqlAtual] = useState(sqlModelo);
  const [parametrosTeste, setParametrosTeste] = useState(
    '{\n  "documentoParceiro": "12345678000190"\n}',
  );
  const [resultadoTeste, setResultadoTeste] = useState("");
  const [testandoConexaoId, setTestandoConexaoId] = useState("");
  const [parametrosApiJson, setParametrosApiJson] = useState("[]");
  const [regrasApiJson, setRegrasApiJson] = useState("{}");
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [conexaoEditando, setConexaoEditando] = useState<Conexao | null>(null);
  const [apiEditando, setApiEditando] = useState<ApiCadastrada | null>(null);
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null);
  const [tokenEditando, setTokenEditando] = useState<TokenAcesso | null>(null);
  const [consumidorEditando, setConsumidorEditando] =
    useState<ClienteConsumidor | null>(null);
  const [modalCadastro, setModalCadastro] = useState<MenuId | null>(null);
  const [empresasParaLogin, setEmpresasParaLogin] = useState<EmpresaLogin[]>(
    [],
  );
  const [loginPendente, setLoginPendente] = useState<{
    email: string;
    senha: string;
  } | null>(null);
  const titulo = useMemo(
    () => menu.find(([id]) => id === pagina)?.[1] ?? "Dashboard",
    [pagina],
  );
  const apiSelecionada =
    apis.find((api) => api.id === apiSelecionadaId) ?? apis[0];
  const urlsApiSelecionada = urlsDocumentacaoApi(apiSelecionada, publicacao);
  const isAdmin = usuarioLogado?.perfil === "admin";
  const podeGerenciarUsuarios=Boolean(isAdmin||usuarioLogado?.menusPermitidos?.includes("usuarios"));
  const podeExcluirPedido = Boolean(
    isAdmin || usuarioLogado?.permissoesAcoes?.includes("integracao.excluir_pedido"),
  );
  const podeConfigurarNotificacoes = Boolean(
    isAdmin || usuarioLogado?.permissoesAcoes?.includes("notificacao.configurar"),
  );
  const permissoes = usuarioLogado?.menusPermitidos;
  const podeConfigurarIntegracao=Boolean(isAdmin||usuarioLogado?.permissoesAcoes?.includes("integracao.configurar"));
  const podeVisualizarIndicadoresApis=Boolean(isAdmin||!permissoes?.length||permissoes.includes("dashboard"));
  const menuVisivel = menu.filter(
    ([id]) =>
      (id!=="perfis" || isAdmin) &&
      (id!=="logs" || podeVisualizarIndicadoresApis) &&
      (isAdmin || !permissoes?.length || permissoes.includes(id)),
  );
  // A situação já é calculada no servidor, considerando inclusive um novo
  // recebimento posterior ao cancelamento. Refiltrar aqui faria o carrinho
  // histórico sobrescrever indevidamente o estado atual do pedido.
  const dadosIntegracaoFiltrados=dadosIntegracao;
  const dadosIntegracaoOrdenados = [...dadosIntegracaoFiltrados].sort((a, b) => {
    const av = valorColunaPedido(a,ordenacaoGrade.campo) ?? "";
    const bv = valorColunaPedido(b,ordenacaoGrade.campo) ?? "";
    const r = String(av).localeCompare(String(bv), "pt-BR", { numeric: true });
    return ordenacaoGrade.direcao === "asc" ? r : -r;
  });
  const colunasPedidoNaOrdem = ordemColunas
    .map((id) => colunasPedido.find(([coluna]) => coluna === id))
    .filter((coluna): coluna is (typeof colunasPedido)[number] => Boolean(coluna));
  const colunasIntegradosNaOrdem=ordemIntegrados
    .map(id=>colunasIntegrados.find(([coluna])=>coluna===id))
    .filter((coluna):coluna is (typeof colunasIntegrados)[number]=>Boolean(coluna));
  const dadosIntegradosFiltrados=dadosIntegradosConstrushow.filter((item)=>{
    const busca=filtrosDadosIntegrados.busca.trim().toLocaleLowerCase("pt-BR");
    if(busca){
      const conteudo=[item.pedido_gmobii,item.id_carrinho,item.id_nota,item.estab,item.dados_coletados?.cliente,item.dados_coletados?.cliente_documento,item.dados_coletados?.empresa].map(valor=>String(valor??"")).join(" ").toLocaleLowerCase("pt-BR");
      if(!conteudo.includes(busca))return false;
    }
    if(filtrosDadosIntegrados.status==="integrados"&&!['integrado','existente'].includes(item.status))return false;
    if(filtrosDadosIntegrados.status==="existente"&&item.status!=="existente")return false;
    if(filtrosDadosIntegrados.status==="erro"&&item.status!=="erro")return false;
    if(filtrosDadosIntegrados.status==="gmobii_excluido"&&!(item.cancelamento_status==="concluido"&&item.cancelamento_acao==="excluir"))return false;
    if(filtrosDadosIntegrados.status==="gmobii_retornado"&&!(item.cancelamento_status==="concluido"&&item.cancelamento_acao==="devolver"))return false;
    if(filtrosDadosIntegrados.caixa==="sim"&&item.passou_caixa!=="S")return false;
    if(filtrosDadosIntegrados.caixa==="nao"&&item.passou_caixa==="S")return false;
    const data=dataParaFiltro(item.atualizado_em);
    if(filtrosDadosIntegrados.dataInicial&&data<filtrosDadosIntegrados.dataInicial)return false;
    if(filtrosDadosIntegrados.dataFinal&&data>filtrosDadosIntegrados.dataFinal)return false;
    return true;
  });
  const dadosIntegradosOrdenados=[...dadosIntegradosFiltrados].sort((a,b)=>{
    const av=valorColunaIntegrado(a,ordenacaoIntegrados.campo)??"";
    const bv=valorColunaIntegrado(b,ordenacaoIntegrados.campo)??"";
    const resultado=String(av).localeCompare(String(bv),"pt-BR",{numeric:true});
    return ordenacaoIntegrados.direcao==="asc"?resultado:-resultado;
  });
  const dadosIntegradosIndicadores=dadosIntegradosConstrushow.filter(item=>dataDentroDoPeriodo(item.atualizado_em??item.dados_coletados?.data_criacao,filtrosIndicadores));
  const execucoesIndicadores=execucoesIntegracao.filter(item=>dataDentroDoPeriodo(item.iniciadaEm,filtrosIndicadores));
  const ultimoSucessoIndicadores=execucoesIndicadores.find(item=>item.status==="sucesso");
  const statusIntegradosAgrupados=Object.entries(
    dadosIntegradosIndicadores.reduce<Record<string,DadoIntegradoConstrushow[]>>((grupos,item)=>{
      const situacao=situacaoOperacionalCarrinho(item);
      (grupos[situacao]??=[]).push(item);
      return grupos;
    },{}),
  ).sort(([a],[b])=>a.localeCompare(b,"pt-BR",{numeric:true}));
  // Aplica a regra vigente também aos alertas gravados com versões anteriores.
  const obrigatoriosAuditoria = new Set<string>(camposObrigatoriosPedido);
  const campoObrigatorioAuditoria = (campo: string) =>
    obrigatoriosAuditoria.has(campo) || /^itens\[\d+\]\.(codigo|quantidade)$/.test(campo);
  const valorAuditoriaEmBranco = (valor: unknown) =>
    (typeof valor === "string" && valor.trim() === "") ||
    (Array.isArray(valor) && valor.length === 0);
  const nomeCampoConferencia=(campo:any,conteudo?:Record<string,any>)=>{
    const id=String(campo?.campo??campo??"");
    const item=id.match(/^itens\[(\d+)\]\.(codigo|quantidade|valor)$/);
    if(!item)return id;
    const indice=Number(item[1]);
    const produto=Array.isArray(conteudo?.itens)?conteudo?.itens[indice]:undefined;
    const rotulos:Record<string,string>={codigo:"Código",quantidade:"Quantidade",valor:"Valor"};
    const codigo=campo?.produtoCodigo??produto?.codigo;
    const descricao=campo?.produtoDescricao??produto?.descricao;
    const identificacao=[codigo,descricao].filter((valor)=>valor!==undefined&&valor!==null&&String(valor).trim()).join(" — ")||String(indice+1);
    return `${rotulos[item[2]]} do produto ${identificacao}`;
  };
  const linhasAuditoriaColeta = (alertaSelecionado?.detalhes?.campos ?? []).map((campo: any) => ({
    ...campo,
    campo:nomeCampoConferencia(campo),
    categoria:
      campoObrigatorioAuditoria(campo.campo) &&
      (campo.estado !== "preenchido" || valorAuditoriaEmBranco(campo.valor))
        ? "obrigatorio_faltante"
        : valorAuditoriaEmBranco(campo.valor)
          ? "em_branco"
          : campo.estado,
  }));
  const linhasAuditoriaErp = (alertaSelecionado?.detalhes?.divergenciasErp ?? []).map((divergencia) => ({
    campo:divergencia.rotulo??divergencia.campo,
    estado:alertaSelecionado?.detalhes?.tipoProblema==="aguardando_validacao_erp"?"aguardando_validacao_erp":divergencia.tipo==="marcacao_obrigatoria"?"cadastro_invalido_erp":"nao_localizado_erp",
    categoria:alertaSelecionado?.detalhes?.tipoProblema==="aguardando_validacao_erp"?"aguardando_validacao_erp":divergencia.tipo==="marcacao_obrigatoria"?"cadastro_invalido_erp":"nao_localizado_erp",
    valor:divergencia.valor,
    mensagem:divergencia.mensagem,
  }));
  const linhasAuditoria=[...linhasAuditoriaColeta,...linhasAuditoriaErp];
  const categoriasAuditoria = [
    ["preenchido", "Preenchido"],
    ["nulo_recebido", "Nulo recebido"],
    ["em_branco", "Em branco"],
    ["ausente", "Ausente no JSON"],
    ["obrigatorio_faltante", "Obrigatório faltante"],
    ["nao_localizado_erp", "Não localizado no ERP"],
    ["cadastro_invalido_erp", "Cadastro sem classificação"],
    ["aguardando_validacao_erp", "Aguardando validação ERP"],
  ].filter(([categoria]) => linhasAuditoria.some((campo: any) => campo.categoria === categoria));
  const linhasAuditoriaVisiveis = filtroAuditoria
    ? linhasAuditoria.filter((campo: any) => campo.categoria === filtroAuditoria)
    : linhasAuditoria;
  const alertaPossuiObrigatorioFaltante = (alerta: AlertaIntegracao) =>
    (alerta.detalhes?.campos ?? []).some((campo) =>
      campoObrigatorioAuditoria(campo.campo) &&
      (campo.estado !== "preenchido" || valorAuditoriaEmBranco(campo.valor)),
    );
  const criarAlertaAguardandoErp=(dado:DadoIntegracao)=>{const itens=Array.isArray(dado.conteudo.itens)?dado.conteudo.itens:[];const divergencias=[{entidade:"cliente",campo:"cliente_codigo_erp",rotulo:"Código ERP do cliente",valor:dado.conteudo.cliente_documento??"Documento não informado",mensagem:"Aguardando localizar o cliente em PESSOADOC pelo documento."},{entidade:"vendedor",campo:"vendedor_codigo_erp",rotulo:"Código ERP do vendedor",valor:dado.conteudo.vendedor_documento??"Documento não informado",mensagem:"Aguardando localizar o vendedor em PESSOADOC pelo documento."},{entidade:"empresa",campo:"empresa_codigo_erp",rotulo:"Código ERP da filial",valor:dado.conteudo.empresa_documento??"Documento não informado",mensagem:"Aguardando localizar a filial em FILIAL pelo documento."},...itens.map((item:any,indice:number)=>({entidade:"produto",campo:`itens[${indice}].codigo_erp`,rotulo:`Código ERP do produto ${indice+1}`,valor:item.codigo??"Código não informado",mensagem:"Aguardando validar o código do produto na tabela ITEM."}))];return {id:`aguardando-erp-${dado.id}`,integracaoId:integracoes[0]?.id??"",severidade:"critico",titulo:`Pedido ${dado.chaveExterna} · De → Para pendente`,mensagem:"A pré-validação ainda não consultou os códigos correspondentes no Construshow.",detalhes:{origem:"pre_validacao_erp",numeroPedido:String(dado.chaveExterna),tipoProblema:"aguardando_validacao_erp",divergenciasErp:divergencias},lido:false,criadoEm:new Date().toISOString()} as AlertaIntegracao};
  const alertasPersistidosVisiveis = alertasIntegracao.filter((alerta) =>
    !alerta.lido && (
      (alerta.detalhes as any)?.origem === "integracao_construshow" ||
      (alerta.detalhes as any)?.origem === "pre_validacao_erp" ||
      alerta.titulo.startsWith("Falha na integracao") ||
      alertaPossuiObrigatorioFaltante(alerta)
    ),
  );
  const alertasAguardandoErp=dadosIntegracao.filter(dado=>!dado.validacaoErp&&!alertasPersistidosVisiveis.some(alerta=>alerta.detalhes?.numeroPedido===String(dado.chaveExterna))).map(criarAlertaAguardandoErp);
  // A tabela preserva o histórico das validações, mas a central deve apresentar
  // somente a ocorrência mais recente de cada tipo para o mesmo pedido.
  const alertasVisiveis=[...alertasPersistidosVisiveis,...alertasAguardandoErp]
    .sort((a,b)=>new Date(b.criadoEm).getTime()-new Date(a.criadoEm).getTime())
    .filter((alerta,indice,todos)=>{
      const pedido=String(alerta.detalhes?.numeroPedido??"");
      if(!pedido)return true;
      const tipo=String((alerta.detalhes as any)?.origem??(alerta.detalhes as any)?.tipoProblema??alerta.titulo);
      return todos.findIndex(item=>String(item.detalhes?.numeroPedido??"")===pedido&&String((item.detalhes as any)?.origem??(item.detalhes as any)?.tipoProblema??item.titulo)===tipo)===indice;
    });
  const alertasIndicadores=alertasVisiveis.filter(item=>dataDentroDoPeriodo(item.criadoEm,filtrosIndicadores));
  // A central global reúne falhas de gravação e campos obrigatórios da coleta.
  const alertasNotificacao = alertasVisiveis.filter(
    (a) => alertaPossuiObrigatorioFaltante(a) || ["integracao_construshow","pre_validacao_erp"].includes(String((a.detalhes as any)?.origem)) || a.titulo.startsWith("Falha na integracao"),
  );
  const empresaAptaIntegracao=podeConfigurarIntegracao?Boolean(configuracaoConstrushow?.conexaoId&&configuracaoConstrushow.estab&&configuracaoConstrushow.estabProduto&&configuracaoConstrushow.estabNc&&configuracaoConstrushow.idNotaConf&&conexoesOracle.some(c=>c.id===configuracaoConstrushow.conexaoId)):Boolean(integracoes.length);
  const ordenarGrade = (campo: string) =>
    setOrdenacaoGrade((atual) => ({
      campo,
      direcao:
        atual.campo === campo && atual.direcao === "asc" ? "desc" : "asc",
    }));
  const alertaDoPedido = (dado: DadoIntegracao) => {
    const origensFalhaIntegracao=["integracao_construshow","aprovacao_construshow","cancelamento_construshow"];
    const relacionados=alertasIntegracao.filter(
      (alerta) => !alerta.lido && alerta.detalhes?.numeroPedido === String(dado.chaveExterna) && (
        alertaPossuiObrigatorioFaltante(alerta) ||
        Boolean(alerta.detalhes?.divergenciasErp?.length) ||
        origensFalhaIntegracao.includes(String(alerta.detalhes?.origem))
      ),
    );
    const alertaColeta=relacionados.find(alerta=>Boolean(alerta.detalhes?.campos?.length));
    const alertaErp=relacionados.find(alerta=>Boolean(alerta.detalhes?.divergenciasErp?.length));
    const alertaIntegracao=relacionados.find(alerta=>origensFalhaIntegracao.includes(String(alerta.detalhes?.origem)));
    const possuiTentativaIntegracao=dadosIntegradosConstrushow.some(item=>item.pedido_gmobii===String(dado.chaveExterna));
    const pendenciaErp=!dado.validacaoErp&&!possuiTentativaIntegracao?criarAlertaAguardandoErp(dado):undefined;
    const base=alertaIntegracao??alertaErp??alertaColeta??pendenciaErp;
    if(!base)return undefined;
    return {
      ...base,
      titulo:`Conferência do pedido ${dado.chaveExterna}`,
      detalhes:{
        ...(alertaColeta?.detalhes??{}),
        ...(alertaErp?.detalhes??pendenciaErp?.detalhes??{}),
        ...(alertaIntegracao?.detalhes??{}),
        numeroPedido:String(dado.chaveExterna),
        campos:alertaColeta?.detalhes?.campos,
        divergenciasErp:alertaErp?.detalhes?.divergenciasErp??pendenciaErp?.detalhes?.divergenciasErp,
      },
    } as AlertaIntegracao;
  };
  const iniciarRedimensionamento = (campo: string, inicioX: number) => {
    const larguraInicial = largurasColunas[campo];
    const mover = (event: MouseEvent) =>
      setLargurasColunas((atuais) => ({
        ...atuais,
        [campo]: Math.max(
          70,
          Math.min(600, larguraInicial + event.clientX - inicioX),
        ),
      }));
    const terminar = () => {
      document.removeEventListener("mousemove", mover);
      document.removeEventListener("mouseup", terminar);
      document.body.classList.remove("resizingGrid");
    };
    document.body.classList.add("resizingGrid");
    document.addEventListener("mousemove", mover);
    document.addEventListener("mouseup", terminar);
  };
  const moverColuna = (destino: string) => {
    if (!colunaArrastada || colunaArrastada === destino) return;
    setOrdemColunas((atual) => {
      const nova = atual.filter((id) => id !== colunaArrastada);
      nova.splice(nova.indexOf(destino), 0, colunaArrastada);
      localStorage.setItem("controlS.gmobii.ordemColunas", JSON.stringify(nova));
      return nova;
    });
    setColunaArrastada(null);
  };
  const ordenarGradeIntegrados=(campo:string)=>setOrdenacaoIntegrados(atual=>({campo,direcao:atual.campo===campo&&atual.direcao==="asc"?"desc":"asc"}));
  const iniciarRedimensionamentoIntegrados=(campo:string,inicioX:number)=>{
    const larguraInicial=largurasIntegrados[campo];
    const mover=(event:MouseEvent)=>setLargurasIntegrados(atuais=>{const novas={...atuais,[campo]:Math.max(70,Math.min(600,larguraInicial+event.clientX-inicioX))};localStorage.setItem("controlS.gmobii.integrados.larguras",JSON.stringify(novas));return novas});
    const terminar=()=>{document.removeEventListener("mousemove",mover);document.removeEventListener("mouseup",terminar);document.body.classList.remove("resizingGrid")};
    document.body.classList.add("resizingGrid");document.addEventListener("mousemove",mover);document.addEventListener("mouseup",terminar);
  };
  const moverColunaIntegrados=(destino:string)=>{if(!colunaIntegradosArrastada||colunaIntegradosArrastada===destino)return;setOrdemIntegrados(atual=>{const nova=atual.filter(id=>id!==colunaIntegradosArrastada);nova.splice(nova.indexOf(destino),0,colunaIntegradosArrastada);localStorage.setItem("controlS.gmobii.integrados.ordem",JSON.stringify(nova));return nova});setColunaIntegradosArrastada(null)};

  async function carregarDados(apiIdParaPreservar = apiSelecionadaId) {
    if (!autenticado) return;
    const usuarioSeguro = podeGerenciarUsuarios
      ? request<Usuario[]>("/api/admin/usuarios").catch(() => [])
      : Promise.resolve([]);
    const perfisSeguro = podeGerenciarUsuarios
      ? request<PerfilAcesso[]>("/api/admin/perfis-acesso").catch(() => [])
      : Promise.resolve([]);
    const logsSeguro=podeVisualizarIndicadoresApis
      ? request<LogChamada[]>("/api/admin/logs").catch(()=>[])
      : Promise.resolve([]);
    const [
      clientesDados,
      usuariosDados,
      perfisDados,
      identidadeDados,
      publicacaoDados,
    ] = await Promise.all([
      request<Cliente[]>("/api/admin/clientes"),
      usuarioSeguro,
      perfisSeguro,
      request<Identidade>("/api/admin/identidade"),
      request<PublicacaoConfig>("/api/admin/publicacao"),
    ]);
    setClientes(clientesDados);
    setUsuarios(usuariosDados);
    setPerfisAcesso(perfisDados);
    setIdentidadeLoja(identidadeDados);
    setIdentidadeForm(identidadeDados);
    setPublicacao(publicacaoDados);
    localStorage.setItem(
      "controlSApiHubBrand",
      JSON.stringify(identidadeDados),
    );
    if (!clientesDados.length) {
      setConexoes([]);
      setApis([]);
      setLogs([]);
      setClientesConsumidores([]);
      setTokens([]);
      setPagina("clientes");
      return;
    }
    const [
      conexoesDados,
      apisDados,
      logsDados,
      consumidoresDados,
      tokensDados,
      integracoesDados,
      alertasDados,
    ] = await Promise.all([
      request<Conexao[]>("/api/admin/conexoes"),
      request<ApiCadastrada[]>("/api/admin/apis"),
      logsSeguro,
      request<ClienteConsumidor[]>("/api/admin/clientes-consumidores"),
      request<TokenAcesso[]>("/api/admin/tokens"),
      request<Integracao[]>("/api/admin/integracoes"),
      request<AlertaIntegracao[]>("/api/admin/alertas-integracao"),
    ]);
    setConexoes(conexoesDados);
    setApis(apisDados);
    setLogs(logsDados);
    setClientesConsumidores(consumidoresDados);
    setTokens(tokensDados);
    setIntegracoes(integracoesDados);
    setAlertasIntegracao(alertasDados);
    const integracao = integracoesDados[0];
    if (integracao) {
      const [execucoes, logsOperacionais, dados] = await Promise.all([
        request<ExecucaoIntegracao[]>(
          `/api/admin/integracoes/${integracao.id}/execucoes`,
        ),
        request<LogIntegracao[]>(
          `/api/admin/integracoes/${integracao.id}/logs`,
        ),
        request<{ dados: DadoIntegracao[]; meta: typeof metaDadosIntegracao }>(
          `/api/admin/integracoes/${integracao.id}/dados?pagina=1&quantidadePorPagina=20`,
        ),
      ]);
      setExecucoesIntegracao(execucoes);
      setLogsIntegracao(logsOperacionais);
      setTotalRegistrosLocais(dados.meta.totalRegistros);
    } else {
      setExecucoesIntegracao([]);
      setLogsIntegracao([]);
      setDadosIntegracao([]);
    }
    const apiPreservada =
      apisDados.find((api) => api.id === apiIdParaPreservar) ?? apisDados[0];
    const editor = aplicarApiNoEditor(apiPreservada);
    setApiSelecionadaId(editor.id);
    setSqlAtual(editor.sql);
    setParametrosTeste(editor.parametrosTeste);
    setParametrosApiJson(editor.parametrosApi);
    setRegrasApiJson(editor.regras);
    if (!apiPreservada) {
      setSqlAtual(sqlModelo);
      setParametrosTeste(
        JSON.stringify(parametrosTestePadraoFrontend(), null, 2),
      );
      setParametrosApiJson("[]");
      setRegrasApiJson("{}");
    }
  }

  useEffect(() => {
    carregarDados().catch((error) => falhar(error));
  }, [autenticado]);
  useEffect(()=>{if(autenticado&&new URLSearchParams(window.location.search).get("videos")==="1"){setPagina("integracoes");setSecaoIntegracao("documentacao")}},[autenticado]);
  useEffect(() => {
    if (autenticado && podeConfigurarIntegracao && secaoIntegracao==="construshow")
      carregarConfiguracaoConstrushow().catch(falhar);
  }, [autenticado, secaoIntegracao, podeConfigurarIntegracao]);
  useEffect(()=>{if(autenticado&&!podeConfigurarIntegracao&&["conexao","construshow"].includes(secaoIntegracao))setSecaoIntegracao("dados")},[autenticado,podeConfigurarIntegracao,secaoIntegracao]);
  useEffect(() => {
    if (autenticado && ["indicadores", "integrados", "dados"].includes(secaoIntegracao))
      carregarDadosIntegradosConstrushow().catch(falhar);
  }, [autenticado, secaoIntegracao, integracoes[0]?.id]);
  useEffect(()=>{
    if(!autenticado||!integracoes[0]?.id)return;
    const hoje=dataParaFiltro();
    if(secaoIntegracao==="dados"){
      const filtrosPadrao={busca:"",tipoServico:"",somenteAlertas:"",situacaoExclusao:"ativos",dataInicial:hoje,dataFinal:hoje};
      setFiltrosIntegracao(filtrosPadrao);
      carregarDadosIntegracao(1,filtrosPadrao).catch(falhar);
    }
    if(secaoIntegracao==="integrados")setFiltrosDadosIntegrados({busca:"",status:"",caixa:"",dataInicial:hoje,dataFinal:hoje});
  },[autenticado,secaoIntegracao,integracoes[0]?.id]);
  useEffect(()=>{
    if(!autenticado||secaoIntegracao!=="dados"||!integracoes[0]?.id)return;
    const timer=window.setInterval(()=>{void carregarDadosIntegracao(paginaDadosIntegracao,filtrosIntegracao)},30000);
    return()=>window.clearInterval(timer);
  },[autenticado,secaoIntegracao,integracoes[0]?.id,paginaDadosIntegracao,filtrosIntegracao.busca,filtrosIntegracao.tipoServico,filtrosIntegracao.somenteAlertas,filtrosIntegracao.situacaoExclusao,filtrosIntegracao.dataInicial,filtrosIntegracao.dataFinal]);
  useEffect(()=>{if(autenticado&&secaoIntegracao==="indicadores"&&integracoes[0]?.id)carregarIndicadoresPeriodo(filtrosIndicadores).catch(falhar)},[autenticado,secaoIntegracao,integracoes[0]?.id]);
  useEffect(()=>{
    if(!autenticado)return;
    const atualizar=()=>request<AlertaIntegracao[]>("/api/admin/alertas-integracao").then(setAlertasIntegracao).catch(()=>undefined);
    void atualizar();
    const timer=window.setInterval(atualizar,30000);
    return()=>window.clearInterval(timer);
  },[autenticado]);
  useEffect(()=>{if(autenticado&&(pagina==="configuracoes"||(podeConfigurarIntegracao&&pagina==="integracoes"&&secaoIntegracao==="construshow")))request<ConfiguracaoNotificacaoEmail>("/api/admin/configuracoes/notificacoes").then(setConfiguracaoNotificacao).catch(falhar)},[autenticado,pagina,secaoIntegracao,podeConfigurarIntegracao]);

  function avisar(texto: string) {
    setMensagem(texto);
    setErro("");
  }

  function falhar(error: unknown) {
    const apiError = error as ApiRequestError;
    if (
      apiError.codigo === "SESSAO_INVALIDA" ||
      apiError.codigo === "EMPRESA_NAO_SELECIONADA"
    ) {
      localStorage.removeItem("controlSApiHubToken");
      localStorage.removeItem("controlSApiHubUser");
      setUsuarioLogado(null);
      setAutenticado(false);
      setErro("Sua sessao expirou. Entre novamente para continuar.");
      setMensagem("");
      return;
    }
    setErro(error instanceof Error ? error.message : "Erro inesperado.");
    setMensagem("");
  }

  function sair() {
    localStorage.removeItem("controlSApiHubToken");
    localStorage.removeItem("controlSApiHubUser");
    setUsuarioLogado(null);
    setAutenticado(false);
    setEmpresasParaLogin([]);
    setLoginPendente(null);
    setMensagem("");
    setErro("");
    setPagina("dashboard");
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const dados = await request<{
        token?: string;
        usuario?: UsuarioLogado;
        exigeSelecaoEmpresa?: boolean;
        exigeCadastroEmpresa?: boolean;
        empresas?: EmpresaLogin[];
      }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          senha: form.get("senha"),
        }),
      });
      if (dados.exigeSelecaoEmpresa) {
        setEmpresasParaLogin(dados.empresas ?? []);
        setLoginPendente({
          email: String(form.get("email") ?? ""),
          senha: String(form.get("senha") ?? ""),
        });
        avisar("Selecione a empresa para entrar no portal.");
        return;
      }
      if (!dados.token || !dados.usuario)
        throw new Error("Nao foi possivel iniciar a sessao.");
      localStorage.setItem("controlSApiHubToken", dados.token);
      localStorage.setItem("controlSApiHubUser", JSON.stringify(dados.usuario));
      setUsuarioLogado(dados.usuario);
      setPagina(primeiroModuloPermitido(dados.usuario));
      setAutenticado(true);
      setEmpresasParaLogin([]);
      setLoginPendente(null);
      setMensagem("");
      setErro("");
    } catch (error) {
      const apiError = error as ApiRequestError;
      // CONTROL S - ALTERAÇÃO MON: corrige obrigatoriedade de senha no primeiro acesso.
      if (apiError.codigo === "PRIMEIRO_ACESSO_NECESSARIO") {
        setEmailPrimeiroAcesso(String(form.get("email") ?? ""));
        setErro("");
        setMensagem("Defina sua senha de primeiro acesso para entrar.");
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
      const dados = await request<{ token: string; usuario: UsuarioLogado }>(
        "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify({
            ...loginPendente,
            empresaId: form.get("empresaId"),
          }),
        },
      );
      localStorage.setItem("controlSApiHubToken", dados.token);
      localStorage.setItem("controlSApiHubUser", JSON.stringify(dados.usuario));
      setUsuarioLogado(dados.usuario);
      setPagina(primeiroModuloPermitido(dados.usuario));
      setAutenticado(true);
      setEmpresasParaLogin([]);
      setLoginPendente(null);
      setMensagem("");
      setErro("");
    } catch (error) {
      falhar(error);
    }
  }

  async function alterarSenha(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const retorno = await request<{ mensagem: string }>(
        "/api/auth/alterar-senha",
        {
          method: "POST",
          body: JSON.stringify({
            email: form.get("email"),
            senhaAtual: form.get("senhaAtual"),
            novaSenha: form.get("novaSenha"),
            confirmarSenha: form.get("confirmarSenha"),
          }),
        },
      );
      setModoAlterarSenha(false);
      setErro("");
      setMensagem(retorno.mensagem);
    } catch (error) {
      falhar(error);
    }
  }

  async function definirSenhaPrimeiroAcesso(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      // CONTROL S - ALTERAÇÃO MON: corrige obrigatoriedade de senha no primeiro acesso.
      await request("/api/auth/primeiro-acesso", {
        method: "POST",
        body: JSON.stringify({
          email: emailPrimeiroAcesso || form.get("email"),
          novaSenha: form.get("novaSenha"),
        }),
      });
      setEmailPrimeiroAcesso("");
      avisar("Senha definida. Entre com a nova senha.");
    } catch (error) {
      falhar(error);
    }
  }

  async function salvarCliente(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      nomeEmpresa: form.get("nomeEmpresa"),
      nomeFantasia: form.get("nomeFantasia"),
      cnpj: "",
      codigoInterno: "",
      responsavel: "",
      email: "",
      telefone: "",
      ambiente: "homologacao",
      status: form.get("status"),
      dominioPrincipal: form.get("dominioPrincipal"),
      subdominioApi: form.get("subdominioApi"),
      observacoes: form.get("observacoes"),
    };
    try {
      await request(
        clienteEditando
          ? `/api/admin/clientes/${clienteEditando.id}`
          : "/api/admin/clientes",
        {
          method: clienteEditando ? "PUT" : "POST",
          body: JSON.stringify(payload),
        },
      );
      formElement.reset();
      setClienteEditando(null);
      setModalCadastro(null);
      await carregarDados();
      avisar(
        clienteEditando
          ? "Empresa atualizada com sucesso."
          : "Empresa cadastrada com sucesso.",
      );
    } catch (error) {
      falhar(error);
    }
  }

  async function excluirCliente(id: string) {
    if (!window.confirm("Deseja realmente excluir este cliente?")) return;
    try {
      await request(`/api/admin/clientes/${id}`, { method: "DELETE" });
      if (clienteEditando?.id === id) setClienteEditando(null);
      await carregarDados();
      avisar("Empresa excluida.");
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
        nome: form.get("nome"),
        clienteId: form.get("clienteId"),
        tipoBanco: form.get("tipoBanco"),
        host: form.get("host"),
        porta: Number(form.get("porta")),
        bancoOuServico: form.get("bancoOuServico"),
        usuario: form.get("usuario"),
        senha: form.get("senha"),
        ambiente: form.get("ambiente"),
        status: form.get("status") || "ativa",
        observacoes: form.get("observacoes"),
      };
      await request(
        conexaoEditando
          ? `/api/admin/conexoes/${conexaoEditando.id}`
          : "/api/admin/conexoes",
        {
          method: conexaoEditando ? "PUT" : "POST",
          body: JSON.stringify(payload),
        },
      );
      formElement.reset();
      setConexaoEditando(null);
      setModalCadastro(null);
      await carregarDados();
      avisar(
        conexaoEditando
          ? "Conexao atualizada com sucesso."
          : "Conexao criada e ativada para uso no cadastro de APIs.",
      );
    } catch (error) {
      falhar(error);
    }
  }

  async function testarConexao(id: string) {
    setTestandoConexaoId(id);
    setResultadoTeste("");
    try {
      const retorno = await request<RetornoTesteConexao>(
        `/api/admin/conexoes/${id}/testar`,
        { method: "POST" },
      );
      setResultadoTeste(JSON.stringify(retorno, null, 2));
      await carregarDados();
      if (!retorno.sucesso) {
        falhar(
          new Error(
            String(
              retorno.mensagem ||
                "Nao foi possivel conectar ao banco informado.",
            ),
          ),
        );
        return;
      }
      avisar("Conexao validada com sucesso no banco de dados.");
    } catch (error) {
      falhar(error);
    } finally {
      setTestandoConexaoId("");
    }
  }

  async function excluirConexao(id: string) {
    if (!window.confirm("Deseja realmente excluir esta conexao?")) return;
    try {
      await request(`/api/admin/conexoes/${id}`, { method: "DELETE" });
      if (conexaoEditando?.id === id) setConexaoEditando(null);
      await carregarDados();
      avisar("Conexao excluida.");
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
        nome: form.get("nome"),
        codigoInterno: form.get("codigoInterno"),
        clienteId: form.get("clienteId"),
        descricao: form.get("descricao"),
        versao: form.get("versao"),
        categoria: form.get("categoria"),
        metodoHttp: form.get("metodoHttp"),
        endpoint: form.get("endpoint"),
        conexaoId: form.get("conexaoId"),
        paginacaoHabilitada: form.get("paginacaoHabilitada") === "on",
      };
      const api = await request<ApiCadastrada>(
        apiEditando ? `/api/admin/apis/${apiEditando.id}` : "/api/admin/apis",
        {
          method: apiEditando ? "PUT" : "POST",
          body: JSON.stringify({
            ...payload,
            paginacaoHabilitada: payload.paginacaoHabilitada || !apiEditando,
          }),
        },
      );
      if (!apiEditando) {
        formElement.reset();
        setApiSelecionadaId(api.id);
        setSqlAtual(sqlModelo);
        setPagina("editor");
      }
      setApiEditando(null);
      setModalCadastro(null);
      await carregarDados(api.id);
      avisar(
        apiEditando
          ? "API atualizada com sucesso."
          : "API criada em rascunho. Agora salve o SQL e publique.",
      );
    } catch (error) {
      falhar(error);
    }
  }

  async function excluirApi(id: string) {
    if (
      !window.confirm(
        "Deseja realmente excluir esta API? O endpoint deixara de existir.",
      )
    )
      return;
    try {
      await request(`/api/admin/apis/${id}`, { method: "DELETE" });
      if (apiEditando?.id === id) setApiEditando(null);
      if (apiSelecionadaId === id) setApiSelecionadaId("");
      await carregarDados(apiSelecionadaId === id ? "" : apiSelecionadaId);
      avisar("API excluida.");
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
        parametrosTesteJson = JSON.parse(parametrosTeste || "{}");
      } catch {
        throw new Error("Os parametros de teste devem estar em JSON valido.");
      }
      const retorno = await request<{
        api: ApiCadastrada;
        camposInferidos: ApiCadastrada["campos"];
      }>(`/api/admin/apis/${apiSelecionada.id}/sql`, {
        method: "PUT",
        body: JSON.stringify({
          sqlBase: sqlAtual,
          parametrosTeste: parametrosTesteJson,
        }),
      });
      await carregarDados(apiIdAtual);
      setApiSelecionadaId(apiIdAtual);
      setSqlAtual(retorno.api.sqlBase || sqlAtual);
      setParametrosTeste(
        JSON.stringify(
          retorno.api.apiSql?.parametrosTeste ?? parametrosTesteJson,
          null,
          2,
        ),
      );
      setResultadoTeste(
        JSON.stringify({ camposInferidos: retorno.camposInferidos }, null, 2),
      );
      avisar("SQL salvo e campos publicos inferidos pelos aliases.");
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
        parametros = JSON.parse(parametrosApiJson || "[]");
        regras = JSON.parse(regrasApiJson || "{}");
      } catch {
        throw new Error("Parametros e regras devem estar em JSON valido.");
      }
      let parametrosTesteJson: Record<string, unknown> = {};
      try {
        parametrosTesteJson = JSON.parse(parametrosTeste || "{}");
      } catch {
        throw new Error("Os parametros de teste devem estar em JSON valido.");
      }
      if (!Array.isArray(parametros)) {
        throw new Error(
          "A configuracao de parametros deve ser uma lista JSON.",
        );
      }
      await request(`/api/admin/apis/${apiSelecionada.id}/parametros`, {
        method: "PUT",
        body: JSON.stringify({
          parametros,
          regras,
          parametrosTeste: parametrosTesteJson,
        }),
      });
      await carregarDados(apiSelecionada.id);
      avisar("Parametros e regras da API salvos com sucesso.");
    } catch (error) {
      falhar(error);
    }
  }

  async function testarSql() {
    if (!apiSelecionada) return;
    try {
      let parametros: Record<string, string> = {};
      try {
        parametros = JSON.parse(parametrosTeste || "{}");
      } catch {
        throw new Error("Os parametros de teste devem estar em JSON valido.");
      }
      const retorno = await request(
        `/api/admin/apis/${apiSelecionada.id}/testar-sql`,
        {
          method: "POST",
          body: JSON.stringify({ parametros }),
        },
      );
      setResultadoTeste(JSON.stringify(retorno, null, 2));
      await carregarDados(apiSelecionada.id);
      avisar("Consulta executada no banco da conexao selecionada.");
    } catch (error) {
      falhar(error);
    }
  }

  async function criarUsuario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!podeGerenciarUsuarios) {
      falhar(new Error("Seu perfil não permite cadastrar usuários."));
      return;
    }
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await request(
        usuarioEditando
          ? `/api/admin/usuarios/${usuarioEditando.id}`
          : "/api/admin/usuarios",
        {
          method: usuarioEditando ? "PUT" : "POST",
          body: JSON.stringify({
            nome: form.get("nome"),
            email: form.get("email"),
            perfil: form.get("perfil"),
            status: form.get("status") || "ativo",
            empresasIds: form.getAll("empresasIds"),
            perfilAcessoId: form.get("perfilAcessoId"),
          }),
        },
      );
      formElement.reset();
      setUsuarioEditando(null);
      setModalCadastro(null);
      await carregarDados();
      avisar(
        usuarioEditando
          ? "Usuario atualizado com sucesso."
          : "Usuario criado. No primeiro acesso ele devera definir a propria senha.",
      );
    } catch (error) {
      falhar(error);
    }
  }

  async function excluirUsuario(id: string) {
    if (!isAdmin) return;
    if (!window.confirm("Deseja realmente excluir este usuario?")) return;
    try {
      await request(`/api/admin/usuarios/${id}`, { method: "DELETE" });
      if (usuarioEditando?.id === id) setUsuarioEditando(null);
      await carregarDados();
      avisar("Usuario excluido.");
    } catch (error) {
      falhar(error);
    }
  }

  async function inativarUsuario(usuario:Usuario){
    if(!podeGerenciarUsuarios||isAdmin||usuario.status==="inativo")return;
    if(!window.confirm(`Deseja inativar o usuário ${usuario.nome}?`))return;
    try{
      await request(`/api/admin/usuarios/${usuario.id}`,{method:"PUT",body:JSON.stringify({nome:usuario.nome,email:usuario.email,perfil:usuario.perfil,status:"inativo",empresasIds:usuario.empresasIds??[],perfilAcessoId:usuario.perfilAcessoId})});
      if(usuarioEditando?.id===usuario.id)setUsuarioEditando(null);
      await carregarDados();
      avisar("Usuário inativado com sucesso.");
    }catch(error){falhar(error)}
  }

  async function salvarPerfilAcesso(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await request(
        perfilEditando
          ? `/api/admin/perfis-acesso/${perfilEditando.id}`
          : "/api/admin/perfis-acesso",
        {
          method: perfilEditando ? "PUT" : "POST",
          body: JSON.stringify({
            nome: form.get("nome"),
            descricao: form.get("descricao"),
            ativo: form.get("ativo") === "true",
            menusPermitidos: form.getAll("menusPermitidos"),
            permissoesAcoes: form.getAll("permissoesAcoes"),
            tiposAlerta: form.getAll("tiposAlerta"),
          }),
        },
      );
      setPerfilEditando(null);
      setModalCadastro(null);
      await carregarDados();
      avisar(
        perfilEditando
          ? "Perfil atualizado com sucesso."
          : "Perfil criado com sucesso.",
      );
    } catch (error) {
      falhar(error);
    }
  }
  async function excluirPerfilAcesso(id: string) {
    if (!window.confirm("Deseja excluir este perfil de acesso?")) return;
    try {
      await request(`/api/admin/perfis-acesso/${id}`, { method: "DELETE" });
      await carregarDados();
      avisar("Perfil excluido.");
    } catch (error) {
      falhar(error);
    }
  }

  async function publicarApi(id?: string) {
    const apiId = id ?? apiSelecionada?.id;
    if (!apiId) return;
    try {
      await request(`/api/admin/apis/${apiId}/publicar`, { method: "POST" });
      await carregarDados();
      avisar("API publicada. O endpoint ja pode ser consumido no padrao /v1.");
    } catch (error) {
      falhar(error);
    }
  }

  async function despublicarApi(id: string) {
    try {
      await request(`/api/admin/apis/${id}/despublicar`, { method: "POST" });
      await carregarDados();
      avisar(
        "API despublicada. O endpoint publico foi retirado do catalogo ativo.",
      );
    } catch (error) {
      falhar(error);
    }
  }

  async function salvarIdentidade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const arquivoLogo = form.get("logoArquivo");
      const logoUrl =
        arquivoLogo instanceof File && arquivoLogo.size > 0
          ? await arquivoParaDataUrl(arquivoLogo)
          : identidadeLoja.logoUrl;
      const novaIdentidade = await request<Identidade>(
        "/api/admin/identidade",
        {
          method: "PUT",
          body: JSON.stringify({
            nomeLoja: identidadeForm.nomeLoja,
            descricaoCurta: identidadeForm.descricaoCurta ?? "",
            logoUrl,
          }),
        },
      );
      setIdentidadeLoja(novaIdentidade);
      setIdentidadeForm(novaIdentidade);
      localStorage.setItem(
        "controlSApiHubBrand",
        JSON.stringify(novaIdentidade),
      );
      avisar("Identidade do cliente aplicada no topo e no login.");
    } catch (error) {
      falhar(error);
    }
  }

  async function salvarNotificacoes(event:FormEvent<HTMLFormElement>){event.preventDefault();try{const salvo=await request<ConfiguracaoNotificacaoEmail>("/api/admin/configuracoes/notificacoes",{method:"PUT",body:JSON.stringify(configuracaoNotificacao)});setConfiguracaoNotificacao(salvo);avisar("Configuração de notificações salva.")}catch(error){falhar(error)}}
  async function testarNotificacoes(){try{const r=await request<{mensagem:string}>("/api/admin/configuracoes/notificacoes/testar",{method:"POST"});avisar(r.mensagem)}catch(error){falhar(error)}}

  async function salvarPublicacao(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const novaPublicacao = await request<PublicacaoConfig>(
        "/api/admin/publicacao",
        {
          method: "PUT",
          body: JSON.stringify({
            ambiente: form.get("ambiente"),
            dominioPrincipal: form.get("dominioPrincipal"),
            subdominioApi: form.get("subdominioApi"),
            urlBaseLocal: form.get("urlBaseLocal"),
            urlBaseApi: form.get("urlBaseApi"),
            urlBaseDocumentacao: form.get("urlBaseDocumentacao"),
          }),
        },
      );
      setPublicacao(novaPublicacao);
      avisar(
        "Configuracao de URL publica salva. A documentacao OpenAPI ja usa essa URL.",
      );
    } catch (error) {
      falhar(error);
    }
  }

  async function salvarToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const retorno = await request<TokenAcesso & { tokenGerado?: string }>(
        tokenEditando
          ? `/api/admin/tokens/${tokenEditando.id}`
          : "/api/admin/tokens",
        {
          method: tokenEditando ? "PUT" : "POST",
          body: JSON.stringify({
            nome: form.get("nome"),
            clienteId: form.get("clienteId"),
            parceiro: form.get("parceiro"),
            status: form.get("status"),
            expiraEm: form.get("expiraEm"),
            observacao: form.get("observacao"),
          }),
        },
      );
      formElement.reset();
      setTokenEditando(null);
      setModalCadastro(null);
      await carregarDados();
      avisar(
        retorno.tokenGerado
          ? `Token criado. Copie agora: ${retorno.tokenGerado}`
          : "Token atualizado com sucesso.",
      );
    } catch (error) {
      falhar(error);
    }
  }

  async function salvarClienteConsumidor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const retorno = await request<
        ClienteConsumidor & { tokenGerado?: string }
      >(
        consumidorEditando
          ? `/api/admin/clientes-consumidores/${consumidorEditando.id}`
          : "/api/admin/clientes-consumidores",
        {
          method: consumidorEditando ? "PUT" : "POST",
          body: JSON.stringify({
            nomeCliente: form.get("nomeCliente"),
            descricao: form.get("descricao"),
            emailResponsavel: form.get("emailResponsavel"),
            telefone: form.get("telefone"),
            status: form.get("status"),
            dataExpiracaoToken: form.get("dataExpiracaoToken"),
            observacoes: form.get("observacoes"),
          }),
        },
      );
      formElement.reset();
      setConsumidorEditando(null);
      setModalCadastro(null);
      await carregarDados();
      avisar(
        retorno.tokenGerado
          ? `Cliente consumidor criado. Copie o token agora: ${retorno.tokenGerado}`
          : "Cliente consumidor atualizado com sucesso.",
      );
    } catch (error) {
      falhar(error);
    }
  }

  async function regenerarTokenConsumidor(id: string) {
    if (
      !window.confirm(
        "Deseja regenerar o token deste cliente consumidor? O token anterior deixara de funcionar.",
      )
    )
      return;
    try {
      const retorno = await request<
        ClienteConsumidor & { tokenGerado: string }
      >(`/api/admin/clientes-consumidores/${id}/regenerar-token`, {
        method: "POST",
      });
      await carregarDados();
      avisar(`Token regenerado. Copie agora: ${retorno.tokenGerado}`);
    } catch (error) {
      falhar(error);
    }
  }

  async function excluirClienteConsumidor(id: string) {
    if (!window.confirm("Deseja realmente excluir este cliente consumidor?"))
      return;
    try {
      await request(`/api/admin/clientes-consumidores/${id}`, {
        method: "DELETE",
      });
      if (consumidorEditando?.id === id) setConsumidorEditando(null);
      await carregarDados();
      avisar("Cliente consumidor excluido.");
    } catch (error) {
      falhar(error);
    }
  }

  async function excluirToken(id: string) {
    if (!window.confirm("Deseja realmente excluir este token?")) return;
    try {
      await request(`/api/admin/tokens/${id}`, { method: "DELETE" });
      if (tokenEditando?.id === id) setTokenEditando(null);
      await carregarDados();
      avisar("Token excluido.");
    } catch (error) {
      falhar(error);
    }
  }

  async function excluirLog(id: string) {
    if (!window.confirm("Deseja realmente excluir este log?")) return;
    try {
      await request(`/api/admin/logs/${id}`, { method: "DELETE" });
      await carregarDados();
      avisar("Log excluido.");
    } catch (error) {
      falhar(error);
    }
  }

  async function salvarIntegracao(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      setProcessandoIntegracao("salvando");
      await request("/api/admin/integracoes/gmobii", {
        method: "POST",
        body: JSON.stringify({
          nome: form.get("nome"),
          urlBase: form.get("urlBase"),
          token: form.get("token"),
          status: form.get("status"),
          intervaloMinutos: Number(form.get("intervaloMinutos")),
          limitePorLote: Number(form.get("limitePorLote")),
        }),
      });
      await carregarDados();
      avisar("Integracao GMOBii configurada com seguranca.");
    } catch (error) {
      falhar(error);
    } finally {
      setProcessandoIntegracao("");
    }
  }

  async function executarIntegracao(acao: "testar" | "sincronizar") {
    const integracao = integracoes[0];
    if (!integracao) return;
    try {
      setProcessandoIntegracao(acao);
      const resultado = await request<ExecucaoIntegracao>(
        `/api/admin/integracoes/${integracao.id}/${acao}`,
        { method: "POST" },
      );
      await carregarDados();
      avisar(
        resultado.mensagem ||
          (acao === "testar"
            ? "Conexao validada."
            : "Sincronizacao concluida."),
      );
    } catch (error) {
      await carregarDados().catch(() => undefined);
      falhar(error);
    } finally {
      setProcessandoIntegracao("");
    }
  }

  async function alternarTokenGmobii() {
    if (tokenGmobiiVisivel) {
      setTokenGmobiiVisivel("");
      return;
    }
    const integracao = integracoes[0];
    if (!integracao) return;
    try {
      const retorno = await request<{ token: string }>(
        `/api/admin/integracoes/${integracao.id}/credencial`,
      );
      setTokenGmobiiVisivel(retorno.token);
    } catch (error) {
      falhar(error);
    }
  }

  async function marcarAlertaLido(id: string) {
    try {
      await request(`/api/admin/alertas-integracao/${id}/lido`, {
        method: "PUT",
      });
      await carregarDados();
      avisar("Alerta resolvido.");
    } catch (error) {
      falhar(error);
    }
  }

  async function carregarDadosIntegracao(
    pagina = paginaDadosIntegracao,
    filtros = filtrosIntegracao,
  ) {
    const integracao = integracoes[0];
    if (!integracao) return;
    const query = new URLSearchParams({
      pagina: String(pagina),
      quantidadePorPagina: "20",
    });
    Object.entries(filtros).forEach(([chave, valor]) => {
      if (valor) query.set(chave, valor);
    });
    try {
      const retorno = await request<{
        dados: DadoIntegracao[];
        meta: typeof metaDadosIntegracao;
      }>(`/api/admin/integracoes/${integracao.id}/dados?${query}`);
      setDadosIntegracao(retorno.dados);
      setMetaDadosIntegracao(retorno.meta);
      setPaginaDadosIntegracao(pagina);
    } catch (error) {
      falhar(error);
    }
  }
  async function carregarIndicadoresPeriodo(filtros=filtrosIndicadores){
    const integracao=integracoes[0];if(!integracao)return;
    const query=new URLSearchParams({pagina:"1",quantidadePorPagina:"100",situacaoExclusao:"ativos"});
    if(filtros.dataInicial)query.set("dataInicial",filtros.dataInicial);
    if(filtros.dataFinal)query.set("dataFinal",filtros.dataFinal);
    const retorno=await request<{dados:DadoIntegracao[];meta:typeof metaDadosIntegracao}>(`/api/admin/integracoes/${integracao.id}/dados?${query}`);
    setDadosRegistrosIndicadores(retorno.dados);setTotalRegistrosLocais(retorno.meta.totalRegistros);
  }

  async function consultarOpcoesConstrushow(
    tipo: "filiais" | "filiais_produto" | "filiais_nota" | "notas" | "pessoas",
    conexaoId: string,
    extras: Record<string, string | number> = {},
  ) {
    const query = new URLSearchParams({
      tipo,
      conexaoId,
      ...Object.fromEntries(
        Object.entries(extras).map(([k, v]) => [k, String(v)]),
      ),
    });
    return request<OpcaoConstrushow[]>(
      tipo === "filiais"
        ? `/api/admin/integracoes/gmobii/construshow/filiais-ativas?conexaoId=${encodeURIComponent(conexaoId)}`
        : `/api/admin/integracoes/gmobii/construshow/opcoes?${query}`,
    );
  }
  async function carregarConfiguracaoConstrushow() {
    setCarregandoConstrushow("configuracao");
    try {
      const retorno = await request<{
        configuracao: ConfiguracaoConstrushow | null;
        conexoes: Conexao[];
      }>("/api/admin/integracoes/gmobii/construshow");
      const configuracaoEfetiva=retorno.configuracao??lerRascunhoConstrushow();
      setConfiguracaoConstrushow(configuracaoEfetiva);
      setConexoesOracle(retorno.conexoes);
      if (configuracaoEfetiva?.conexaoId) {
        const [filiais, filiaisProduto, filiaisNota, notas, pessoas] =
          await Promise.all([
            consultarOpcoesConstrushow(
              "filiais",
              configuracaoEfetiva.conexaoId,
            ),
            consultarOpcoesConstrushow(
              "filiais_produto",
              configuracaoEfetiva.conexaoId,
            ),
            consultarOpcoesConstrushow(
              "filiais_nota",
              configuracaoEfetiva.conexaoId,
            ),
            consultarOpcoesConstrushow(
              "notas",
              configuracaoEfetiva.conexaoId,
              { estabNc: configuracaoEfetiva.estabNc },
            ),
            consultarOpcoesConstrushow(
              "pessoas",
              configuracaoEfetiva.conexaoId,
            ),
          ]);
        setOpcoesFilial(filiais);
        setOpcoesFilialProduto(filiaisProduto);
        setOpcoesFilialNota(filiaisNota);
        setOpcoesNota(notas);
        setOpcoesCliente(pessoas);
        setOpcoesVendedor(pessoas);
      }
    } finally {
      setCarregandoConstrushow("");
    }
  }
  async function selecionarConexaoConstrushow(conexaoId: string) {
    setConfiguracaoConstrushow(
      (atual) => ({ ...atual, conexaoId }) as ConfiguracaoConstrushow,
    );
    setOpcoesFilial([]);
    setOpcoesFilialProduto([]);
    setOpcoesFilialNota([]);
    setOpcoesNota([]);
    setOpcoesCliente([]);
    setOpcoesVendedor([]);
    if (!conexaoId) return;
    try {
      setCarregandoConstrushow("conexao");
      const [filiais, filiaisProduto, filiaisNota, pessoas] = await Promise.all(
        [
          consultarOpcoesConstrushow("filiais", conexaoId),
          consultarOpcoesConstrushow("filiais_produto", conexaoId),
          consultarOpcoesConstrushow("filiais_nota", conexaoId),
          consultarOpcoesConstrushow("pessoas", conexaoId),
        ],
      );
      setOpcoesFilial(filiais);
      setOpcoesFilialProduto(filiaisProduto);
      setOpcoesFilialNota(filiaisNota);
      setOpcoesCliente(pessoas);
      setOpcoesVendedor(pessoas);
    } catch (error) {
      falhar(error);
    } finally {
      setCarregandoConstrushow("");
    }
  }
  async function carregarNotasConstrushow(conexaoId: string, estabNc: number) {
    if (!conexaoId || !estabNc) return;
    try {
      setCarregandoConstrushow("notas");
      setOpcoesNota(
        await consultarOpcoesConstrushow("notas", conexaoId, { estabNc }),
      );
    } catch (error) {
      falhar(error);
    } finally {
      setCarregandoConstrushow("");
    }
  }
  async function salvarConfiguracaoConstrushow(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const opcao = (lista: OpcaoConstrushow[], codigo: number) =>
      lista.find((item) => item.codigo === codigo)?.descricao;
    const dados = {
      conexaoId: String(form.get("conexaoId")),
      estab: Number(form.get("estab")),
      estabProduto: Number(form.get("estabProduto")),
      estabNc: Number(form.get("estabNc")),
      idNotaConf: Number(form.get("idNotaConf")),
      idCliente: form.get("idCliente")
        ? Number(form.get("idCliente"))
        : undefined,
      idVendedor: form.get("idVendedor")
        ? Number(form.get("idVendedor"))
        : undefined,
      validadeCarrinho: Number(form.get("validadeCarrinho")),
      diasPrevisaoEntrega: Number(form.get("diasPrevisaoEntrega") ?? 4),
      integracaoAutomatica: form.get("integracaoAutomatica") === "on",
      intervaloIntegracaoMinutos: Number(
        form.get("intervaloIntegracaoMinutos") ?? 5,
      ),
      modoExclusaoPedidos: String(
        form.get("modoExclusaoPedidos") ?? "logica",
      ) as "logica" | "definitiva",
      monitorarCancelamentos: form.get("monitorarCancelamentos") === "on",
      intervaloCancelamentosMinutos: Number(
        form.get("intervaloCancelamentosMinutos") ?? 5,
      ),
      acaoCancelamentoGmobii: String(
        form.get("acaoCancelamentoGmobii") ?? "excluir",
      ) as "excluir" | "devolver",
      monitorarAprovacoes: form.get("monitorarAprovacoes") === "on",
      intervaloAprovacoesMinutos: Number(
        form.get("intervaloAprovacoesMinutos") ?? 5,
      ),
    };
    try {
      setCarregandoConstrushow("salvando");
      const salvo = await request<ConfiguracaoConstrushow>(
        "/api/admin/integracoes/gmobii/construshow",
        {
          method: "PUT",
          body: JSON.stringify({
            ...dados,
            estabDescricao: opcao(opcoesFilial, dados.estab),
            estabProdutoDescricao: opcao(
              opcoesFilialProduto,
              dados.estabProduto,
            ),
            notaConfDescricao: opcao(opcoesNota, dados.idNotaConf),
            clienteNome: opcao(opcoesCliente, dados.idCliente ?? 0),
            vendedorNome: opcao(opcoesVendedor, dados.idVendedor ?? 0),
          }),
        },
      );
      setConfiguracaoConstrushow(salvo);
      localStorage.setItem(chaveRascunhoConstrushow,JSON.stringify(salvo));
      if(podeConfigurarNotificacoes){
        const notificacoesSalvas=await request<ConfiguracaoNotificacaoEmail>(
          "/api/admin/configuracoes/notificacoes",
          {method:"PUT",body:JSON.stringify(configuracaoNotificacao)},
        );
        setConfiguracaoNotificacao(notificacoesSalvas);
      }
      avisar("Configuração Construshow salva com sucesso.");
    } catch (error) {
      falhar(error);
    } finally {
      setCarregandoConstrushow("");
    }
  }

  async function carregarDadosIntegradosConstrushow() {
    const integracao = integracoes[0];
    if (!integracao) return;
    setDadosIntegradosConstrushow(
      await request<DadoIntegradoConstrushow[]>(
        `/api/admin/integracoes/${integracao.id}/dados-integrados`,
      ),
    );
  }
  async function abrirCarrinhoConstrushow(item:DadoIntegradoConstrushow){
    const integracao=integracoes[0];
    if(!integracao||!item.id_carrinho)return;
    try{
      setCarregandoCarrinho(item.id);
      setCarrinhoSelecionado(await request<DetalheCarrinhoConstrushow>(`/api/admin/integracoes/${integracao.id}/dados-integrados/${item.id}/carrinho`));
    }catch(error){falhar(error)}finally{setCarregandoCarrinho("")}
  }
  async function abrirAlertas(){
    setModalAlertas(true);
    const atualizados=await request<AlertaIntegracao[]>("/api/admin/alertas-integracao").catch(()=>null);
    if(atualizados)setAlertasIntegracao(atualizados);
  }
  function abrirModalPedido(dado:DadoIntegracao,integrado?:DadoIntegradoConstrushow|null){setDadoJsonSelecionado(dado);setIntegracaoPedidoSelecionado(integrado??dadosIntegradosConstrushow.find(item=>item.pedido_gmobii===dado.chaveExterna)??null);setAlertaSelecionado(null);setModalAlertas(false);setIndicadorSelecionado(null)}
  function dadoDoRegistroIntegrado(item:DadoIntegradoConstrushow):DadoIntegracao{const existente=dadosIntegracao.find(dado=>dado.chaveExterna===item.pedido_gmobii);if(existente)return existente;return {id:item.id,chaveExterna:item.pedido_gmobii,dataReferencia:item.dados_coletados?.data_criacao,conteudo:item.dados_coletados??{}}}
  async function abrirConferenciaPedido(numero:string,alerta?:AlertaIntegracao){const local=dadosIntegracao.find(dado=>dado.chaveExterna===String(numero));if(local){abrirModalPedido(local);return}const integracao=integracoes[0];if(integracao)try{const retorno=await request<{dados:DadoIntegracao[];meta:typeof metaDadosIntegracao}>(`/api/admin/integracoes/${integracao.id}/dados?pagina=1&quantidadePorPagina=5&busca=${encodeURIComponent(numero)}`);const encontrado=retorno.dados.find(dado=>dado.chaveExterna===String(numero));if(encontrado){abrirModalPedido(encontrado);return}}catch{/* O modal de auditoria continua disponível como contingência. */}if(alerta){setFiltroAuditoria(null);setAlertaSelecionado(alerta)}}
  async function integrarConstrushowAgora() {
    const integracao = integracoes[0];
    if (!integracao) return;
    try {
      setCarregandoConstrushow("integrando");
      const resultado = await request<{
        total: number;
        integrados: number;
        erros: number;
      }>(`/api/admin/integracoes/${integracao.id}/integrar-construshow`, {
        method: "POST",
      });
      await carregarDadosIntegradosConstrushow();
      avisar(
        `Processamento concluído: ${resultado.integrados} integrado(s) e ${resultado.erros} erro(s).`,
      );
    } catch (error) {
      falhar(error);
    } finally {
      setCarregandoConstrushow("");
    }
  }
  async function enviarPedidoParaIntegracao(pedido:DadoIntegracao){const integracao=integracoes[0];if(!integracao)return;try{setCarregandoConstrushow(`pedido-${pedido.chaveExterna}`);const resultado=await request<{integrados:number;erros:number;resultados:DadoIntegradoConstrushow[]}>(`/api/admin/integracoes/${integracao.id}/integrar-construshow`,{method:"POST",body:JSON.stringify({pedidoNumero:pedido.chaveExterna})});setPedidoParaIntegrar(null);await Promise.all([carregarDadosIntegradosConstrushow(),carregarDados()]);if(resultado.erros)throw new Error(resultado.resultados[0]?.mensagem??"O pedido não pôde ser integrado.");avisar(`Pedido ${pedido.chaveExterna} integrado com sucesso.`)}catch(error){setPedidoParaIntegrar(null);await carregarDados().catch(()=>undefined);falhar(error)}finally{setCarregandoConstrushow("")}}
  async function reprocessarIntegracao(item:DadoIntegradoConstrushow){const integracao=integracoes[0];if(!integracao)return;try{setCarregandoConstrushow(`reprocessar-${item.id}`);const resultado=await request<{integrados:number;erros:number;resultados:DadoIntegradoConstrushow[]}>(`/api/admin/integracoes/${integracao.id}/integrar-construshow`,{method:"POST",body:JSON.stringify({pedidoNumero:item.pedido_gmobii})});setIntegradoParaReprocessar(null);await Promise.all([carregarDadosIntegradosConstrushow(),carregarDados()]);if(resultado.erros)throw new Error(resultado.resultados[0]?.mensagem??"A nova tentativa não pôde ser concluída.");avisar(`Pedido ${item.pedido_gmobii} integrado com sucesso após nova validação.`)}catch(error){setIntegradoParaReprocessar(null);await Promise.all([carregarDadosIntegradosConstrushow().catch(()=>undefined),carregarDados().catch(()=>undefined)]);falhar(error)}finally{setCarregandoConstrushow("")}}
  async function excluirTentativaIntegracao(item:DadoIntegradoConstrushow){const integracao=integracoes[0];if(!integracao)return;try{setCarregandoConstrushow(`excluir-integracao-${item.id}`);const resultado=await request<{mensagem:string}>(`/api/admin/integracoes/${integracao.id}/dados-integrados/${item.id}`,{method:"DELETE"});setIntegradoParaExcluir(null);await Promise.all([carregarDadosIntegradosConstrushow(),carregarDados()]);avisar(resultado.mensagem)}catch(error){setIntegradoParaExcluir(null);falhar(error)}finally{setCarregandoConstrushow("")}}
  async function excluirPedidoColetado(pedido:DadoIntegracao){const integracao=integracoes[0];if(!integracao)return;try{setProcessandoIntegracao(`excluir-${pedido.id}`);const resultado=await request<{mensagem:string}>(`/api/admin/integracoes/${integracao.id}/dados/${pedido.id}`,{method:"DELETE"});setPedidoParaExcluir(null);await Promise.all([carregarDadosIntegracao(paginaDadosIntegracao),carregarDados()]);avisar(resultado.mensagem)}catch(error){setPedidoParaExcluir(null);falhar(error)}finally{setProcessandoIntegracao("")}}

  if (!autenticado) {
    return (
      <div className="loginScreen">
        <div className="loginShell">
          <section className="loginShowcase">
            <div className="loginShowcaseContent">
              <span className="loginPill">CONTROL S GESTAO</span>
              <h1>
                Integrações sob controle.
                <br />
                <em>Operação sem surpresas.</em>
              </h1>
              <p>
                APIs, auditoria e monitoramento em uma plataforma segura,
                organizada e pronta para crescer com sua empresa.
              </p>
              <div className="loginTrust">
                <span>✓ Dados protegidos</span>
                <span>✓ Auditoria completa</span>
                <span>✓ Monitoramento contínuo</span>
              </div>
            </div>
          </section>
          <form
            className="loginPanel"
            onSubmit={
              modoAlterarSenha
                ? alterarSenha
                : empresasParaLogin.length
                  ? selecionarEmpresaLogin
                  : emailPrimeiroAcesso
                    ? definirSenhaPrimeiroAcesso
                    : login
            }
          >
            <div className="loginBrand">
              <Logo compacto={false} />
            </div>
            <div className="loginWelcome">
              <span className="eyebrow">AMBIENTE ADMINISTRATIVO</span>
              <h1>
                {modoAlterarSenha
                  ? "Alterar senha"
                  : empresasParaLogin.length
                    ? "Escolha a empresa"
                    : emailPrimeiroAcesso
                      ? "Primeiro acesso"
                      : "Bem-vindo"}
              </h1>
              <p>
                {modoAlterarSenha
                  ? "Confirme sua identidade e defina uma nova senha segura."
                  : empresasParaLogin.length
                    ? "Selecione o ambiente que deseja administrar."
                    : emailPrimeiroAcesso
                      ? "Crie sua senha para começar a utilizar a plataforma."
                      : "Acesse o Control S API Hub para gerenciar suas integrações."}
              </p>
            </div>
            <StatusBar
              mensagem={mensagem}
              erro={erro}
              onClose={() => {
                setMensagem("");
                setErro("");
              }}
            />
            {modoAlterarSenha ? (
              <>
                <label>
                  E-mail
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="username"
                    placeholder="seuemail@empresa.com.br"
                  />
                </label>
                <label>
                  Senha atual
                  <input
                    name="senhaAtual"
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="Digite sua senha atual"
                  />
                </label>
                <div className="loginPasswordGrid">
                  <label>
                    Nova senha
                    <input
                      name="novaSenha"
                      type="password"
                      minLength={8}
                      required
                      autoComplete="new-password"
                    />
                  </label>
                  <label>
                    Confirmar senha
                    <input
                      name="confirmarSenha"
                      type="password"
                      minLength={8}
                      required
                      autoComplete="new-password"
                    />
                  </label>
                </div>
                <button className="primary loginPrimary" type="submit">
                  Salvar nova senha
                </button>
                <button
                  className="loginLink"
                  type="button"
                  onClick={() => {
                    setModoAlterarSenha(false);
                    setErro("");
                    setMensagem("");
                  }}
                >
                  Voltar ao login
                </button>
              </>
            ) : empresasParaLogin.length ? (
              <>
                <label>
                  Empresa
                  <select name="empresaId" required>
                    <option value="">Selecione a empresa</option>
                    {empresasParaLogin.map((empresa) => (
                      <option key={empresa.id} value={empresa.id}>
                        {empresa.nomeFantasia || empresa.nomeEmpresa}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="primary" type="submit">
                  Entrar nesta empresa
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmpresasParaLogin([]);
                    setLoginPendente(null);
                    setMensagem("");
                  }}
                >
                  Voltar ao login
                </button>
              </>
            ) : (
              <>
                <label>
                  E-mail
                  <input
                    name="email"
                    defaultValue={emailPrimeiroAcesso || ""}
                    placeholder="usuario@empresa.com.br"
                    autoComplete="username"
                    disabled={Boolean(emailPrimeiroAcesso)}
                  />
                </label>
                {emailPrimeiroAcesso ? (
                  <>
                    <label>
                      Nova senha
                      <input
                        name="novaSenha"
                        type="password"
                        minLength={6}
                        required
                      />
                    </label>
                    <button className="primary" type="submit">
                      Definir senha
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmailPrimeiroAcesso("")}
                    >
                      Voltar ao login
                    </button>
                  </>
                ) : (
                  <>
                    <label>
                      Senha
                      <input
                        name="senha"
                        type="password"
                        placeholder="Digite sua senha"
                        autoComplete="current-password"
                      />
                    </label>
                    <button className="primary loginPrimary" type="submit">
                      Entrar no Control S
                    </button>
                    <button
                      className="loginLink"
                      type="button"
                      onClick={() => {
                        setModoAlterarSenha(true);
                        setErro("");
                        setMensagem("");
                      }}
                    >
                      Quero alterar minha senha
                    </button>
                  </>
                )}
              </>
            )}
            <small>Control S Consultoria · Ambiente seguro e monitorado</small>
          </form>
        </div>
      </div>
    );
  }

  const conteudo: Record<MenuId, JSX.Element> = {
    dashboard: (
      <>
        <section className="metrics">
          <div className="dashboardFilters">
            <label>
              Empresa
              <select>
                <option>Todas as empresas</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id}>{cliente.nomeFantasia}</option>
                ))}
              </select>
            </label>
            <label>
              Data inicial
              <input type="date" />
            </label>
            <label>
              Data final
              <input type="date" />
            </label>
            <button>Limpar</button>
            <button className="primary" onClick={() => carregarDados()}>
              <RefreshCw size={14} /> Atualizar
            </button>
          </div>
          <MetricCard
            titulo="APIs cadastradas"
            valor={apis.length}
            detalhe="catalogo corporativo"
          />
          <MetricCard
            titulo="APIs publicadas"
            valor={apis.filter((api) => api.status === "publicado").length}
            detalhe="disponiveis para consumo"
          />
          <MetricCard
            titulo="Rascunhos"
            valor={apis.filter((api) => api.status === "rascunho").length}
            detalhe="aguardando SQL/publicacao"
          />
          <MetricCard
            titulo="Conexoes ativas"
            valor={
              conexoes.filter((conexao) => conexao.status === "ativa").length
            }
            detalhe="Oracle, SQL Server, Firebird"
          />
          <MetricCard
            titulo="Empresas ativas"
            valor={
              clientes.filter((cliente) => cliente.status === "ativo").length
            }
            detalhe="multiempresa habilitado"
          />
          <MetricCard
            titulo="Tokens ativos"
            valor={tokens.filter((token) => token.status === "ativo").length}
            detalhe="acesso por cliente"
          />
          <MetricCard
            titulo="Chamadas registradas"
            valor={logs.length}
            detalhe="historico operacional"
          />
          <MetricCard
            titulo="Erros recentes"
            valor={logs.filter((log) => log.statusHttp >= 400).length}
            detalhe="status HTTP acima de 400"
          />
        </section>
        <section className="gridTwo">
          <div className="panel">
            <div className="panelHeader">
              <h2>Fluxo rapido</h2>
              <button onClick={() => setPagina("conexoes")}>
                Criar conexao
              </button>
            </div>
            <div className="workflow">
              <span>1. Login</span>
              <span>2. Conexao</span>
              <span>3. API</span>
              <span>4. SQL</span>
              <span>5. Publicar</span>
            </div>
          </div>
          <div className="panel">
            <div className="panelHeader">
              <h2>APIs recentes</h2>
              <button onClick={() => carregarDados()}>
                <RefreshCw size={14} /> Atualizar
              </button>
            </div>
            <table>
              <tbody>
                {apis.slice(0, 5).map((api) => (
                  <tr key={api.id}>
                    <td>{api.nome}</td>
                    <td>{api.endpoint}</td>
                    <td>
                      <Badge value={api.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </>
    ),
    clientes: (
      <section>
        {modalCadastro === "clientes" && (
          <Modal
            titulo={clienteEditando ? "Editar empresa" : "Nova empresa"}
            subtitulo="Preencha os dados cadastrais e salve para concluir."
            onClose={() => {
              setModalCadastro(null);
              setClienteEditando(null);
            }}
          >
            <form
              className="formStack modalForm"
              onSubmit={salvarCliente}
              key={clienteEditando?.id ?? "nova-empresa"}
            >
              <div className="panelHeader">
                <h2>{clienteEditando ? "Editar empresa" : "Nova empresa"}</h2>
                <div className="actions">
                  <button
                    type="button"
                    onClick={() => {
                      setModalCadastro(null);
                      setClienteEditando(null);
                    }}
                  >
                    Cancelar
                  </button>
                  <button className="primary" type="submit">
                    {clienteEditando ? "Salvar empresa" : "Cadastrar empresa"}
                  </button>
                </div>
              </div>
              <div className="formGrid">
                <label>
                  Empresa
                  <input
                    name="nomeEmpresa"
                    required
                    defaultValue={clienteEditando?.nomeEmpresa}
                    placeholder="Nome da empresa"
                  />
                </label>
                <label>
                  Nome fantasia
                  <input
                    name="nomeFantasia"
                    required
                    defaultValue={clienteEditando?.nomeFantasia}
                    placeholder="Nome comercial"
                  />
                </label>
                <label>
                  Status
                  <select
                    name="status"
                    defaultValue={clienteEditando?.status ?? "ativo"}
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </label>
                <label>
                  Dominio principal
                  <input
                    name="dominioPrincipal"
                    defaultValue={clienteEditando?.dominioPrincipal}
                    placeholder="cliente.com.br"
                  />
                </label>
                <label>
                  Subdominio API
                  <input
                    name="subdominioApi"
                    defaultValue={clienteEditando?.subdominioApi}
                    placeholder="api.cliente.com.br"
                  />
                </label>
                <label>
                  Observacoes
                  <textarea
                    name="observacoes"
                    defaultValue={clienteEditando?.observacoes}
                  />
                </label>
              </div>
            </form>
          </Modal>
        )}
        <div className="panel">
          <div className="panelHeader">
            <div>
              <h2>Empresas cadastradas</h2>
              <p>Cadastre e administre as empresas disponíveis no portal.</p>
            </div>
            <button
              className="primary"
              onClick={() => {
                setClienteEditando(null);
                setModalCadastro("clientes");
              }}
            >
              + Nova empresa
            </button>
          </div>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Dominio</th>
                  <th>Subdominio</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((cliente) => (
                  <tr key={cliente.id}>
                    <td>{cliente.nomeFantasia}</td>
                    <td>{cliente.dominioPrincipal || "-"}</td>
                    <td>{cliente.subdominioApi}</td>
                    <td>
                      <Badge value={cliente.status} />
                    </td>
                    <td className="actionCell">
                      <button
                        onClick={() => {
                          setClienteEditando(cliente);
                          setModalCadastro("clientes");
                        }}
                      >
                        <Edit3 size={14} /> Editar
                      </button>
                      <button
                        className="danger"
                        onClick={() => excluirCliente(cliente.id)}
                      >
                        <Trash2 size={14} /> Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    ),
    conexoes: (
      <section>
        {modalCadastro === "conexoes" && (
          <Modal
            titulo={conexaoEditando ? "Editar conexao" : "Nova conexao"}
            subtitulo="Configure o acesso ao banco de dados da empresa."
            onClose={() => {
              setModalCadastro(null);
              setConexaoEditando(null);
            }}
          >
            <form
              className="formStack modalForm"
              onSubmit={criarConexao}
              key={conexaoEditando?.id ?? "nova-conexao"}
            >
              <div className="panelHeader">
                <h2>{conexaoEditando ? "Editar conexao" : "Nova conexao"}</h2>
                <div className="actions">
                  <button
                    type="button"
                    onClick={() => {
                      setModalCadastro(null);
                      setConexaoEditando(null);
                    }}
                  >
                    Cancelar
                  </button>
                  <button className="primary" type="submit">
                    {conexaoEditando ? "Salvar alteracoes" : "Salvar conexao"}
                  </button>
                </div>
              </div>
              <div className="formGrid">
                <label>
                  Nome
                  <input
                    name="nome"
                    required
                    defaultValue={conexaoEditando?.nome}
                    placeholder="ERP Producao"
                  />
                </label>
                <label>
                  Empresa
                  <select
                    name="clienteId"
                    required
                    defaultValue={conexaoEditando?.clienteId ?? clientes[0]?.id}
                  >
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nomeFantasia}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Tipo
                  <select
                    name="tipoBanco"
                    required
                    defaultValue={conexaoEditando?.tipoBanco ?? "sqlserver"}
                  >
                    <option value="sqlserver">SQL Server</option>
                    <option value="oracle">Oracle</option>
                    <option value="firebird">Firebird</option>
                  </select>
                </label>
                <label>
                  Ambiente
                  <select
                    name="ambiente"
                    defaultValue={conexaoEditando?.ambiente ?? "homologacao"}
                  >
                    <option value="homologacao">Homologacao</option>
                    <option value="local">Local</option>
                    <option value="producao">Producao</option>
                  </select>
                </label>
                <label>
                  Status
                  <select
                    name="status"
                    defaultValue={conexaoEditando?.status ?? "ativa"}
                  >
                    <option value="ativa">Ativa</option>
                    <option value="inativa">Inativa</option>
                  </select>
                </label>
                <label>
                  Host
                  <input
                    name="host"
                    required
                    defaultValue={conexaoEditando?.host}
                    placeholder="localhost"
                  />
                </label>
                <label>
                  Porta
                  <input
                    name="porta"
                    required
                    type="number"
                    defaultValue={conexaoEditando?.porta ?? 1433}
                  />
                </label>
                <label>
                  Banco / service / arquivo
                  <input
                    name="bancoOuServico"
                    required
                    defaultValue={conexaoEditando?.bancoOuServico}
                    placeholder="ERP_DEMO ou C:\\Dados\\BASE.FDB"
                  />
                </label>
                <label>
                  Usuario
                  <input
                    name="usuario"
                    required
                    defaultValue={conexaoEditando?.usuario}
                    placeholder="usuario_api"
                  />
                </label>
                <label>
                  Senha
                  <input
                    name="senha"
                    type="password"
                    placeholder={
                      conexaoEditando ? "Preencha apenas para trocar" : "senha"
                    }
                  />
                </label>
                <label>
                  Observacoes
                  <textarea
                    name="observacoes"
                    defaultValue={conexaoEditando?.observacoes}
                    placeholder="Detalhes operacionais da conexao"
                  />
                </label>
              </div>
            </form>
          </Modal>
        )}
        <div className="panel">
          <div className="panelHeader">
            <div>
              <h2>Conexoes cadastradas</h2>
              <p>Conexões disponíveis para consultas e APIs.</p>
            </div>
            <button
              className="primary"
              onClick={() => {
                setConexaoEditando(null);
                setModalCadastro("conexoes");
              }}
            >
              + Nova conexao
            </button>
          </div>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Host</th>
                  <th>Status</th>
                  <th>Ultima validacao</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {conexoes.map((conexao) => (
                  <tr key={conexao.id}>
                    <td>{conexao.nome}</td>
                    <td>{conexao.tipoBanco}</td>
                    <td>
                      {conexao.host}:{conexao.porta}
                    </td>
                    <td>
                      <Badge value={conexao.status} />
                    </td>
                    <td>{formatarData(conexao.ultimaValidacao)}</td>
                    <td className="actionCell">
                      <button
                        title="Testar conexao"
                        disabled={testandoConexaoId === conexao.id}
                        onClick={() => testarConexao(conexao.id)}
                      >
                        <Play size={14} />{" "}
                        {testandoConexaoId === conexao.id
                          ? "Testando..."
                          : "Testar"}
                      </button>
                      <button
                        title="Editar conexao"
                        onClick={() => {
                          setConexaoEditando(conexao);
                          setModalCadastro("conexoes");
                        }}
                      >
                        <Edit3 size={14} /> Editar
                      </button>
                      <button
                        className="danger"
                        title="Excluir conexao"
                        onClick={() => excluirConexao(conexao.id)}
                      >
                        <Trash2 size={14} /> Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {resultadoTeste && (
            <Modal
              titulo="Teste de conexao"
              subtitulo="Retorno técnico da validação"
              onClose={() => setResultadoTeste("")}
            >
              <div className="connectionResult">
                <pre>{resultadoTeste}</pre>
              </div>
            </Modal>
          )}
        </div>
      </section>
    ),
    integracoes: (
      <div className="integrationPage">
        {secaoIntegracao === "indicadores" && (
          <>
            <section className="integrationHero">
              <div>
                <span className="eyebrow">Indicadores da integração</span>
                <h2>GMOBii</h2>
                <p>
                  Pedidos autorizados para produção, armazenados com
                  rastreabilidade completa no Control S.
                </p>
              </div>
              <div className="integrationHealth">
                <span>Saude operacional</span>
                <Badge value={integracoes[0]?.status ?? "nao configurada"} />
                <strong>{totalRegistrosLocais}</strong>
                <small>pedidos armazenados</small>
              </div>
            </section>
            <section className="panel indicatorPeriodPanel">
              <div className="panelHeader"><div><h2>Período dos indicadores</h2><p>Os números abaixo consideram o período selecionado.</p></div></div>
              <div className="integrationFilters indicatorPeriodFilters">
                <label>De<input type="date" value={filtrosIndicadores.dataInicial} onChange={event=>{const filtros={...filtrosIndicadores,dataInicial:event.target.value};setFiltrosIndicadores(filtros);void carregarIndicadoresPeriodo(filtros)}}/></label>
                <label>Até<input type="date" value={filtrosIndicadores.dataFinal} onChange={event=>{const filtros={...filtrosIndicadores,dataFinal:event.target.value};setFiltrosIndicadores(filtros);void carregarIndicadoresPeriodo(filtros)}}/></label>
                <button type="button" onClick={()=>{const filtros={dataInicial:primeiroDiaMesParaFiltro(),dataFinal:dataParaFiltro()};setFiltrosIndicadores(filtros);void carregarIndicadoresPeriodo(filtros)}}>Mês atual</button>
              </div>
            </section>
            <section className="metrics integrationMetrics">
              <MetricCard
                titulo="Último sucesso"
                valor={
                  ultimoSucessoIndicadores
                    ? formatarData(ultimoSucessoIndicadores.finalizadaEm??ultimoSucessoIndicadores.iniciadaEm, false)
                    : "-"
                }
                detalhe={
                  ultimoSucessoIndicadores
                    ? formatarData(ultimoSucessoIndicadores.finalizadaEm??ultimoSucessoIndicadores.iniciadaEm).split(" ")[1]
                    : "nenhum sucesso no período"
                }
                onClick={() => setIndicadorSelecionado("ultimoSucesso")}
              />
              <MetricCard
                titulo="Execuções"
                valor={execucoesIndicadores.length}
                detalhe="histórico operacional"
                onClick={() => setIndicadorSelecionado("execucoes")}
              />
              <MetricCard
                titulo="Alertas pendentes"
                valor={alertasIndicadores.filter((a) => !a.lido).length}
                detalhe="falhas que exigem atenção"
                onClick={() => setIndicadorSelecionado("alertas")}
              />
              <MetricCard
                titulo="Registros locais"
                valor={totalRegistrosLocais}
                detalhe="persistidos sem duplicidade"
                onClick={() => {
                  setIndicadorSelecionado("registros");
                }}
              />
            </section>
            <section className="panel">
              <div className="panelHeader">
                <div>
                  <h2>Pedidos integrados por situação</h2>
                  <p>Clique em uma situação para consultar os pedidos correspondentes.</p>
                </div>
              </div>
              {statusIntegradosAgrupados.length ? (
                <div className="metrics integrationStatusMetrics">
                  {statusIntegradosAgrupados.map(([situacao,pedidos])=>(
                    <MetricCard
                      key={situacao}
                      titulo={situacao}
                      valor={pedidos.length}
                      detalhe={pedidos.length===1?"pedido":"pedidos"}
                      onClick={()=>{setSituacaoDashboardSelecionada(situacao);setIndicadorSelecionado("statusIntegrados")}}
                    />
                  ))}
                </div>
              ) : <div className="emptyState">Nenhum pedido integrado.</div>}
            </section>
            <section className="panel">
              <div className="panelHeader">
                <h2>Central de alertas</h2>
                <span className="alertCount">
                  <AlertTriangle size={15} />{" "}
                  {alertasIndicadores.filter((a) => !a.lido).length} pendente(s)
                </span>
              </div>
              <div className="alertList">
                {alertasIndicadores.length ? (
                  alertasIndicadores.slice(0, 6).map((a) => (
                    <article
                      className={`integrationAlert ${a.lido ? "read" : ""}`}
                      key={a.id}
                    >
                      <AlertTriangle size={18} />
                      <div>
                        <strong>{a.titulo}</strong>
                        <p>{a.mensagem}</p>
                        <small>{formatarData(a.criadoEm)}</small>
                      </div>
                      <button onClick={() => abrirConferenciaPedido(String(a.detalhes?.numeroPedido??""),a)}>
                        Ver detalhes
                      </button>
                    </article>
                  ))
                ) : (
                  <div className="emptyState">
                    Nenhum alerta. A integração está tranquila.
                  </div>
                )}
              </div>
            </section>
            {indicadorSelecionado && (
              <Modal
                titulo={
                  indicadorSelecionado === "ultimoSucesso"
                    ? "Último sucesso da GMOBii"
                    : indicadorSelecionado === "execucoes"
                      ? "Execuções da GMOBii"
                      : indicadorSelecionado === "alertas"
                        ? "Alertas pendentes da GMOBii"
                        : indicadorSelecionado === "statusIntegrados"
                          ? `Pedidos · ${situacaoDashboardSelecionada}`
                          : "Registros locais da GMOBii"
                }
                subtitulo="Detalhes correspondentes ao número apresentado no indicador."
                onClose={() => setIndicadorSelecionado(null)}
              >
                {indicadorSelecionado === "ultimoSucesso" && (
                  <div className="indicatorDetail">
                    <strong>
                      {ultimoSucessoIndicadores
                        ? new Date(ultimoSucessoIndicadores.finalizadaEm??ultimoSucessoIndicadores.iniciadaEm).toLocaleString(
                            "pt-BR",
                          )
                        : "Nenhuma sincronização concluída"}
                    </strong>
                    <p>
                      {ultimoSucessoIndicadores?.mensagem??"Não há execução bem-sucedida no período selecionado."}
                    </p>
                  </div>
                )}
                {indicadorSelecionado === "execucoes" && (
                  <div className="timeline">
                    {execucoesIndicadores.map((e) => (
                      <article key={e.id}>
                        <i className={e.status} />
                        <div>
                          <strong>
                            {e.tipo === "teste"
                              ? "Teste de conexão"
                              : "Sincronização"}
                          </strong>
                          <span>{e.mensagem}</span>
                          <small>
                            {new Date(e.iniciadaEm).toLocaleString("pt-BR")} ·{" "}
                            {e.registrosRecebidos} recebido(s)
                          </small>
                        </div>
                        <Badge value={e.status} />
                      </article>
                    ))}
                  </div>
                )}
                {indicadorSelecionado === "alertas" && (
                  <div className="alertList">
                    {alertasIndicadores
                      .filter((a) => !a.lido)
                      .map((a) => (
                        <article className="integrationAlert" key={a.id}>
                          <AlertTriangle size={18} />
                          <div>
                            <strong>{a.titulo}</strong>
                            <p>{a.mensagem}</p>
                          </div>
                          <button onClick={() => abrirConferenciaPedido(String(a.detalhes?.numeroPedido??""),a)}>
                            Ver detalhes
                          </button>
                        </article>
                      ))}
                    {!alertasIndicadores.some((a) => !a.lido) && (
                      <div className="emptyState">Nenhum alerta pendente.</div>
                    )}
                  </div>
                )}
                {indicadorSelecionado === "registros" && (
                  <div className="tableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Pedido</th>
                          <th>Cliente</th>
                          <th>Empresa</th>
                          <th>Envio para produção</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dadosRegistrosIndicadores.map((d) => (
                          <tr key={d.id}>
                            <td>
                              <button
                                className="orderLink"
                                onClick={() => abrirModalPedido(d)}
                              >
                                {d.chaveExterna}
                              </button>
                            </td>
                            <td>{String(d.conteudo.cliente ?? "-")}</td>
                            <td>{String(d.conteudo.empresa ?? "-")}</td>
                            <td>
                              {d.dataReferencia
                                ? new Date(d.dataReferencia).toLocaleString(
                                    "pt-BR",
                                  )
                                : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {indicadorSelecionado === "statusIntegrados" && (
                  <div className="tableWrap">
                    <table>
                      <thead><tr><th>Pedido</th><th>Cliente</th><th>Estab.</th><th>Carrinho</th><th>Nota</th><th>Situação</th></tr></thead>
                      <tbody>
                        {(statusIntegradosAgrupados.find(([situacao])=>situacao===situacaoDashboardSelecionada)?.[1]??[]).map(item=>(
                          <tr key={item.id}>
                            <td><button className="orderLink" onClick={()=>abrirModalPedido(dadoDoRegistroIntegrado(item),item)}>{item.pedido_gmobii}</button></td>
                            <td>{String(item.dados_coletados?.cliente??"-")}</td>
                            <td>{item.estab??"-"}</td>
                            <td>{item.id_carrinho?<button className="orderLink" disabled={carregandoCarrinho===item.id} title="Abrir dados do carrinho no Construshow" onClick={()=>{setIndicadorSelecionado(null);void abrirCarrinhoConstrushow(item)}}>{carregandoCarrinho===item.id?"Abrindo...":item.id_carrinho}</button>:"-"}</td>
                            <td>{item.id_nota??"-"}</td>
                            <td><strong>{situacaoOperacionalCarrinho(item)}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Modal>
            )}
          </>
        )}
        {secaoIntegracao === "conexao" && podeConfigurarIntegracao && (
          <section className="integrationGrid">
            <form
              className="panel formStack"
              onSubmit={salvarIntegracao}
              key={integracoes[0]?.atualizadoEm ?? "nova-gmobii"}
            >
              <div className="panelHeader">
                <div>
                  <h2>Conexão GMOBii</h2>
                  <p>
                    Credenciais e parâmetros técnicos da conexão. O token é
                    armazenado de forma criptografada.
                  </p>
                </div>
                <button
                  className="primary"
                  disabled={Boolean(processandoIntegracao)}
                  type="submit"
                >
                  <Save size={14} /> Salvar
                </button>
              </div>
              <div className="formGrid">
                <label>
                  Nome da integracao
                  <input
                    name="nome"
                    required
                    defaultValue={
                      integracoes[0]?.nome ?? "GMOBii - Pedidos em producao"
                    }
                  />
                </label>
                <label>
                  Status
                  <select
                    name="status"
                    defaultValue={
                      integracoes[0]?.status === "inativa" ? "inativa" : "ativa"
                    }
                  >
                    <option value="ativa">Ativa</option>
                    <option value="inativa">Inativa</option>
                  </select>
                </label>
                <label className="wideField">
                  Endereco da API
                  <input
                    name="urlBase"
                    type="url"
                    required
                    defaultValue={
                      integracoes[0]?.urlBase ??
                      "https://api.gmobii.com.br/functions/v1/production-orders"
                    }
                  />
                </label>
                <label>
                  Token da GMOBii
                  <div className="secretField">
                    <input
                      name="token"
                      type={tokenGmobiiVisivel ? "text" : "password"}
                      value={tokenGmobiiVisivel || undefined}
                      readOnly={Boolean(tokenGmobiiVisivel)}
                      placeholder={
                        integracoes[0]?.tokenConfigurado
                          ? "Token protegido - deixe vazio para manter"
                          : "gmb_..."
                      }
                      required={!integracoes[0]?.tokenConfigurado}
                      autoComplete="new-password"
                    />
                    {isAdmin && integracoes[0]?.tokenConfigurado && (
                      <button type="button" onClick={alternarTokenGmobii}>
                        {tokenGmobiiVisivel ? "Ocultar" : "Mostrar"}
                      </button>
                    )}
                  </div>
                </label>
                <label>
                  Intervalo planejado
                  <select
                    name="intervaloMinutos"
                    defaultValue={integracoes[0]?.intervaloMinutos ?? 15}
                  >
                    <option value="2">A cada 2 minutos</option>
                    <option value="5">A cada 5 minutos</option>
                    <option value="15">A cada 15 minutos</option>
                    <option value="30">A cada 30 minutos</option>
                    <option value="60">A cada hora</option>
                  </select>
                </label>
                <label>
                  Registros por lote
                  <input
                    name="limitePorLote"
                    type="number"
                    min="1"
                    max="200"
                    defaultValue={integracoes[0]?.limitePorLote ?? 200}
                  />
                </label>
              </div>
              <div className="integrationActions">
                <button
                  type="button"
                  disabled={!integracoes[0] || Boolean(processandoIntegracao)}
                  onClick={() => executarIntegracao("testar")}
                >
                  <Play size={14} />{" "}
                  {processandoIntegracao === "testar"
                    ? "Testando..."
                    : "Testar conexao"}
                </button>
                <button
                  className="primary"
                  type="button"
                  disabled={!integracoes[0] || Boolean(processandoIntegracao)}
                  onClick={() => executarIntegracao("sincronizar")}
                >
                  <RefreshCw size={14} />{" "}
                  {processandoIntegracao === "sincronizar"
                    ? "Sincronizando..."
                    : "Buscar dados agora"}
                </button>
              </div>
            </form>
          </section>
        )}
        {secaoIntegracao === "construshow" && podeConfigurarIntegracao && (
          <section className="panel construshowConfig">
            <div className="panelHeader">
              <div>
                <h2>Configuração Construshow</h2>
                <p>
                  Vincule a GMOBii ao Oracle do Construshow e selecione os
                  cadastros diretamente na base.
                </p>
              </div>
              {configuracaoConstrushow?.atualizadoEm && (
                <small>
                  Atualizado em{" "}
                  {formatarData(configuracaoConstrushow.atualizadoEm)}
                </small>
              )}
            </div>
            {!conexoesOracle.length ? (
              <div className="emptyState">
                <Database size={30} />
                <h3>Nenhuma conexão Oracle ativa</h3>
                <p>
                  Cadastre primeiro a conexão do Construshow em Configurações →
                  Conexões.
                </p>
                <button
                  className="primary"
                  onClick={() => setPagina("conexoes")}
                >
                  Cadastrar conexão Oracle
                </button>
              </div>
            ) : (
              <form
                className="formStack"
                onSubmit={salvarConfiguracaoConstrushow}
                onChangeCapture={(event)=>{const form=event.currentTarget;const dados=new FormData(form);const numero=(nome:string,padrao?:number)=>dados.get(nome)?Number(dados.get(nome)):padrao;const rascunho={...(configuracaoConstrushow??{}),conexaoId:String(dados.get("conexaoId")??configuracaoConstrushow?.conexaoId??""),estab:numero("estab",configuracaoConstrushow?.estab),estabProduto:numero("estabProduto",configuracaoConstrushow?.estabProduto),estabNc:numero("estabNc",configuracaoConstrushow?.estabNc),idNotaConf:numero("idNotaConf",configuracaoConstrushow?.idNotaConf),idCliente:numero("idCliente",configuracaoConstrushow?.idCliente),idVendedor:numero("idVendedor",configuracaoConstrushow?.idVendedor),validadeCarrinho:numero("validadeCarrinho",configuracaoConstrushow?.validadeCarrinho??30),diasPrevisaoEntrega:numero("diasPrevisaoEntrega",configuracaoConstrushow?.diasPrevisaoEntrega??4),integracaoAutomatica:dados.get("integracaoAutomatica")==="on",intervaloIntegracaoMinutos:numero("intervaloIntegracaoMinutos",configuracaoConstrushow?.intervaloIntegracaoMinutos??5),modoExclusaoPedidos:String(dados.get("modoExclusaoPedidos")??configuracaoConstrushow?.modoExclusaoPedidos??"logica") as "logica"|"definitiva",monitorarCancelamentos:dados.get("monitorarCancelamentos")==="on",intervaloCancelamentosMinutos:numero("intervaloCancelamentosMinutos",configuracaoConstrushow?.intervaloCancelamentosMinutos??5),acaoCancelamentoGmobii:String(dados.get("acaoCancelamentoGmobii")??configuracaoConstrushow?.acaoCancelamentoGmobii??"excluir") as "excluir"|"devolver",monitorarAprovacoes:dados.get("monitorarAprovacoes")==="on",intervaloAprovacoesMinutos:numero("intervaloAprovacoesMinutos",configuracaoConstrushow?.intervaloAprovacoesMinutos??5)} as ConfiguracaoConstrushow;localStorage.setItem(chaveRascunhoConstrushow,JSON.stringify(rascunho));}}
                key={`${configuracaoConstrushow?.atualizadoEm ?? "nova"}-${conexoesOracle.length}`}
              >
                <div className="formSection">
                  <div className="sectionTitle">
                    <strong>1. Origem dos dados</strong>
                    <span>
                      A conexão precisa estar ativa e ser do tipo Oracle.
                    </span>
                  </div>
                  <label>
                    Conexão do Construshow
                    <select
                      name="conexaoId"
                      required
                      value={configuracaoConstrushow?.conexaoId ?? ""}
                      onChange={(event) =>
                        selecionarConexaoConstrushow(event.target.value)
                      }
                    >
                      <option value="">Selecione a conexão Oracle</option>
                      {conexoesOracle.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome} · {c.host}/{c.bancoOuServico}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="formSection">
                  <div className="sectionTitle">
                    <strong>2. Parâmetros da operação</strong>
                    <span>
                      As listas abaixo são consultadas diretamente no
                      Construshow.
                    </span>
                  </div>
                  <div className="formGrid">
                    <label>
                      Filial Construshow
                      <select
                        name="estab"
                        required
                        defaultValue={configuracaoConstrushow?.estab ?? ""}
                        disabled={!opcoesFilial.length}
                      >
                        <option value="">
                          {carregandoConstrushow === "conexao"
                            ? "Consultando filiais..."
                            : "Selecione código e nome da filial"}
                        </option>
                        {opcoesFilial.map((o) => (
                          <option key={o.codigo} value={o.codigo}>
                            {o.codigo} · {o.descricao}
                          </option>
                        ))}
                      </select>
                      <small>Origem: FILIAL · ESTAB / REDUZIDO</small>
                    </label>
                    <label>
                      Estabelecimento dos produtos
                      <select
                        name="estabProduto"
                        required
                        defaultValue={configuracaoConstrushow?.estabProduto ?? ""}
                        disabled={!opcoesFilialProduto.length}
                      >
                        <option value="">Selecione a filial com itens vinculados</option>
                        {opcoesFilialProduto.map((o) => (
                          <option key={o.codigo} value={o.codigo}>
                            {o.codigo} · {o.descricao}
                          </option>
                        ))}
                      </select>
                      <small>Somente filiais que possuem produtos em ITEM.</small>
                    </label>
                    <label>
                      Estabelecimento da configuração do documento
                      <select
                        name="estabNc"
                        required
                        defaultValue={configuracaoConstrushow?.estabNc ?? 500}
                        disabled={!opcoesFilialNota.length}
                        onChange={(event) =>
                          carregarNotasConstrushow(
                            configuracaoConstrushow?.conexaoId ?? "",
                            Number(event.target.value),
                          )
                        }
                      >
                        <option value="">Selecione a filial com configurações</option>
                        {opcoesFilialNota.map((o) => (
                          <option key={o.codigo} value={o.codigo}>
                            {o.codigo} · {o.descricao}
                          </option>
                        ))}
                      </select>
                      <small>
                        Somente filiais que possuem registros em NOTACONF.
                      </small>
                    </label>
                    <label>
                      Configuração de documento do carrinho
                      <select
                        name="idNotaConf"
                        required
                        defaultValue={configuracaoConstrushow?.idNotaConf ?? ""}
                        disabled={!opcoesNota.length}
                      >
                        <option value="">
                          {carregandoConstrushow === "notas"
                            ? "Consultando documentos..."
                            : "Selecione a configuração"}
                        </option>
                        {opcoesNota.map((o) => (
                          <option key={o.codigo} value={o.codigo}>
                            {o.codigo} · {o.descricao}
                          </option>
                        ))}
                      </select>
                      <small>Origem: NOTACONF · IDNOTACONF / DESCRICAO</small>
                    </label>
                    <label>
                      Cliente padrão
                      <select
                        name="idCliente"
                        defaultValue={configuracaoConstrushow?.idCliente ?? ""}
                        disabled={!opcoesCliente.length}
                      >
                        <option value="">Sem cliente padrão</option>
                        {opcoesCliente.map((o) => (
                          <option key={o.codigo} value={o.codigo}>
                            {o.codigo} · {o.descricao}
                          </option>
                        ))}
                      </select>
                      <small>Origem: PESSOADOC · código / NOME</small>
                    </label>
                    <label>
                      Vendedor padrão
                      <select
                        name="idVendedor"
                        defaultValue={configuracaoConstrushow?.idVendedor ?? ""}
                        disabled={!opcoesVendedor.length}
                      >
                        <option value="">Sem vendedor padrão</option>
                        {opcoesVendedor.map((o) => (
                          <option key={o.codigo} value={o.codigo}>
                            {o.codigo} · {o.descricao}
                          </option>
                        ))}
                      </select>
                      <small>Origem: PESSOADOC · código / NOME</small>
                    </label>
                    <label>
                      Validade do carrinho (dias)
                      <input
                        name="validadeCarrinho"
                        type="number"
                        min="0"
                        max="999"
                        required
                        defaultValue={
                          configuracaoConstrushow?.validadeCarrinho ?? 30
                        }
                      />
                      <small>Quantidade entre 0 e 999 dias.</small>
                    </label>
                    <label>
                      Dias para previsão de entrega
                      <input
                        name="diasPrevisaoEntrega"
                        type="number"
                        min="0"
                        max="999"
                        required
                        defaultValue={
                          configuracaoConstrushow?.diasPrevisaoEntrega ?? 4
                        }
                      />
                      <small>
                        Somado à data de criação para preencher a previsão dos itens. Padrão: 4 dias.
                      </small>
                    </label>
                  </div>
                </div>
                <div className="formSection">
                  <div className="sectionTitle">
                    <strong>3. Exclusão dos dados coletados</strong>
                    <span>
                      Esta regra é geral para a integração. O perfil do usuário
                      continua definindo apenas quem pode excluir.
                    </span>
                  </div>
                  <div className="formGrid">
                    <label>
                      Modo de exclusão
                      <select
                        name="modoExclusaoPedidos"
                        defaultValue={
                          configuracaoConstrushow?.modoExclusaoPedidos ?? "logica"
                        }
                      >
                        <option value="logica">Exclusão lógica (recomendado)</option>
                        <option value="definitiva">Exclusão definitiva</option>
                      </select>
                      <small>
                        Na exclusão lógica, o pedido permanece no histórico,
                        aparece em vermelho e pode ser consultado pelo filtro.
                      </small>
                    </label>
                  </div>
                </div>
                <div className="formSection">
                  <div className="sectionTitle">
                    <strong>4. Integração automática</strong>
                    <span>
                      Valida e integra os pedidos aptos no intervalo configurado.
                    </span>
                  </div>
                  <div className="formGrid">
                    <label className="checkLine">
                      <input
                        name="integracaoAutomatica"
                        type="checkbox"
                        defaultChecked={
                          configuracaoConstrushow?.integracaoAutomatica ?? false
                        }
                      />
                      Integrar pedidos automaticamente
                    </label>
                    <label>
                      Verificar a cada (minutos)
                      <input
                        name="intervaloIntegracaoMinutos"
                        type="number"
                        min="1"
                        max="1440"
                        required
                        defaultValue={
                          configuracaoConstrushow?.intervaloIntegracaoMinutos ?? 5
                        }
                      />
                      <small>Intervalo entre os ciclos de validação e integração.</small>
                    </label>
                  </div>
                  <p className="hint">
                    Antes de criar o carrinho, o sistema confere novamente os
                    campos obrigatórios, os cadastros do ERP e todos os produtos.
                    Pedidos com pendência permanecem bloqueados e geram alerta.
                  </p>
                </div>
                <div className="formSection">
                  <div className="sectionTitle">
                    <strong>5. Cancelamento Carrinho</strong>
                    <span>
                      Monitora carrinhos cancelados no ViaSoft e executa a ação
                      configurada na GMOBii.
                    </span>
                  </div>
                  <div className="formGrid">
                    <label className="checkLine">
                      <input
                        name="monitorarCancelamentos"
                        type="checkbox"
                        defaultChecked={
                          configuracaoConstrushow?.monitorarCancelamentos ?? true
                        }
                      />
                      Monitorar CARRINHO.SITUACAO = E
                    </label>
                    <label>
                      Verificar a cada (minutos)
                      <input
                        name="intervaloCancelamentosMinutos"
                        type="number"
                        min="1"
                        max="1440"
                        required
                        defaultValue={
                          configuracaoConstrushow?.intervaloCancelamentosMinutos ?? 5
                        }
                      />
                      <small>Intervalo de conferência dos carrinhos cancelados.</small>
                    </label>
                    <label>
                      Ação na GMOBii
                      <select
                        name="acaoCancelamentoGmobii"
                        defaultValue={
                          configuracaoConstrushow?.acaoCancelamentoGmobii ??
                          "excluir"
                        }
                      >
                        <option value="excluir">Excluir pedido na GMOBii</option>
                        <option value="devolver">Retornar pedido para a GMOBii</option>
                      </select>
                      <small>
                        Enviada com o motivo CANC quando CARRINHO.SITUACAO = E.
                      </small>
                    </label>
                  </div>
                  <p className="hint">
                    Excluir é a opção padrão. O retorno permite que o pedido volte
                    à GMOBii para correção e posterior geração de um novo carrinho.
                    Respostas 200 concluem a ação; conflitos 409 são bloqueados e
                    geram alerta crítico para análise.
                  </p>
                </div>
                <div className="formSection">
                  <div className="sectionTitle">
                    <strong>6. Aprovação após o caixa</strong>
                    <span>
                      Aprova automaticamente o pedido na GMOBii depois que a
                      nota vinculada ao carrinho passar pelo caixa.
                    </span>
                  </div>
                  <div className="formGrid">
                    <label className="checkLine">
                      <input
                        name="monitorarAprovacoes"
                        type="checkbox"
                        defaultChecked={
                          configuracaoConstrushow?.monitorarAprovacoes ?? true
                        }
                      />
                      Monitorar notas que passaram pelo caixa
                    </label>
                    <label>
                      Verificar a cada (minutos)
                      <input
                        name="intervaloAprovacoesMinutos"
                        type="number"
                        min="1"
                        max="1440"
                        required
                        defaultValue={
                          configuracaoConstrushow?.intervaloAprovacoesMinutos ?? 5
                        }
                      />
                      <small>Intervalo de conferência de NOTA e NOTACARRINHO.</small>
                    </label>
                  </div>
                  <p className="hint">
                    Quando MOSTRACAIXA for diferente de 1, o Control S envia a
                    ação produzir com o pedido, o carrinho e a nota. A aprovação
                    só é concluída após HTTP 200 com situação em_producao.
                  </p>
                </div>
                <div className="formSection">
                  <div className="sectionTitle">
                    <strong>7. Alertas da integração GMOBii</strong>
                    <span>
                      Configuração específica dos pedidos que não foram
                      integrados no Construshow.
                    </span>
                  </div>
                  <section className="notificationRule">
                    <div>
                      <h3>Pedido não integrado</h3>
                      <p>
                        Envia um resumo único com os pedidos e a conferência
                        campo a campo de cada ocorrência.
                      </p>
                    </div>
                    <div className="formGrid notificationOptionsGrid">
                      <label className="checkLine"><input type="checkbox" disabled={!podeConfigurarNotificacoes} checked={configuracaoNotificacao.tipos.integracao_critica.ativo} onChange={e=>setConfiguracaoNotificacao({...configuracaoNotificacao,tipos:{...configuracaoNotificacao.tipos,integracao_critica:{...configuracaoNotificacao.tipos.integracao_critica,ativo:e.target.checked}}})}/>Usar esta notificação</label>
                      <label className="checkLine"><input type="checkbox" disabled={!podeConfigurarNotificacoes} checked={configuracaoNotificacao.tipos.integracao_critica.envioImediato} onChange={e=>setConfiguracaoNotificacao({...configuracaoNotificacao,tipos:{...configuracaoNotificacao.tipos,integracao_critica:{...configuracaoNotificacao.tipos.integracao_critica,envioImediato:e.target.checked}}})}/>Enviar assim que ocorrer</label>
                      <label className="checkLine"><input type="checkbox" disabled={!podeConfigurarNotificacoes} checked={configuracaoNotificacao.tipos.integracao_critica.repetirEnquantoAberto} onChange={e=>setConfiguracaoNotificacao({...configuracaoNotificacao,tipos:{...configuracaoNotificacao.tipos,integracao_critica:{...configuracaoNotificacao.tipos.integracao_critica,repetirEnquantoAberto:e.target.checked}}})}/>Repetir enquanto estiver aberto</label>
                      <label>Destinatários<input type="text" disabled={!podeConfigurarNotificacoes} value={configuracaoNotificacao.tipos.integracao_critica.destinatarios.join("; ")} placeholder="email1@empresa.com.br; email2@empresa.com.br" onChange={e=>setConfiguracaoNotificacao({...configuracaoNotificacao,tipos:{...configuracaoNotificacao.tipos,integracao_critica:{...configuracaoNotificacao.tipos.integracao_critica,destinatarios:e.target.value.split(/[;,]/).map(v=>v.trim()).filter(Boolean)}}})}/><small className="inputHint">Para mais de um destinatário, separe os e-mails com ponto e vírgula (;).</small></label>
                    </div>
                  </section>
                  <p className="hint">
                    O remetente, a janela de horário, o intervalo e a chave do
                    provedor continuam em Configurações &gt; Central de notificações.
                  </p>
                </div>
                <div className="modalFooter">
                  <button
                    type="button"
                    onClick={() => carregarConfiguracaoConstrushow()}
                  >
                    Recarregar dados
                  </button>
                  <button
                    className="primary"
                    type="submit"
                    disabled={Boolean(carregandoConstrushow)}
                  >
                    <Save size={15} />
                    {carregandoConstrushow === "salvando"
                      ? "Salvando..."
                      : "Salvar configuração"}
                  </button>
                </div>
              </form>
            )}
          </section>
        )}
        {secaoIntegracao === "integrados" && (
          <section className="panel">
            <div className="panelHeader">
              <div>
                <h2>Dados integrados</h2>
                <p>
                  Pedidos processados no Oracle e respectivos carrinhos do
                  Construshow.
                </p>
              </div>
              <div className="actions">
                <button onClick={()=>setConfigurandoGradeIntegrados(true)}>Configurar grade</button>
                <button onClick={() => carregarDadosIntegradosConstrushow()}>
                  <RefreshCw size={14} /> Atualizar
                </button>
                <button
                  className="primary"
                  disabled={carregandoConstrushow === "integrando"}
                  onClick={() => integrarConstrushowAgora()}
                >
                  <Play size={14} />
                  {carregandoConstrushow === "integrando"
                    ? "Integrando..."
                    : "Integrar pendentes"}
                </button>
              </div>
            </div>
            <form className="integrationFilters" onSubmit={(event)=>event.preventDefault()}>
              <label>
                Busca
                <input
                  value={filtrosDadosIntegrados.busca}
                  onChange={(event)=>setFiltrosDadosIntegrados({...filtrosDadosIntegrados,busca:event.target.value})}
                  placeholder="Pedido, carrinho, nota, cliente ou documento"
                />
              </label>
              <label>
                Situação
                <select
                  value={filtrosDadosIntegrados.status}
                  onChange={(event)=>setFiltrosDadosIntegrados({...filtrosDadosIntegrados,status:event.target.value})}
                >
                  <option value="">Todas</option>
                  <option value="integrados">Integrados</option>
                  <option value="existente">Carrinho já existente</option>
                  <option value="erro">Com erro</option>
                  <option value="gmobii_excluido">Excluídos no GMOBii</option>
                  <option value="gmobii_retornado">Retornados no GMOBii</option>
                </select>
              </label>
              <label>
                Caixa
                <select
                  value={filtrosDadosIntegrados.caixa}
                  onChange={(event)=>setFiltrosDadosIntegrados({...filtrosDadosIntegrados,caixa:event.target.value})}
                >
                  <option value="">Todos</option>
                  <option value="sim">Passou no caixa</option>
                  <option value="nao">Não passou / aguardando</option>
                </select>
              </label>
              <label>
                De
                <input
                  type="date"
                  value={filtrosDadosIntegrados.dataInicial}
                  onChange={(event)=>setFiltrosDadosIntegrados({...filtrosDadosIntegrados,dataInicial:event.target.value})}
                />
              </label>
              <label>
                Até
                <input
                  type="date"
                  value={filtrosDadosIntegrados.dataFinal}
                  onChange={(event)=>setFiltrosDadosIntegrados({...filtrosDadosIntegrados,dataFinal:event.target.value})}
                />
              </label>
              <button className="primary" type="submit">Filtrar</button>
              <button
                type="button"
                onClick={()=>setFiltrosDadosIntegrados({busca:"",status:"",caixa:"",dataInicial:"",dataFinal:""})}
              >
                Limpar
              </button>
            </form>
            <div className="tableWrap dataGrid">
              <table>
                <thead>
                  <tr>
                    {colunasIntegradosNaOrdem.filter(([id])=>colunasVisiveisIntegrados[id]).map(([id,label])=><th key={id} draggable className={colunaIntegradosArrastada===id?"draggingColumn":""} title="Arraste para alterar a ordem da coluna" onDragStart={event=>{setColunaIntegradosArrastada(id);event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",id)}} onDragOver={event=>{event.preventDefault();event.dataTransfer.dropEffect="move"}} onDrop={event=>{event.preventDefault();moverColunaIntegrados(id)}} onDragEnd={()=>setColunaIntegradosArrastada(null)} style={{width:largurasIntegrados[id],minWidth:largurasIntegrados[id]}}><button className="sortHeader" onClick={()=>ordenarGradeIntegrados(id)}>{label}{ordenacaoIntegrados.campo===id?(ordenacaoIntegrados.direcao==="asc"?" ↑":" ↓"):""}</button><i className="columnResizer" title="Arraste para redimensionar" onMouseDown={event=>{event.preventDefault();event.stopPropagation();iniciarRedimensionamentoIntegrados(id,event.clientX)}}/></th>)}
                    <th className="integrationActionColumn">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {dadosIntegradosOrdenados.map((item) => (
                    <tr key={item.id}>
                      {colunasIntegradosNaOrdem.filter(([id])=>colunasVisiveisIntegrados[id]).map(([id])=>{const valor=valorColunaIntegrado(item,id);let exibido:ReactNode=String(valor??"-");if(id==="pedido")exibido=<button className="orderLink" onClick={()=>abrirModalPedido(dadoDoRegistroIntegrado(item),item)}>{item.pedido_gmobii}</button>;else if(id==="carrinho")exibido=item.id_carrinho?<button className="orderLink" disabled={carregandoCarrinho===item.id} title="Abrir dados do carrinho no Construshow" onClick={()=>void abrirCarrinhoConstrushow(item)}>{carregandoCarrinho===item.id?"Abrindo...":item.id_carrinho}</button>:"-";else if(id==="situacao")exibido=<strong className="operationalStatus">{situacaoOperacionalCarrinho(item)}</strong>;else if(id==="status")exibido=<button className="statusLogButton" title="Abrir todos os eventos deste pedido" onClick={()=>setLogPedidoSelecionado(item)}><Badge value={item.status}/><span>Ver log</span></button>;else if(id==="criacao"||id==="tentativa")exibido=formatarData(valor);else if(id==="caixa")exibido=item.passou_caixa==="S"?"Sim":item.id_nota?"Não":"Aguardando nota";return <td key={id} style={{width:largurasIntegrados[id],minWidth:largurasIntegrados[id],maxWidth:largurasIntegrados[id]}}>{exibido}</td>})}
                      <td className="integrationActionColumn">
                        <div className="actions">
                          <button onClick={() => abrirModalPedido(dadoDoRegistroIntegrado(item),item)}>
                            Ver pedido
                          </button>
                          {item.status === "erro" && (
                            <>
                              <button
                                className="primary"
                                onClick={() => setIntegradoParaReprocessar(item)}
                              >
                                Tentar novamente
                              </button>
                              {podeExcluirPedido && (
                                <button
                                  className="danger"
                                  onClick={() => setIntegradoParaExcluir(item)}
                                >
                                  Excluir da integração
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!dadosIntegradosOrdenados.length && (
                <div className="emptyState">
                  Nenhum pedido encontrado para os filtros informados.
                </div>
              )}
            </div>
            {configurandoGradeIntegrados&&<Modal titulo="Configurar grade dos dados integrados" subtitulo="Escolha as colunas visíveis e ajuste a largura de cada uma." onClose={()=>setConfigurandoGradeIntegrados(false)}><div className="columnConfigurator">{colunasIntegradosNaOrdem.map(([id,label])=><div key={id}><label className="checkLine"><input type="checkbox" checked={colunasVisiveisIntegrados[id]} onChange={event=>setColunasVisiveisIntegrados(atuais=>{const novas={...atuais,[id]:event.target.checked};localStorage.setItem("controlS.gmobii.integrados.colunasVisiveis",JSON.stringify(novas));return novas})}/>{label}</label><label>Largura<input type="range" min="70" max="420" value={largurasIntegrados[id]} onChange={event=>setLargurasIntegrados(atuais=>{const novas={...atuais,[id]:Number(event.target.value)};localStorage.setItem("controlS.gmobii.integrados.larguras",JSON.stringify(novas));return novas})}/><span>{largurasIntegrados[id]} px</span></label></div>)}</div><div className="modalFooter"><button className="primary" onClick={()=>setConfigurandoGradeIntegrados(false)}>Aplicar</button></div></Modal>}
            {logPedidoSelecionado&&(
              <Modal titulo={`Eventos do pedido ${logPedidoSelecionado.pedido_gmobii}`} subtitulo={`Carrinho ${logPedidoSelecionado.id_carrinho??"não gerado"} · histórico completo vinculado ao pedido`} onClose={()=>setLogPedidoSelecionado(null)}>
                <div className="orderEventLog">
                  <div className="eventLogSummary"><span>Situação atual</span><strong>{situacaoOperacionalCarrinho(logPedidoSelecionado)}</strong></div>
                  {(logPedidoSelecionado.eventos_pedido??[]).length?(
                    <div className="eventTimeline">{(logPedidoSelecionado.eventos_pedido??[]).map((evento,indice)=><article key={`${evento.evento}-${evento.criado_em}-${indice}`} className={evento.nivel==="erro"?"errorEvent":""}><div className="eventMarker"/><div className="eventContent"><div className="eventHeading"><strong>{nomeEventoPedido(evento.evento)}</strong><span>{formatarData(evento.criado_em)}</span></div><p>{evento.mensagem}</p><div className="eventMeta"><span>Nível: {evento.nivel}</span>{evento.status_http!==undefined&&evento.status_http!==null&&<span>HTTP: {evento.status_http}</span>}{evento.duracao_ms!==undefined&&evento.duracao_ms!==null&&<span>Duração: {evento.duracao_ms} ms</span>}</div>{evento.detalhes&&Object.keys(evento.detalhes).length>0&&<details><summary>Ver dados enviados e resposta</summary><pre>{JSON.stringify(evento.detalhes,null,2)}</pre></details>}</div></article>)}</div>
                  ):<div className="emptyState">Ainda não há eventos operacionais vinculados a este pedido.</div>}
                </div>
                <div className="modalFooter"><button className="primary" onClick={()=>setLogPedidoSelecionado(null)}>Fechar</button></div>
              </Modal>
            )}
            {carrinhoSelecionado&&(
              <Modal titulo={`Carrinho ${carrinhoSelecionado.cabecalho.numeroCarrinho}`} subtitulo={`Pedido GMOBii ${carrinhoSelecionado.pedidoGmobii} · dados atuais do Construshow`} onClose={()=>setCarrinhoSelecionado(null)}>
                <div className="cartDetails">
                  <div className="orderDetail">
                    <div><span>Estabelecimento</span><strong>{carrinhoSelecionado.cabecalho.estabelecimento}</strong></div>
                    <div><span>Situação</span><strong>{descricaoSituacaoCarrinho(carrinhoSelecionado.cabecalho.situacao)}</strong></div>
                    <div><span>Número da nota</span><strong>{carrinhoSelecionado.cabecalho.numeroNota??"Ainda não gerada"}</strong></div>
                    <div><span>Abertura</span><strong>{formatarData(carrinhoSelecionado.cabecalho.abertura)}</strong></div>
                    <div><span>Validade</span><strong>{formatarData(carrinhoSelecionado.cabecalho.validade,false)}</strong></div>
                    <div><span>Cliente</span><strong>{carrinhoSelecionado.cabecalho.codigoCliente} · {carrinhoSelecionado.cabecalho.cliente??"Não informado"}</strong></div>
                    <div><span>Documento</span><strong>{carrinhoSelecionado.cabecalho.documento??"Não informado"}</strong></div>
                    <div><span>Vendedor</span><strong>{carrinhoSelecionado.cabecalho.codigoVendedor} · {carrinhoSelecionado.cabecalho.vendedor??"Não informado"}</strong></div>
                    <div><span>Prazo médio</span><strong>{carrinhoSelecionado.cabecalho.prazoMedio??0} dia(s)</strong></div>
                  </div>
                  {carrinhoSelecionado.cabecalho.observacao&&<div className="cartObservation"><span className="eyebrow">Observações</span><p>{carrinhoSelecionado.cabecalho.observacao}</p></div>}
                  <div className="detailSectionTitle"><div><span className="eyebrow">Itens do carrinho</span><h3>Produtos e valores gravados</h3></div><strong>{carrinhoSelecionado.itens.length} item(ns)</strong></div>
                  <div className="tableWrap">
                    <table>
                      <thead><tr><th>Seq.</th><th>Código</th><th>Descrição</th><th>Un.</th><th>Quantidade</th><th>Valor unitário</th><th>Valor total</th><th>Previsão de entrega</th><th>Entregar</th></tr></thead>
                      <tbody>{carrinhoSelecionado.itens.map(item=><tr key={`${item.sequencia}-${item.codigo}`}><td>{item.sequencia}</td><td><strong>{item.codigo}</strong></td><td>{item.descricao||"-"}</td><td>{item.unidade||"-"}</td><td>{item.quantidade.toLocaleString("pt-BR")}</td><td>{formatarMoeda(item.valorUnitario)}</td><td><strong>{formatarMoeda(item.valorTotal)}</strong></td><td>{formatarData(item.previsaoEntrega,false)}</td><td>{item.entregar==="S"?"Sim":"Não"}</td></tr>)}</tbody>
                    </table>
                  </div>
                  <div className="cartTotals">
                    <div><span>Desconto</span><strong>{formatarMoeda(carrinhoSelecionado.cabecalho.totalDesconto)}</strong></div>
                    <div><span>Frete</span><strong>{formatarMoeda(carrinhoSelecionado.cabecalho.totalFrete)}</strong></div>
                    <div className="grandTotal"><span>Total do carrinho</span><strong>{formatarMoeda(carrinhoSelecionado.cabecalho.total)}</strong></div>
                  </div>
                </div>
                <div className="modalFooter"><button className="primary" onClick={()=>setCarrinhoSelecionado(null)}>Fechar</button></div>
              </Modal>
            )}
            {integradoParaReprocessar && (
              <Modal
                titulo={`Tentar integrar novamente o pedido ${integradoParaReprocessar.pedido_gmobii}?`}
                subtitulo="Todas as validações obrigatórias e o De → Para serão executados novamente antes de acessar o Oracle."
                onClose={() => setIntegradoParaReprocessar(null)}
              >
                <p>Se ainda existir qualquer pendência, o pedido continuará bloqueado e nenhuma gravação será iniciada no Construshow.</p>
                <div className="modalFooter">
                  <button onClick={() => setIntegradoParaReprocessar(null)}>Cancelar</button>
                  <button className="primary" disabled={Boolean(carregandoConstrushow)} onClick={() => reprocessarIntegracao(integradoParaReprocessar)}>Validar e tentar novamente</button>
                </div>
              </Modal>
            )}
            {integradoParaExcluir && (
              <Modal
                titulo={`Excluir a tentativa do pedido ${integradoParaExcluir.pedido_gmobii}?`}
                subtitulo="Somente o registro da tentativa com erro será removido."
                onClose={() => setIntegradoParaExcluir(null)}
              >
                <p>Os dados coletados da GMOBii serão preservados. A exclusão ficará registrada nos logs com o usuário responsável.</p>
                <div className="modalFooter">
                  <button onClick={() => setIntegradoParaExcluir(null)}>Cancelar</button>
                  <button className="danger" disabled={Boolean(carregandoConstrushow)} onClick={() => excluirTentativaIntegracao(integradoParaExcluir)}>Sim, excluir tentativa</button>
                </div>
              </Modal>
            )}
          </section>
        )}
        {secaoIntegracao === "dados" && (
          <section className="panel">
            <div className="panelHeader">
              <div>
                <h2>Dados coletados</h2>
                <p>
                  {(["integrados","nao_integrados"].includes(filtrosIntegracao.situacaoExclusao)
                    ? dadosIntegracaoOrdenados.length
                    : metaDadosIntegracao.totalRegistros)} pedido(s) encontrado(s)
                </p>
              </div>
              <div className="actions">
                <button
                  className="primary"
                  disabled={!integracoes[0] || Boolean(processandoIntegracao)}
                  onClick={() => setConfirmarIntegracaoForcada(true)}
                >
                  <Play size={14} />{" "}
                  {processandoIntegracao === "sincronizar"
                    ? "Integrando..."
                    : "Forçar integração"}
                </button>
                <button onClick={() => setConfigurandoGrade(true)}>
                  Configurar grade
                </button>
                <button onClick={() => carregarDadosIntegracao()}>
                  <RefreshCw size={14} /> Atualizar
                </button>
              </div>
            </div>
            <form
              className="integrationFilters"
              onSubmit={(e) => {
                e.preventDefault();
                carregarDadosIntegracao(1);
              }}
            >
              <label>
                Busca
                <input
                  value={filtrosIntegracao.busca}
                  onChange={(e) =>
                    setFiltrosIntegracao({
                      ...filtrosIntegracao,
                      busca: e.target.value,
                    })
                  }
                  placeholder="Número do pedido, cliente ou empresa"
                />
              </label>
              <label>
                Serviço
                <select
                  value={filtrosIntegracao.tipoServico}
                  onChange={(e) =>
                    setFiltrosIntegracao({
                      ...filtrosIntegracao,
                      tipoServico: e.target.value,
                    })
                  }
                >
                  <option value="">Todos</option>
                  <option value="normal">Normal</option>
                  <option value="imediato">Imediato</option>
                  <option value="especial">Especial</option>
                  <option value="especial-imediato">Especial imediato</option>
                  <option value="tiras_full">Tiras full</option>
                </select>
              </label>
              <label>
                Alertas
                <select
                  value={filtrosIntegracao.somenteAlertas}
                  onChange={(e) =>
                    setFiltrosIntegracao({
                      ...filtrosIntegracao,
                      somenteAlertas: e.target.value,
                    })
                  }
                >
                  <option value="">Todos os pedidos</option>
                  <option value="sim">Somente pedidos com alerta</option>
                </select>
              </label>
              <label>
                Situação
                <select
                  value={filtrosIntegracao.situacaoExclusao}
                  onChange={(e) =>
                    setFiltrosIntegracao({
                      ...filtrosIntegracao,
                      situacaoExclusao: e.target.value,
                    })
                  }
                >
                  <option value="ativos">Integrados e não integrados</option>
                  <option value="nao_integrados">Não integrados</option>
                  <option value="integrados">Integrados</option>
                  <option value="excluidos">Excluídos</option>
                </select>
              </label>
              <label>
                De
                <input
                  type="date"
                  value={filtrosIntegracao.dataInicial}
                  onChange={(e) =>
                    setFiltrosIntegracao({
                      ...filtrosIntegracao,
                      dataInicial: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Até
                <input
                  type="date"
                  value={filtrosIntegracao.dataFinal}
                  onChange={(e) =>
                    setFiltrosIntegracao({
                      ...filtrosIntegracao,
                      dataFinal: e.target.value,
                    })
                  }
                />
              </label>
              <button className="primary" type="submit">
                Filtrar
              </button>
              <button
                type="button"
                onClick={() => {
                  const limpos = {
                    busca: "",
                    tipoServico: "",
                    somenteAlertas: "",
                    situacaoExclusao: "ativos",
                    dataInicial: "",
                    dataFinal: "",
                  };
                  setFiltrosIntegracao(limpos);
                  carregarDadosIntegracao(1, limpos);
                }}
              >
                Limpar
              </button>
            </form>
            <div className="tableWrap dataGrid">
              <table>
                <thead>
                  <tr>
                    {colunasPedidoNaOrdem
                      .filter(([id]) => colunasVisiveis[id])
                      .map(([id, label]) => (
                        <th
                          key={id}
                          draggable
                          className={colunaArrastada === id ? "draggingColumn" : ""}
                          title="Arraste para alterar a ordem da coluna"
                          onDragStart={(event) => {
                            setColunaArrastada(id);
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", id);
                          }}
                          onDragOver={(event) => {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = "move";
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            moverColuna(id);
                          }}
                          onDragEnd={() => setColunaArrastada(null)}
                          style={{
                            width: largurasColunas[id],
                            minWidth: largurasColunas[id],
                          }}
                        >
                          <button
                            className="sortHeader"
                            onClick={() => ordenarGrade(id)}
                          >
                            {label}
                            {ordenacaoGrade.campo === id
                              ? ordenacaoGrade.direcao === "asc"
                                ? " ↑"
                                : " ↓"
                              : ""}
                          </button>
                          <i
                            className="columnResizer"
                            title="Arraste para redimensionar"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              iniciarRedimensionamento(id, event.clientX);
                            }}
                          />
                        </th>
                      ))}
                    <th className="integrationActionColumn">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {dadosIntegracaoOrdenados.map((d) => {
                    const alertaBloqueante=alertaDoPedido(d);
                    const jaIntegrado=Boolean(dadosIntegradosConstrushow.find(item=>item.pedido_gmobii===d.chaveExterna&&["integrado","existente"].includes(item.status)));
                    return <tr key={d.id} className={d.excluido ? "deletedOrderRow" : ""}>
                      {colunasPedidoNaOrdem
                        .filter(([id]) => colunasVisiveis[id])
                        .map(([id]) => {
                          const valor = valorColunaPedido(d,id);
                          const exibido =
                            id === "itens"
                              ? Array.isArray(valor)
                                ? valor.length
                                : 0
                              : id.startsWith("data_") && valor
                                ? new Date(valor).toLocaleString("pt-BR")
                                : (valor ?? "-");
                          const alerta = id === "numero_pedido" ? alertaBloqueante : undefined;
                          return (
                            <td
                              key={id}
                              style={{
                                width: largurasColunas[id],
                                minWidth: largurasColunas[id],
                                maxWidth: largurasColunas[id],
                              }}
                            >
                              {id === "numero_pedido" ? (
                                <span className="orderNumber">
                                  <button
                                    className="orderLink"
                                    onClick={() => abrirModalPedido(d)}
                                  >
                                    {String(exibido)}
                                  </button>
                                  {alerta && (
                                    <button
                                      className={`orderAlert ${alerta.lido ? "read" : ""}`}
                                      title="Ver conferência dos campos"
                                      onClick={() => {
                                        abrirConferenciaPedido(d.chaveExterna,alerta);
                                      }}
                                    >
                                      <AlertTriangle size={15} />
                                    </button>
                                  )}
                                </span>
                              ) : (
                                String(exibido)
                              )}
                            </td>
                          );
                        })}
                      <td className="integrationActionColumn"><div className="actions">{d.excluido?<span className="deletedOrderBadge" title={`Excluído por ${d.excluidoPorNome??"usuário não identificado"} em ${formatarData(d.excluidoEm)}`}>Excluído</span>:<><button className="primary" disabled={!empresaAptaIntegracao||Boolean(alertaBloqueante)||!d.validacaoErp||d.validacaoErp.status==="pendente"||jaIntegrado||Boolean(carregandoConstrushow)} title={!empresaAptaIntegracao?"Complete a configuração Construshow antes de integrar.":alertaBloqueante?"Corrija os campos obrigatórios indicados no alerta antes de integrar.":!d.validacaoErp?"Execute a validação De → Para antes de integrar.":d.validacaoErp.status==="pendente"?"Corrija os cadastros não localizados no ERP antes de integrar.":"Enviar somente este pedido para o Construshow"} onClick={()=>setPedidoParaIntegrar(d)}>{jaIntegrado?"Integrado":alertaBloqueante?"Bloqueado por alerta":!d.validacaoErp?"Aguardando De → Para":d.validacaoErp.status==="pendente"?"Pendente no ERP":"Enviar para integração"}</button>{podeExcluirPedido&&!jaIntegrado&&<button className="danger" disabled={Boolean(processandoIntegracao)} onClick={()=>setPedidoParaExcluir(d)}>Excluir</button>}</>}</div></td>
                    </tr>
                  })}
                </tbody>
              </table>
              {!dadosIntegracaoOrdenados.length && (
                <div className="emptyTable">
                  Nenhum pedido encontrado com os filtros informados.
                </div>
              )}
            </div>
            <div className="paginationBar">
              <span>
                Pagina {metaDadosIntegracao.pagina} de{" "}
                {metaDadosIntegracao.totalPaginas}
              </span>
              <div>
                <button
                  disabled={paginaDadosIntegracao <= 1}
                  onClick={() =>
                    carregarDadosIntegracao(paginaDadosIntegracao - 1)
                  }
                >
                  Anterior
                </button>
                <button
                  disabled={
                    paginaDadosIntegracao >= metaDadosIntegracao.totalPaginas
                  }
                  onClick={() =>
                    carregarDadosIntegracao(paginaDadosIntegracao + 1)
                  }
                >
                  Proxima
                </button>
              </div>
            </div>
            {configurandoGrade && (
              <Modal
                titulo="Configurar grade"
                subtitulo="Escolha as colunas visíveis e a largura de cada uma."
                onClose={() => setConfigurandoGrade(false)}
              >
                <div className="columnConfigurator">
                  {colunasPedidoNaOrdem.map(([id, label]) => (
                    <div key={id}>
                      <label className="checkLine">
                        <input
                          type="checkbox"
                          checked={colunasVisiveis[id]}
                          onChange={(e) =>
                            setColunasVisiveis({
                              ...colunasVisiveis,
                              [id]: e.target.checked,
                            })
                          }
                        />
                        {label}
                      </label>
                      <label>
                        Largura
                        <input
                          type="range"
                          min="70"
                          max="420"
                          value={largurasColunas[id]}
                          onChange={(e) =>
                            setLargurasColunas({
                              ...largurasColunas,
                              [id]: Number(e.target.value),
                            })
                          }
                        />
                        <span>{largurasColunas[id]} px</span>
                      </label>
                    </div>
                  ))}
                </div>
                <div className="modalFooter">
                  <button
                    className="primary"
                    onClick={() => setConfigurandoGrade(false)}
                  >
                    Aplicar
                  </button>
                </div>
              </Modal>
            )}
            {pedidoParaIntegrar&&<Modal titulo={`Enviar pedido ${pedidoParaIntegrar.chaveExterna} para integração?`} subtitulo="O pedido será validado e gravado no Oracle do Construshow em uma única transação." onClose={()=>setPedidoParaIntegrar(null)}><p>Se cliente, vendedor, configuração de documento ou qualquer produto não puder ser localizado, nada será gravado e um alerta crítico será criado.</p><div className="modalFooter"><button onClick={()=>setPedidoParaIntegrar(null)}>Cancelar</button><button className="primary" onClick={()=>enviarPedidoParaIntegracao(pedidoParaIntegrar)}>Sim, enviar para integração</button></div></Modal>}
            {pedidoParaExcluir&&<Modal tipo="erro" titulo={`Excluir o pedido ${pedidoParaExcluir.chaveExterna}?`} subtitulo={configuracaoConstrushow?.modoExclusaoPedidos==="definitiva"?"A configuração atual fará uma exclusão definitiva.":"A configuração atual fará uma exclusão lógica e auditável."} onClose={()=>setPedidoParaExcluir(null)}><p>{configuracaoConstrushow?.modoExclusaoPedidos==="definitiva"?"O pedido será removido dos dados coletados e não poderá ser recuperado pela tela. O usuário, a data e o conteúdo permanecerão registrados no log de auditoria.":"O pedido deixará a fila de integração, permanecerá guardado para auditoria e poderá ser consultado pelo filtro Situação > Excluídos, destacado em vermelho."}</p><p>Esta ação somente é permitida quando ainda não existe carrinho integrado.</p><div className="modalFooter"><button onClick={()=>setPedidoParaExcluir(null)}>Cancelar</button><button className="danger" disabled={processandoIntegracao===`excluir-${pedidoParaExcluir.id}`} onClick={()=>excluirPedidoColetado(pedidoParaExcluir)}>{processandoIntegracao===`excluir-${pedidoParaExcluir.id}`?"Excluindo...":"Sim, excluir pedido"}</button></div></Modal>}
            {confirmarIntegracaoForcada && (
              <Modal
                titulo="Forçar integração com a GMOBii?"
                subtitulo="A busca será executada agora, independentemente do intervalo planejado."
                onClose={() => setConfirmarIntegracaoForcada(false)}
              >
                <p>
                  Os pedidos existentes serão atualizados pelo número do pedido,
                  sem criar duplicidades. A execução ficará registrada no
                  histórico e qualquer divergência será exibida nos alertas.
                </p>
                <div className="modalFooter">
                  <button onClick={() => setConfirmarIntegracaoForcada(false)}>
                    Cancelar
                  </button>
                  <button
                    className="primary"
                    onClick={async () => {
                      setConfirmarIntegracaoForcada(false);
                      await executarIntegracao("sincronizar");
                      await carregarDadosIntegracao(1);
                    }}
                  >
                    Sim, forçar integração
                  </button>
                </div>
              </Modal>
            )}
          </section>
        )}
        {secaoIntegracao === "historico" && (
          <section className="panel">
            <div className="panelHeader">
              <div>
                <h2>Historico de execucoes</h2>
                <p>Testes e sincronizacoes executados pela integração.</p>
              </div>
            </div>
            <div className="timeline">
              {execucoesIntegracao.map((e) => (
                <article key={e.id}>
                  <i className={e.status}></i>
                  <div>
                    <strong>
                      {e.tipo === "teste"
                        ? "Teste de conexao"
                        : "Sincronizacao"}
                    </strong>
                    <span>{e.mensagem}</span>
                    <small>
                      {new Date(e.iniciadaEm).toLocaleString("pt-BR")} ·{" "}
                      {e.duracaoMs ?? 0} ms · {e.registrosRecebidos} recebido(s)
                      · {e.registrosInseridos} novo(s) ·{" "}
                      {e.registrosAtualizados} atualizado(s)
                    </small>
                  </div>
                  <Badge value={e.status} />
                </article>
              ))}
            </div>
          </section>
        )}
        {secaoIntegracao === "logs" && (
          <section className="panel">
            <div className="panelHeader">
              <div>
                <h2>Logs da integração</h2>
                <p>
                  Eventos técnicos, respostas HTTP, diagnóstico do contrato e
                  tempos de processamento.
                </p>
              </div>
            </div>
            <div className="timeline">
              {logsIntegracao.map((l) => (
                <article key={l.id}>
                  <i
                    className={
                      l.nivel === "erro"
                        ? "falha"
                        : l.nivel === "aviso"
                          ? "aviso"
                          : "sucesso"
                    }
                  ></i>
                  <div>
                    <strong>{l.evento.replace(/_/g, " ")}</strong>
                    <span>{l.mensagem}</span>
                    <small>
                      {new Date(l.criadoEm).toLocaleString("pt-BR")}
                      {l.statusHttp ? ` · HTTP ${l.statusHttp}` : ""}
                      {l.duracaoMs ? ` · ${l.duracaoMs} ms` : ""}
                    </small>
                  </div>
                  {l.detalhes ? (
                    <button onClick={() => setLogIntegracaoSelecionado(l)}>
                      Ver detalhes
                    </button>
                  ) : (
                    <Badge value={l.nivel} />
                  )}
                </article>
              ))}
            </div>
            {logIntegracaoSelecionado && (
              <Modal
                titulo="Detalhes do log"
                subtitulo={logIntegracaoSelecionado.evento.replace(/_/g, " ")}
                onClose={() => setLogIntegracaoSelecionado(null)}
              >
                <div className="jsonInspector">
                  <pre>
                    {JSON.stringify(logIntegracaoSelecionado.detalhes, null, 2)}
                  </pre>
                </div>
              </Modal>
            )}
          </section>
        )}
        {secaoIntegracao === "documentacao" && <DocumentacaoGmobii />}
      </div>
    ),
    apis: (
      <section>
        {modalCadastro === "apis" && (
          <Modal
            titulo={apiEditando ? "Editar API" : "Nova API"}
            onClose={() => {
              setModalCadastro(null);
              setApiEditando(null);
            }}
          >
            <form
              className="formStack modalForm"
              onSubmit={criarApi}
              key={apiEditando?.id ?? "nova-api"}
            >
              <div className="panelHeader">
                <h2>{apiEditando ? "Editar API" : "Criar API"}</h2>
                <div className="actions">
                  <button
                    type="button"
                    onClick={() => {
                      setModalCadastro(null);
                      setApiEditando(null);
                    }}
                  >
                    Cancelar
                  </button>
                  <button className="primary" type="submit">
                    {apiEditando ? "Salvar API" : "Criar rascunho"}
                  </button>
                </div>
              </div>
              <div className="formGrid">
                <label>
                  Nome
                  <input
                    name="nome"
                    required
                    defaultValue={apiEditando?.nome}
                    placeholder="Comissoes de parceiros"
                  />
                </label>
                <label>
                  Empresa
                  <select
                    name="clienteId"
                    required
                    defaultValue={apiEditando?.clienteId ?? clientes[0]?.id}
                  >
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nomeFantasia}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Codigo interno
                  <input
                    name="codigoInterno"
                    defaultValue={apiEditando?.codigoInterno}
                    placeholder="PARCEIROS_COMISSOES"
                  />
                </label>
                <label>
                  Versao
                  <input
                    name="versao"
                    defaultValue={apiEditando?.versao ?? "1.0.0"}
                  />
                </label>
                <label>
                  Metodo
                  <input
                    name="metodoHttp"
                    value="GET"
                    readOnly
                    title="Nesta versao, o API Hub publica somente APIs de consulta GET."
                  />
                </label>
                <label>
                  Endpoint
                  <input
                    name="endpoint"
                    required
                    defaultValue={apiEditando?.endpoint}
                    placeholder="/v1/minha-api"
                  />
                </label>
                <label>
                  Categoria
                  <input
                    name="categoria"
                    defaultValue={apiEditando?.categoria ?? "Corporativo"}
                  />
                </label>
                <label>
                  Conexao
                  <select
                    name="conexaoId"
                    required
                    defaultValue={apiEditando?.conexaoId ?? conexoes[0]?.id}
                  >
                    {conexoes.map((conexao) => (
                      <option key={conexao.id} value={conexao.id}>
                        {conexao.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="checkLine">
                  <input
                    name="paginacaoHabilitada"
                    type="checkbox"
                    defaultChecked={apiEditando?.paginacaoHabilitada ?? true}
                  />{" "}
                  Paginacao habilitada
                </label>
                <label>
                  Descricao
                  <textarea
                    name="descricao"
                    defaultValue={apiEditando?.descricao}
                    placeholder="Descreva a finalidade corporativa da API"
                  />
                </label>
              </div>
            </form>
          </Modal>
        )}
        <div className="panel">
          <div className="panelHeader">
            <h2>APIs cadastradas</h2>
            <button
              className="primary"
              onClick={() => {
                setApiEditando(null);
                setModalCadastro("apis");
              }}
            >
              + Nova API
            </button>
          </div>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Endpoint</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {apis.map((api) => (
                  <tr key={api.id}>
                    <td>{api.nome}</td>
                    <td>{api.endpoint}</td>
                    <td>
                      <Badge value={api.status} />
                    </td>
                    <td className="actionCell">
                      <button
                        onClick={() => {
                          setApiEditando(api);
                          setModalCadastro("apis");
                        }}
                      >
                        <Edit3 size={14} /> Editar
                      </button>
                      <button
                        onClick={() => {
                          const editor = aplicarApiNoEditor(api);
                          setApiSelecionadaId(editor.id);
                          setSqlAtual(editor.sql);
                          setParametrosTeste(editor.parametrosTeste);
                          setParametrosApiJson(editor.parametrosApi);
                          setRegrasApiJson(editor.regras);
                          setPagina("editor");
                        }}
                      >
                        <TerminalSquare size={14} /> SQL/Docs
                      </button>
                      <button
                        onClick={() => {
                          setApiSelecionadaId(api.id);
                          setApiEditando(api);
                        }}
                      >
                        <FileCode2 size={14} /> Docs
                      </button>
                      <button
                        onClick={() =>
                          window.open(
                            `${window.location.origin}/swagger`,
                            "_blank",
                          )
                        }
                      >
                        Swagger
                      </button>
                      {api.status === "publicado" ? (
                        <button onClick={() => despublicarApi(api.id)}>
                          Despublicar
                        </button>
                      ) : (
                        <button
                          className="primary"
                          onClick={() => publicarApi(api.id)}
                        >
                          Publicar
                        </button>
                      )}
                      <button
                        className="danger"
                        onClick={() => excluirApi(api.id)}
                      >
                        <Trash2 size={14} /> Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {(apiEditando || apiSelecionada) && (
          <div className="panel apiDocumentation">
            <div className="panelHeader">
              <h2>Documentacao da API</h2>
              <div className="actions">
                <button
                  onClick={() =>
                    window.open(
                      urlsDocumentacaoApi(
                        apiEditando ?? apiSelecionada,
                        publicacao,
                      ).swaggerLocal,
                      "_blank",
                    )
                  }
                >
                  Swagger local
                </button>
                {urlsDocumentacaoApi(apiEditando ?? apiSelecionada, publicacao)
                  .swaggerPublico && (
                  <button
                    onClick={() =>
                      window.open(
                        urlsDocumentacaoApi(
                          apiEditando ?? apiSelecionada,
                          publicacao,
                        ).swaggerPublico,
                        "_blank",
                      )
                    }
                  >
                    Swagger publicado
                  </button>
                )}
              </div>
            </div>
            {(() => {
              const api = apiEditando ?? apiSelecionada;
              const urls = urlsDocumentacaoApi(api, publicacao);
              return (
                <>
                  <div className="docGrid">
                    <div>
                      <span>Metodo</span>
                      <strong>{api?.metodoHttp || "GET"}</strong>
                    </div>
                    <div>
                      <span>Status</span>
                      <strong>{api?.status || "rascunho"}</strong>
                    </div>
                    <div>
                      <span>Rota</span>
                      <strong>{api?.endpoint || "/v1/sua-api"}</strong>
                    </div>
                    <div>
                      <span>Autenticacao</span>
                      <strong>Bearer Token</strong>
                    </div>
                  </div>
                  <label>
                    Endpoint local para teste
                    <input readOnly value={urls.endpointLocal} />
                  </label>
                  <label>
                    Swagger local
                    <input readOnly value={urls.swaggerLocal} />
                  </label>
                  <label>
                    OpenAPI local
                    <input readOnly value={urls.openApiLocal} />
                  </label>
                  {urls.endpointPublico ? (
                    <>
                      <label>
                        Endpoint publicado
                        <input readOnly value={urls.endpointPublico} />
                      </label>
                      <label>
                        Swagger publicado
                        <input readOnly value={urls.swaggerPublico} />
                      </label>
                      <label>
                        OpenAPI publicado
                        <input readOnly value={urls.openApiPublico} />
                      </label>
                    </>
                  ) : (
                    <p className="hint">
                      Configure o dominio da empresa em Dominios para exibir as
                      URLs publicadas.
                    </p>
                  )}
                  <pre>
                    {JSON.stringify(
                      api?.previewDocumentacao ?? {
                        metodoHttp: api?.metodoHttp || "GET",
                        rota: api?.endpoint || "/v1/sua-api",
                        urlLocal: urls.endpointLocal,
                        urlPublica: urls.endpointPublico || null,
                        autenticacao: "Bearer Token",
                        exemploResposta: {
                          sucesso: true,
                          meta: {
                            pagina: 1,
                            quantidadePorPagina: 100,
                            totalRegistros: 0,
                          },
                          dados: [],
                        },
                      },
                      null,
                      2,
                    )}
                  </pre>
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
              <button onClick={salvarSql}>
                <Save size={14} /> Salvar SQL
              </button>
              <button onClick={salvarParametrosApi}>
                <Save size={14} /> Salvar parametros
              </button>
              <button onClick={testarSql}>
                <Play size={14} /> Testar
              </button>
              <button className="primary" onClick={() => publicarApi()}>
                Publicar
              </button>
            </div>
          </div>
          <label>
            API
            <select
              value={apiSelecionada?.id ?? ""}
              onChange={(event) => {
                const api = apis.find((item) => item.id === event.target.value);
                const editor = aplicarApiNoEditor(api);
                setApiSelecionadaId(editor.id);
                setSqlAtual(editor.sql);
                setParametrosTeste(editor.parametrosTeste);
                setParametrosApiJson(editor.parametrosApi);
                setRegrasApiJson(editor.regras);
              }}
            >
              {apis.map((api) => (
                <option key={api.id} value={api.id}>
                  {api.nome}
                </option>
              ))}
            </select>
          </label>
          <textarea
            value={sqlAtual}
            onChange={(event) => setSqlAtual(event.target.value)}
            spellCheck={false}
          />
        </div>
        <div className="panel sidePanel">
          <h2>Documentacao da API</h2>
          <div className="docActions">
            <button
              onClick={() =>
                window.open(urlsApiSelecionada.swaggerLocal, "_blank")
              }
            >
              Swagger local
            </button>
            {urlsApiSelecionada.swaggerPublico && (
              <button
                onClick={() =>
                  window.open(urlsApiSelecionada.swaggerPublico, "_blank")
                }
              >
                Swagger publicado
              </button>
            )}
          </div>
          <label>
            Endpoint local
            <input readOnly value={urlsApiSelecionada.endpointLocal} />
          </label>
          {urlsApiSelecionada.endpointPublico && (
            <label>
              Endpoint publicado
              <input readOnly value={urlsApiSelecionada.endpointPublico} />
            </label>
          )}
          <h2>Resultado</h2>
          <pre className="resultBox">
            {resultadoTeste ||
              "Salve e teste o SQL para visualizar os campos inferidos e o envelope de resposta."}
          </pre>
          <h2>Parametros de teste</h2>
          <textarea
            className="paramText"
            value={parametrosTeste}
            onChange={(event) => setParametrosTeste(event.target.value)}
            spellCheck={false}
          />
          <h2>Parametros da API</h2>
          <textarea
            className="paramText tall"
            value={parametrosApiJson}
            onChange={(event) => setParametrosApiJson(event.target.value)}
            spellCheck={false}
          />
          <h2>Regras de validacao</h2>
          <textarea
            className="paramText tall"
            value={regrasApiJson}
            onChange={(event) => setRegrasApiJson(event.target.value)}
            spellCheck={false}
          />
          <h2>Campos publicos</h2>
          {(apiSelecionada?.campos ?? []).map((campo) => (
            <span className="fieldChip" key={campo.nomePublico}>
              {campo.nomePublico}
            </span>
          ))}
        </div>
      </section>
    ),
    consumidores: (
      <section>
        {modalCadastro === "consumidores" && (
          <Modal
            titulo={
              consumidorEditando ? "Editar consumidor" : "Novo consumidor"
            }
            onClose={() => {
              setModalCadastro(null);
              setConsumidorEditando(null);
            }}
          >
            <form
              className="formStack modalForm"
              onSubmit={salvarClienteConsumidor}
              key={consumidorEditando?.id ?? "novo-consumidor"}
            >
              <div className="panelHeader">
                <h2>
                  {consumidorEditando
                    ? "Editar cliente consumidor"
                    : "Novo cliente consumidor"}
                </h2>
                <div className="actions">
                  <button
                    type="button"
                    onClick={() => {
                      setModalCadastro(null);
                      setConsumidorEditando(null);
                    }}
                  >
                    Cancelar
                  </button>
                  <button className="primary" type="submit">
                    {consumidorEditando
                      ? "Salvar cliente"
                      : "Criar e gerar token"}
                  </button>
                </div>
              </div>
              <div className="formGrid">
                <label>
                  Nome do cliente
                  <input
                    name="nomeCliente"
                    required
                    defaultValue={consumidorEditando?.nomeCliente}
                    placeholder="Integrador, marketplace ou parceiro"
                  />
                </label>
                <label>
                  E-mail responsavel
                  <input
                    name="emailResponsavel"
                    type="email"
                    defaultValue={consumidorEditando?.emailResponsavel}
                    placeholder="integrador@cliente.com.br"
                  />
                </label>
                <label>
                  Telefone
                  <input
                    name="telefone"
                    defaultValue={consumidorEditando?.telefone}
                  />
                </label>
                <label>
                  Status
                  <select
                    name="status"
                    defaultValue={consumidorEditando?.status ?? "ativo"}
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </label>
                <label>
                  Expiracao do token
                  <input
                    name="dataExpiracaoToken"
                    type="date"
                    defaultValue={consumidorEditando?.dataExpiracaoToken?.slice(
                      0,
                      10,
                    )}
                  />
                </label>
                <label>
                  Descricao
                  <textarea
                    name="descricao"
                    defaultValue={consumidorEditando?.descricao}
                    placeholder="Finalidade do consumo da API"
                  />
                </label>
                <label>
                  Observacoes
                  <textarea
                    name="observacoes"
                    defaultValue={consumidorEditando?.observacoes}
                  />
                </label>
              </div>
            </form>
          </Modal>
        )}
        <div className="panel">
          <div className="panelHeader">
            <h2>Clientes consumidores</h2>
            <button
              className="primary"
              onClick={() => {
                setConsumidorEditando(null);
                setModalCadastro("consumidores");
              }}
            >
              + Novo consumidor
            </button>
          </div>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Responsavel</th>
                  <th>Token</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {clientesConsumidores.map((consumidor) => (
                  <tr key={consumidor.id}>
                    <td>{consumidor.nomeCliente}</td>
                    <td>{consumidor.emailResponsavel || "-"}</td>
                    <td>{consumidor.tokenMascarado}</td>
                    <td>
                      <Badge value={consumidor.status} />
                    </td>
                    <td className="actionCell">
                      <button
                        onClick={() => {
                          setConsumidorEditando(consumidor);
                          setModalCadastro("consumidores");
                        }}
                      >
                        <Edit3 size={14} /> Editar
                      </button>
                      <button
                        onClick={() => regenerarTokenConsumidor(consumidor.id)}
                      >
                        <KeyRound size={14} /> Regenerar token
                      </button>
                      <button
                        className="danger"
                        onClick={() => excluirClienteConsumidor(consumidor.id)}
                      >
                        <Trash2 size={14} /> Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    ),
    tokens: (
      <section>
        {modalCadastro === "tokens" && (
          <Modal
            titulo={tokenEditando ? "Editar token" : "Novo token"}
            onClose={() => {
              setModalCadastro(null);
              setTokenEditando(null);
            }}
          >
            <form
              className="formStack modalForm"
              onSubmit={salvarToken}
              key={tokenEditando?.id ?? "novo-token"}
            >
              <div className="panelHeader">
                <h2>{tokenEditando ? "Editar token" : "Novo token"}</h2>
                <div className="actions">
                  <button
                    type="button"
                    onClick={() => {
                      setModalCadastro(null);
                      setTokenEditando(null);
                    }}
                  >
                    Cancelar
                  </button>
                  <button className="primary" type="submit">
                    {tokenEditando ? "Salvar token" : "Gerar token"}
                  </button>
                </div>
              </div>
              <div className="formGrid">
                <label>
                  Nome
                  <input
                    name="nome"
                    required
                    defaultValue={tokenEditando?.nome}
                    placeholder="Token parceiro ecommerce"
                  />
                </label>
                <label>
                  Empresa
                  <select
                    name="clienteId"
                    required
                    defaultValue={tokenEditando?.clienteId ?? clientes[0]?.id}
                  >
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nomeFantasia}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Parceiro
                  <input
                    name="parceiro"
                    required
                    defaultValue={tokenEditando?.parceiro}
                    placeholder="Nome do integrador"
                  />
                </label>
                <label>
                  Status
                  <select
                    name="status"
                    defaultValue={tokenEditando?.status ?? "ativo"}
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </label>
                <label>
                  Expira em
                  <input
                    name="expiraEm"
                    type="date"
                    defaultValue={tokenEditando?.expiraEm?.slice(0, 10)}
                  />
                </label>
                <label>
                  Observacao
                  <textarea
                    name="observacao"
                    defaultValue={tokenEditando?.observacao}
                  />
                </label>
              </div>
            </form>
          </Modal>
        )}
        <div className="panel">
          <div className="panelHeader">
            <h2>Tokens cadastrados</h2>
            <button
              className="primary"
              onClick={() => {
                setTokenEditando(null);
                setModalCadastro("tokens");
              }}
            >
              + Novo token
            </button>
          </div>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Parceiro</th>
                  <th>Token</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((token) => (
                  <tr key={token.id}>
                    <td>{token.nome}</td>
                    <td>{token.parceiro}</td>
                    <td>{token.tokenMascarado}</td>
                    <td>
                      <Badge value={token.status} />
                    </td>
                    <td className="actionCell">
                      <button
                        onClick={() => {
                          setTokenEditando(token);
                          setModalCadastro("tokens");
                        }}
                      >
                        <Edit3 size={14} /> Editar
                      </button>
                      <button
                        className="danger"
                        onClick={() => excluirToken(token.id)}
                      >
                        <Trash2 size={14} /> Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    ),
    usuarios: podeGerenciarUsuarios ? (
      <section>
        {modalCadastro === "usuarios" && (
          <Modal
            titulo={usuarioEditando ? "Editar usuario" : "Novo usuario"}
            onClose={() => {
              setModalCadastro(null);
              setUsuarioEditando(null);
            }}
          >
            <form
              className="formStack modalForm"
              onSubmit={criarUsuario}
              key={usuarioEditando?.id ?? "novo-usuario"}
            >
              <div className="panelHeader">
                <h2>{usuarioEditando ? "Editar usuario" : "Novo usuario"}</h2>
                <div className="actions">
                  <button
                    type="button"
                    onClick={() => {
                      setModalCadastro(null);
                      setUsuarioEditando(null);
                    }}
                  >
                    Cancelar
                  </button>
                  <button className="primary" type="submit">
                    {usuarioEditando ? "Salvar usuario" : "Criar usuario"}
                  </button>
                </div>
              </div>
              <div className="formGrid">
                <label>
                  Nome
                  <input
                    name="nome"
                    required
                    defaultValue={usuarioEditando?.nome}
                    placeholder="Nome do usuario"
                  />
                </label>
                <label>
                  E-mail
                  <input
                    name="email"
                    type="email"
                    required
                    defaultValue={usuarioEditando?.email}
                    placeholder="usuario@empresa.com.br"
                  />
                </label>
                <label>
                  Perfil
                  <select
                    name="perfil"
                    required
                    defaultValue={usuarioEditando?.perfil ?? "operador"}
                  >
                    <option value="operador">Operador</option>
                    {isAdmin&&<option value="admin">Administrador</option>}
                    <option value="visualizador">Visualizador</option>
                  </select>
                </label>
                <label>
                  Status
                  <select
                    name="status"
                    defaultValue={usuarioEditando?.status ?? "ativo"}
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </label>
                <fieldset className="companyAccess">
                  <legend>Empresas com acesso</legend>
                  {clientes.map((cliente) => (
                    <label key={cliente.id} className="checkLine">
                      <input
                        name="empresasIds"
                        type="checkbox"
                        value={cliente.id}
                        defaultChecked={
                          usuarioEditando
                            ? usuarioEditando.empresasIds?.includes(cliente.id)
                            : clientes.length === 1
                        }
                      />
                      {cliente.nomeFantasia || cliente.nomeEmpresa}
                    </label>
                  ))}
                </fieldset>
                <label>
                  Perfil de acesso
                  <select
                    name="perfilAcessoId"
                    required
                    defaultValue={
                      usuarioEditando?.perfilAcessoId ??
                      (isAdmin?perfisAcesso.find((p)=>p.padrao):perfisAcesso.find((p)=>p.ativo))?.id
                    }
                  >
                    {perfisAcesso
                      .filter((p) => p.ativo&&(isAdmin||(!p.padrao&&!['admin','administrador'].includes(p.nome.trim().toLowerCase()))))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <p className="hint">
                A senha nao e definida pelo administrador. O usuario cria a
                propria senha no primeiro acesso.
              </p>
            </form>
          </Modal>
        )}
        <div className="panel">
          <div className="panelHeader">
            <h2>Usuarios cadastrados</h2>
            <button
              className="primary"
              onClick={() => {
                setUsuarioEditando(null);
                setModalCadastro("usuarios");
              }}
            >
              + Novo usuario
            </button>
          </div>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Primeiro acesso</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((usuario) => (
                  <tr key={usuario.id}>
                    <td>{usuario.nome}</td>
                    <td>{usuario.email}</td>
                    <td>{usuario.perfil}</td>
                    <td>{usuario.primeiroAcesso ? "pendente" : "concluido"}</td>
                    <td>
                      <Badge value={usuario.status} />
                    </td>
                    <td className="actionCell">
                      <button
                        onClick={() => {
                          setUsuarioEditando(usuario);
                          setModalCadastro("usuarios");
                        }}
                      >
                        <Edit3 size={14} /> Editar
                      </button>
                      {isAdmin?(
                        <button className="danger" onClick={() => excluirUsuario(usuario.id)}><Trash2 size={14} /> Excluir</button>
                      ):usuario.status==="ativo"?(
                        <button className="danger" onClick={()=>void inativarUsuario(usuario)}><UserX size={14}/> Inativar</button>
                      ):null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    ) : (
      <div className="panel">
        <h2>Acesso restrito</h2>
        <p>Seu perfil não permite gerenciar usuários.</p>
      </div>
    ),
    perfis: isAdmin ? (
      <section>
        {modalCadastro === "perfis" && (
          <Modal
            titulo={perfilEditando ? "Editar perfil" : "Novo perfil de acesso"}
            onClose={() => {
              setModalCadastro(null);
              setPerfilEditando(null);
            }}
          >
            <form className="formStack modalForm" onSubmit={salvarPerfilAcesso}>
              <div className="formGrid">
                <label>
                  Nome
                  <input
                    name="nome"
                    required
                    defaultValue={perfilEditando?.nome}
                  />
                </label>
                <label>
                  Status
                  <select
                    name="ativo"
                    defaultValue={String(perfilEditando?.ativo ?? true)}
                  >
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                </label>
                <label>
                  Descrição
                  <textarea
                    name="descricao"
                    defaultValue={perfilEditando?.descricao}
                  />
                </label>
              </div>
              <div className="profileAccessTabs" role="tablist" aria-label="Tipos de direito de acesso">
                <button type="button" className={abaPerfil==="menus"?"active":""} onClick={()=>setAbaPerfil("menus")}>Menus</button>
                <button type="button" className={abaPerfil==="acoes"?"active":""} onClick={()=>setAbaPerfil("acoes")}>Ações</button>
                <button type="button" className={abaPerfil==="alertas"?"active":""} onClick={()=>setAbaPerfil("alertas")}>Alertas</button>
              </div>
              <fieldset hidden={abaPerfil!=="menus"} className="companyAccess menuAccess profileAccessPanel">
                <legend>Menus permitidos</legend>
                {menu.map(([id, label]) => (
                  <label className="checkLine" key={id}>
                    <input name="menusPermitidos" type="checkbox" value={id} defaultChecked={perfilEditando?.menusPermitidos.includes(id) ?? true}/>
                    {label}
                  </label>
                ))}
              </fieldset>
              <fieldset hidden={abaPerfil!=="acoes"} className="companyAccess menuAccess profileAccessPanel">
                <legend>Ações permitidas</legend>
                {direitosAcoes.map(([id, label]) => (
                  <label className="checkLine" key={id}>
                    <input name="permissoesAcoes" type="checkbox" value={id} defaultChecked={perfilEditando?.permissoesAcoes?.includes(id) ?? true}/>
                    {label}
                  </label>
                ))}
              </fieldset>
              <fieldset hidden={abaPerfil!=="alertas"} className="companyAccess menuAccess profileAccessPanel">
                <legend>Alertas disponíveis</legend>
                {direitosAlertas.map(([id, label]) => (
                  <label className="checkLine" key={id}>
                    <input name="tiposAlerta" type="checkbox" value={id} defaultChecked={perfilEditando?.tiposAlerta?.includes(id) ?? true}/>
                    {label}
                  </label>
                ))}
              </fieldset>
              <div className="modalFooter">
                <button
                  type="button"
                  onClick={() => {
                    setModalCadastro(null);
                    setPerfilEditando(null);
                  }}
                >
                  Cancelar
                </button>
                <button className="primary" type="submit">
                  Salvar perfil
                </button>
              </div>
            </form>
          </Modal>
        )}
        <div className="panel">
          <div className="panelHeader">
            <div>
              <h2>Direitos de acesso</h2>
              <p>
                Os usuários herdam os menus permitidos pelo perfil selecionado.
              </p>
            </div>
            <button
              className="primary"
              onClick={() => {
                setPerfilEditando(null);
                setAbaPerfil("menus");
                setModalCadastro("perfis");
              }}
            >
              + Novo perfil
            </button>
          </div>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Perfil</th>
                  <th>Descrição</th>
                  <th>Menus</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {perfisAcesso.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.nome}</strong>
                      {p.padrao ? " · padrão" : ""}
                    </td>
                    <td>{p.descricao || "-"}</td>
                    <td>{p.menusPermitidos.length}</td>
                    <td>
                      <Badge value={p.ativo ? "ativo" : "inativo"} />
                    </td>
                    <td className="actionCell">
                      <button
                        onClick={() => {
                          setPerfilEditando(p);
                          setAbaPerfil("menus");
                          setModalCadastro("perfis");
                        }}
                      >
                        <Edit3 size={14} /> Editar
                      </button>
                      {!p.padrao && (
                        <button
                          className="danger"
                          onClick={() => excluirPerfilAcesso(p.id)}
                        >
                          <Trash2 size={14} /> Excluir
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    ) : (
      <div className="panel">
        <h2>Acesso restrito</h2>
      </div>
    ),
    logs: (
      <div className="panel">
        <div className="panelHeader">
          <h2>Logs</h2>
          <button onClick={() => carregarDados()}>
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Horário</th>
                <th>API</th>
                <th>Status</th>
                <th>Latência</th>
                <th>Origem</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatarData(log.horario)}</td>
                  <td>{log.apiId}</td>
                  <td>
                    <Badge value={log.statusHttp} />
                  </td>
                  <td>{log.latenciaMs} ms</td>
                  <td>{log.origemIp}</td>
                  <td className="actionCell">
                    <button
                      className="danger"
                      onClick={() => excluirLog(log.id)}
                    >
                      <Trash2 size={14} /> Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ),
    dominios: (
      <section className="gridTwo settingsGrid">
        <form className="panel formStack" onSubmit={salvarPublicacao}>
          <div className="panelHeader">
            <h2>Dominios e publicacao</h2>
            <button className="primary" type="submit">
              <Save size={14} /> Salvar URL publica
            </button>
          </div>
          <div className="formGrid">
            <label>
              Ambiente
              <select name="ambiente" defaultValue={publicacao.ambiente}>
                <option value="local">Local</option>
                <option value="homologacao">Homologacao</option>
                <option value="producao">Producao</option>
              </select>
            </label>
            <label>
              Dominio principal
              <input
                name="dominioPrincipal"
                required
                defaultValue={publicacao.dominioPrincipal}
                placeholder="cliente.com.br"
              />
            </label>
            <label>
              Subdominio da API
              <input
                name="subdominioApi"
                required
                defaultValue={publicacao.subdominioApi}
                placeholder="api.cliente.com.br"
              />
            </label>
            <label>
              URL local do servidor
              <input
                name="urlBaseLocal"
                defaultValue={window.location.origin}
                placeholder="http://IP_DO_SERVIDOR:3333"
              />
            </label>
            <label>
              URL base da API
              <input
                name="urlBaseApi"
                required
                defaultValue={publicacao.urlBaseApi}
                placeholder="https://api.cliente.com.br"
              />
            </label>
            <label>
              URL da documentacao
              <input
                name="urlBaseDocumentacao"
                required
                defaultValue={publicacao.urlBaseDocumentacao}
                placeholder="https://api.cliente.com.br/swagger"
              />
            </label>
          </div>
          <p className="hint">
            Esta tela define a URL que aparecera no Swagger/OpenAPI e no passo
            de entrega ao cliente. Na arquitetura com Nginx, a porta publica
            interna e 3333 e o backend Node roda na 3335.
          </p>
        </form>
        <div className="panel documentation">
          <div className="panelHeader">
            <h2>Previa de publicacao</h2>
            <button
              onClick={() =>
                window.open(publicacao.urlBaseDocumentacao, "_blank")
              }
            >
              Abrir documentacao
            </button>
          </div>
          <p>
            Use estes enderecos para validar a publicacao e entregar ao
            integrador.
          </p>
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
          <div className="panelHeader">
            <h2>Identidade do cliente</h2>
            <button className="primary" type="submit">
              Aplicar marca
            </button>
          </div>
          <div className="formGrid">
            <label>
              Nome exibido no topo
              <input
                name="nomeLoja"
                value={identidadeForm.nomeLoja}
                onChange={(event) =>
                  setIdentidadeForm((atual) => ({
                    ...atual,
                    nomeLoja: event.target.value,
                  }))
                }
                placeholder="Ar Condicionado"
              />
            </label>
            <label>
              Descricao curta
              <input
                name="descricaoCurta"
                value={identidadeForm.descricaoCurta ?? ""}
                onChange={(event) =>
                  setIdentidadeForm((atual) => ({
                    ...atual,
                    descricaoCurta: event.target.value,
                  }))
                }
                placeholder="Empresa integrada"
              />
            </label>
            <label>
              Logo do cliente
              <input
                name="logoArquivo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
              />
            </label>
          </div>
          <p className="hint">
            Use uma imagem horizontal ou quadrada em JPG, PNG ou WEBP. A lateral
            continua fixa com Control S; a marca do cliente fica estatica no
            canto direito do topo.
          </p>
        </form>
        <div className="panel brandPreview">
          <h2>Previa</h2>
          <MarcaLoja identidade={identidadeLoja} />
          <p>
            A marca da loja aparece como contexto da integração, sem alterar o
            nome do sistema.
          </p>
        </div>
        <form className="panel formStack notificationSettings" onSubmit={salvarNotificacoes} style={{gridColumn:"1 / -1"}}>
          <div className="panelHeader">
            <div><h2>Central de notificações</h2><p>Defina quais problemas enviam e-mail, para quem e quando.</p></div>
            <div className="actions"><button type="button" onClick={testarNotificacoes} disabled={!configuracaoNotificacao.provedorConfigurado}>Testar envio</button><button className="primary" type="submit">Salvar notificações</button></div>
          </div>
          <div className={configuracaoNotificacao.provedorConfigurado?"statusBar":"statusBar error"}><span>{configuracaoNotificacao.provedorConfigurado?`Envio ativo pelo remetente ${configuracaoNotificacao.remetente}.`:`A tela está pronta. Falta validar controlsone.com.br e configurar a chave do Resend para liberar os envios.`}</span></div>
          <div className="formGrid">
            <label>Chave segura do provedor<input type="password" autoComplete="new-password" value={configuracaoNotificacao.chaveResend??""} onChange={e=>setConfiguracaoNotificacao({...configuracaoNotificacao,chaveResend:e.target.value})} placeholder={configuracaoNotificacao.provedorConfigurado?"Chave protegida · deixe vazio para manter":"Cole a chave do Resend"}/></label>
            <label className="checkLine"><input type="checkbox" checked={configuracaoNotificacao.ativo} onChange={e=>setConfiguracaoNotificacao({...configuracaoNotificacao,ativo:e.target.checked})}/>Ativar notificações por e-mail</label>
            <label>Início da janela<input type="time" value={configuracaoNotificacao.inicio} onChange={e=>setConfiguracaoNotificacao({...configuracaoNotificacao,inicio:e.target.value})}/></label>
            <label>Fim da janela<input type="time" value={configuracaoNotificacao.fim} onChange={e=>setConfiguracaoNotificacao({...configuracaoNotificacao,fim:e.target.value})}/></label>
            <label>Repetir a cada (minutos)<input type="number" min="5" max="1440" value={configuracaoNotificacao.intervaloMinutos} onChange={e=>setConfiguracaoNotificacao({...configuracaoNotificacao,intervaloMinutos:Number(e.target.value)})}/></label>
          </div>
          {(()=>{const regra=configuracaoNotificacao.tipos.erro_api;return <section className="notificationRule"><div><h3>Erro interno de API</h3><p>Respostas HTTP 500 ou superiores nas APIs publicadas.</p></div><div className="formGrid"><label className="checkLine"><input type="checkbox" checked={regra.ativo} onChange={e=>setConfiguracaoNotificacao({...configuracaoNotificacao,tipos:{...configuracaoNotificacao.tipos,erro_api:{...regra,ativo:e.target.checked}}})}/>Usar esta notificação</label><label className="checkLine"><input type="checkbox" checked={regra.envioImediato} onChange={e=>setConfiguracaoNotificacao({...configuracaoNotificacao,tipos:{...configuracaoNotificacao.tipos,erro_api:{...regra,envioImediato:e.target.checked}}})}/>Enviar assim que ocorrer</label><label className="checkLine"><input type="checkbox" checked={regra.repetirEnquantoAberto} onChange={e=>setConfiguracaoNotificacao({...configuracaoNotificacao,tipos:{...configuracaoNotificacao.tipos,erro_api:{...regra,repetirEnquantoAberto:e.target.checked}}})}/>Repetir enquanto estiver aberto</label><label>Destinatários<input type="text" value={regra.destinatarios.join('; ')} placeholder="email1@empresa.com.br; email2@empresa.com.br" onChange={e=>setConfiguracaoNotificacao({...configuracaoNotificacao,tipos:{...configuracaoNotificacao.tipos,erro_api:{...regra,destinatarios:e.target.value.split(/[;,]/).map(v=>v.trim()).filter(Boolean)}}})}/><small className="inputHint">Para mais de um destinatário, separe os e-mails com ponto e vírgula (;).</small></label></div></section>})()}
          <p className="hint">A janela utiliza o horário de Brasília. Todos os pedidos com problema são agrupados em um único e-mail. O envio imediato acontece no momento da falha; a repetição continua no intervalo escolhido até os alertas serem resolvidos.</p>
        </form>
      </section>
    ),
  };

  return (
    <div className={compacto ? "app compact" : "app"}>
      <aside>
        <Logo compacto={compacto} />
        <nav>
          {gruposMenu.map((grupo) => {
            const itens = grupo.itens
              .map((id) => menuVisivel.find(([menuId]) => menuId === id))
              .filter(Boolean) as typeof menu;
            if (!itens.length) return null;
            const aberto = compacto || gruposAbertos.includes(grupo.id);
            const GrupoIcone = grupo.icone;
            return (
              <div
                className={`navGroup ${aberto ? "open" : ""}`}
                key={grupo.id}
              >
                <button
                  className={
                    itens.some(([id]) => id === pagina) ? "groupActive" : ""
                  }
                  onClick={() =>
                    compacto
                      ? setPagina(itens[0][0])
                      : setGruposAbertos((atual) =>
                          atual.includes(grupo.id)
                            ? atual.filter((id) => id !== grupo.id)
                            : [...atual, grupo.id],
                        )
                  }
                  title={grupo.titulo}
                >
                  <GrupoIcone size={18} />
                  {!compacto && (
                    <>
                      <span>{grupo.titulo}</span>
                      <ChevronDown className="groupChevron" size={14} />
                    </>
                  )}
                </button>
                {aberto && !compacto && (
                  <div className="navSubmenu">
                    {grupo.id === "integracoes" ? (
                      <div className="integrationNavItem">
                        <button
                          className={pagina === "integracoes" ? "active" : ""}
                          onClick={() => {
                            setPagina("integracoes");
                            setSecaoIntegracao("dados");
                          }}
                        >
                          <PlugZap size={15} />
                          <span>GMOBii</span>
                        </button>
                        {pagina === "integracoes" && (
                          <div className="navThirdLevel">
                            <button
                              className={
                                secaoIntegracao === "indicadores"
                                  ? "active"
                                  : ""
                              }
                              onClick={() => setSecaoIntegracao("indicadores")}
                            >
                              Indicadores - GMOBii
                            </button>
                            <button
                              className={
                                secaoIntegracao === "integrados" ? "active" : ""
                              }
                              onClick={() => setSecaoIntegracao("integrados")}
                            >
                              Dados integrados
                            </button>
                            <button
                              className={
                                secaoIntegracao === "dados" ? "active" : ""
                              }
                              onClick={() => setSecaoIntegracao("dados")}
                            >
                              Dados coletados
                            </button>
                            <button
                              className={
                                secaoIntegracao === "historico" ? "active" : ""
                              }
                              onClick={() => setSecaoIntegracao("historico")}
                            >
                              Histórico
                            </button>
                            <button
                              className={
                                secaoIntegracao === "logs" ? "active" : ""
                              }
                              onClick={() => setSecaoIntegracao("logs")}
                            >
                              Logs
                            </button>
                            <button
                              className={
                                secaoIntegracao === "documentacao"
                                  ? "active"
                                  : ""
                              }
                              onClick={() => setSecaoIntegracao("documentacao")}
                            >
                              Documentação
                            </button>
                            {podeConfigurarIntegracao&&<><button
                              className={
                                secaoIntegracao === "conexao" ? "active" : ""
                              }
                              onClick={() => setSecaoIntegracao("conexao")}
                            >
                              Conexão GMOBii
                            </button>
                            <button
                              className={
                                secaoIntegracao === "construshow"
                                  ? "active"
                                  : ""
                              }
                              onClick={() => setSecaoIntegracao("construshow")}
                            >
                              Conf. Construshow
                            </button></>}
                          </div>
                        )}
                      </div>
                    ) : (
                      itens.map(([id, label, Icon]) => (
                        <button
                          key={id}
                          className={pagina === id ? "active" : ""}
                          onClick={() => setPagina(id)}
                        >
                          <Icon size={15} />
                          <span>{label}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <button
          className="collapse"
          onClick={() => setCompacto((value) => !value)}
        >
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
            <h1>
              {pagina === "integracoes"
                ? `${secaoIntegracao === "indicadores" ? "Indicadores" : secaoIntegracao === "dados" ? "Dados coletados" : secaoIntegracao === "historico" ? "Histórico" : secaoIntegracao === "logs" ? "Logs" : secaoIntegracao === "documentacao" ? "Documentação" : secaoIntegracao === "construshow" ? "Configuração Construshow" : "Conexão"} - GMOBii`
                : titulo === "Dashboard"
                  ? "Dashboard Executivo"
                  : titulo}
            </h1>
            <p>{subtitulosPagina[pagina]}</p>
          </div>
          <div className="clientBrand">
            <MarcaLoja identidade={identidadeLoja} />
          </div>
          <button
            className={`notificationButton ${alertasNotificacao.some((a) => !a.lido) ? "hasAlerts" : ""}`}
            onClick={() => void abrirAlertas()}
            title="Abrir central de alertas"
          >
            <BellRing size={19} />
            <span className="notificationLabel">Alertas</span>
            <strong>{alertasNotificacao.filter((a) => !a.lido).length}</strong>
            {alertasNotificacao.some((a) => !a.lido) && (
              <i className="notificationDot" />
            )}
          </button>
          <button
            className="logoutButton"
            onClick={sair}
            title="Sair e voltar ao login"
          >
            <LogOut size={16} />
            <span>Sair</span>
          </button>
        </header>
        {(mensagem || erro) && (
          <Modal
            titulo={erro ? "Nao foi possivel concluir" : "Tudo certo"}
            tipo={erro ? "erro" : "sucesso"}
            onClose={() => {
              setMensagem("");
              setErro("");
            }}
          >
            <p className="modalMessage">{erro || mensagem}</p>
            <div className="modalFooter">
              <button
                className="primary"
                onClick={() => {
                  setMensagem("");
                  setErro("");
                }}
              >
                Entendi
              </button>
            </div>
          </Modal>
        )}
        {modalAlertas && (
          <Modal
            titulo="Alertas da plataforma"
            subtitulo="Pendências que precisam ser conferidas antes da integração."
            onClose={() => setModalAlertas(false)}
          >
            <div className="platformAlerts">
              {alertasNotificacao.length ? (
                alertasNotificacao.map((a) => (
                  <article className={a.lido ? "read" : ""} key={a.id}>
                    <AlertTriangle size={20} />
                    <div>
                      <strong>{a.titulo}</strong>
                      <p>{mensagemIntegracaoSegura(a.mensagem)}</p>
                      <small>
                        {new Date(a.criadoEm).toLocaleString("pt-BR")} ·
                        Severidade: {a.severidade}
                      </small>
                    </div>
                    <div className="alertActions">
                      {a.detalhes && (
                        <button onClick={() => abrirConferenciaPedido(String(a.detalhes?.numeroPedido??""),a)}>
                          Ver conferência
                        </button>
                      )}
                      {!a.lido && (
                        <button
                          className="primary"
                          onClick={() => marcarAlertaLido(a.id)}
                        >
                          Marcar resolvido
                        </button>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <div className="emptyState">Nenhum problema detectado.</div>
              )}
            </div>
          </Modal>
        )}
        {alertaSelecionado && (
          <Modal
            titulo={`Conferência do pedido ${alertaSelecionado.detalhes?.numeroPedido ?? ""}`}
            subtitulo=""
            onClose={() => setAlertaSelecionado(null)}
          >
            <div className="contractAudit">
              <div className="auditLegend" aria-label="Filtrar campos pela situação">
                {categoriasAuditoria.map(([categoria, rotulo]) => (
                  <button
                    type="button"
                    key={categoria}
                    className={`${categoria} ${filtroAuditoria === categoria ? "active" : ""}`}
                    onClick={() => setFiltroAuditoria((atual) => atual === categoria ? null : categoria)}
                    title={`Mostrar somente: ${rotulo}`}
                  >
                    {rotulo}
                    <strong>{linhasAuditoria.filter((campo: any) => campo.categoria === categoria).length}</strong>
                  </button>
                ))}
              </div>
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Campo verificado</th>
                      <th>Situação</th>
                      <th>Valor recebido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasAuditoriaVisiveis.map((c: any) => (
                      <tr key={c.campo}>
                        <td>
                          <strong>{c.campo}{campoObrigatorioAuditoria(c.campo) && <span className="requiredMark" title="Campo obrigatório"> *</span>}</strong>
                        </td>
                        <td>
                          <span className={`auditStatus ${c.categoria}`}>
                            {c.categoria === "aguardando_validacao_erp"
                              ? "Aguardando validação ERP"
                              : c.categoria === "cadastro_invalido_erp"
                              ? "Cadastro sem classificação"
                              : c.categoria === "nao_localizado_erp"
                              ? "Não localizado no ERP"
                              : c.categoria === "obrigatorio_faltante"
                              ? "Obrigatório faltante"
                              : c.estado === "preenchido"
                              ? "Preenchido"
                              : c.estado === "nulo_recebido"
                                ? "Nulo recebido"
                                : c.estado === "em_branco"
                                  ? "Em branco"
                                : "Ausente no JSON"}
                          </span>
                        </td>
                        <td>
                          <code>
                            {c.estado === "ausente"
                              ? "— não enviado —"
                              : c.valor === null
                                ? "null"
                                : valorAuditoriaEmBranco(c.valor)
                                  ? "— em branco —"
                                : typeof c.valor === "object"
                                  ? JSON.stringify(c.valor)
                                  : String(c.valor)}
                          </code>
                          {c.mensagem && <small className="auditMessage">{c.mensagem}</small>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="modalFooter">
                <button
                  onClick={() =>
                    window.open(
                      "/documentacao/gmobii-original.pdf",
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                >
                  Ver documentação original
                </button>
                <button
                  className="primary"
                  onClick={() => setAlertaSelecionado(null)}
                >
                  Fechar
                </button>
              </div>
            </div>
          </Modal>
        )}
        {dadoJsonSelecionado && (
          <Modal
            titulo={`Pedido ${dadoJsonSelecionado.chaveExterna}`}
            subtitulo="Conferência única dos dados coletados, validações e integração com o Construshow."
            onClose={() => {setDadoJsonSelecionado(null);setIntegracaoPedidoSelecionado(null)}}
          >
            {dadoJsonSelecionado.excluido&&<div className="deletedOrderNotice"><strong>Pedido excluído logicamente</strong><span>Excluído por {dadoJsonSelecionado.excluidoPorNome??"usuário não identificado"} em {formatarData(dadoJsonSelecionado.excluidoEm)}. Este pedido não participa da integração.</span></div>}
            {integracaoPedidoSelecionado && (
              <>
                <div className="detailSectionTitle">
                  <div>
                    <span className="eyebrow">Situação no Construshow</span>
                    <h3>Integração do pedido</h3>
                  </div>
                  <Badge value={integracaoPedidoSelecionado.status} />
                </div>
                <div className="orderDetail integrationSummary">
                  <div><span>Estabelecimento</span><strong>{integracaoPedidoSelecionado.estab || "-"}</strong></div>
                  <div><span>Número do carrinho</span><strong>{integracaoPedidoSelecionado.id_carrinho ?? "Não gerado"}</strong></div>
                  <div><span>Número da nota</span><strong>{integracaoPedidoSelecionado.id_nota ?? "Ainda não gerada"}</strong></div>
                  <div><span>Situação do carrinho</span><strong>{descricaoSituacaoCarrinho(integracaoPedidoSelecionado.situacao_carrinho)}</strong></div>
                  <div><span>Passou no caixa</span><strong>{integracaoPedidoSelecionado.passou_caixa === "S" ? "Sim" : "Não"}</strong></div>
                  <div><span>Retorno de aprovação</span><strong>{integracaoPedidoSelecionado.aprovacao_status ?? "Aguardando passagem no caixa"}</strong></div>
                </div>
                {integracaoPedidoSelecionado.status === "erro" && (
                  <div className="integrationError" role="alert">
                    <div className="integrationErrorTitle"><AlertTriangle size={20}/><strong>Erro na integração</strong></div>
                    <p>{mensagemIntegracaoSegura(integracaoPedidoSelecionado.mensagem) || "O carrinho não foi gerado."}</p>
                    <dl>
                      <div><dt>Etapa</dt><dd>{String(integracaoPedidoSelecionado.dados_construshow?.etapa ?? "Não identificada")}</dd></div>
                      <div><dt>Código Oracle</dt><dd>{String(integracaoPedidoSelecionado.dados_construshow?.codigoOracle ?? "-")}</dd></div>
                      {integracaoPedidoSelecionado.dados_construshow?.campoOracle&&<div><dt>Campo com erro</dt><dd><strong>{String(integracaoPedidoSelecionado.dados_construshow.campoOracle)}</strong></dd></div>}
                      {integracaoPedidoSelecionado.dados_construshow?.campoOrigem&&<div><dt>Origem do valor</dt><dd>{String(integracaoPedidoSelecionado.dados_construshow.campoOrigem)}</dd></div>}
                      {integracaoPedidoSelecionado.dados_construshow?.valorRecebido!==undefined&&<div><dt>Valor recebido</dt><dd>{String(integracaoPedidoSelecionado.dados_construshow.valorRecebido)}</dd></div>}
                      <div><dt>Como tratar</dt><dd>{String(integracaoPedidoSelecionado.dados_construshow?.orientacao ?? "Confira a conferência abaixo antes de tentar novamente.")}</dd></div>
                    </dl>
                    {integracaoPedidoSelecionado.dados_construshow?.codigoCopiar&&<div className="copyDiagnostic"><pre>{String(integracaoPedidoSelecionado.dados_construshow.codigoCopiar)}</pre><button type="button" onClick={async()=>{await navigator.clipboard.writeText(String(integracaoPedidoSelecionado.dados_construshow?.codigoCopiar));avisar("Diagnóstico copiado.")}}>Copiar diagnóstico</button></div>}
                  </div>
                )}
              </>
            )}
            {(() => {
              const alerta=alertaDoPedido(dadoJsonSelecionado);
              const detalhes=alerta?.detalhes as any;
              const campos=(detalhes?.campos??[]).filter((campo:any)=>
                campoObrigatorioAuditoria(campo.campo) &&
                (campo.estado!=="preenchido" || valorAuditoriaEmBranco(campo.valor))
              );
              const divergencias=detalhes?.divergenciasErp??[];
              const erro=integracaoPedidoSelecionado?.status==="erro" ? [{
                campo:"Integração Construshow",
                situacao:"Erro na integração",
                valor:mensagemIntegracaoSegura(integracaoPedidoSelecionado.mensagem)||"Falha não detalhada",
              }] : [];
              const linhas=[
                ...campos.map((campo:any)=>({campo:nomeCampoConferencia(campo,dadoJsonSelecionado.conteudo),situacao:"Obrigatório faltante",valor:campo.valor})),
                ...divergencias.map((item:any)=>({campo:item.rotulo??item.campo,situacao:detalhes?.tipoProblema==="aguardando_validacao_erp"?"Aguardando validação ERP":item.tipo==="marcacao_obrigatoria"?`Cadastro Não é ${item.entidade==="cliente"?"Cliente":"Vendedor"}`:"Não localizado no ERP",valor:item.mensagem??item.valor})),
                ...erro,
              ];
              if(!linhas.length)return <div className="conferenceOk"><CheckCircle2 size={18}/><span>Conferência concluída sem pendências.</span></div>;
              return (
                <div className="conferencePanel">
                  <div className="detailSectionTitle"><div><span className="eyebrow">Conferência</span><h3>O que precisa ser tratado</h3></div><strong>{linhas.length} pendência(s)</strong></div>
                  <div className="tableWrap">
                    <table>
                      <thead><tr><th>Campo / etapa</th><th>Situação</th><th>Detalhe</th></tr></thead>
                      <tbody>{linhas.map((linha:any,indice:number)=><tr key={`${linha.campo}-${indice}`}><td><strong>{linha.campo}</strong></td><td><span className="auditStatus obrigatorio_faltante">{linha.situacao}</span></td><td>{linha.valor===null?"null":String(linha.valor??"Não informado")}</td></tr>)}</tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
            <div className="detailSectionTitle"><div><span className="eyebrow">Dados coletados</span><h3>Informações básicas do pedido</h3></div></div>
            <div className="orderDetail">
              {colunasPedido.map(([id, label]) => (
                <div key={id}>
                  <span>{label}</span>
                  <strong>
                    {id === "itens"
                      ? Array.isArray(dadoJsonSelecionado.conteudo[id])
                        ? `${dadoJsonSelecionado.conteudo[id].length} item(ns)`
                        : "Não informado"
                      : id.startsWith("data_")
                        ? formatarData(dadoJsonSelecionado.conteudo[id])
                        : String(valorColunaPedido(dadoJsonSelecionado,id) ?? "Não informado")}
                  </strong>
                </div>
              ))}
            </div>
            {Array.isArray(dadoJsonSelecionado.conteudo.itens) &&
              dadoJsonSelecionado.conteudo.itens.length > 0 && (
                <div className="tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Descrição</th>
                        <th>Quantidade</th>
                        <th>Unidade</th>
                        <th>Valor</th>
                        <th>Código ERP</th>
                        <th>Validação ERP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dadoJsonSelecionado.conteudo.itens.map(
                        (item: any, index: number) => (
                          <tr key={index}>
                            <td>{item.codigo ?? "-"}</td>
                            <td>{item.descricao ?? "-"}</td>
                            <td>{item.quantidade ?? "-"}</td>
                            <td>{item.unidade ?? "-"}</td>
                            <td>{item.valor ?? "-"}</td>
                            <td>{dadoJsonSelecionado.validacaoErp?.detalhes.produtos?.find(p=>p.indice===index+1)?.codigoErp??"-"}</td>
                            <td>{dadoJsonSelecionado.validacaoErp?.detalhes.produtos?.find(p=>p.indice===index+1)?.encontrado?"Localizado":"Não localizado"}</td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            <div className="completeJson">
              <div>
                <span className="eyebrow">JSON completo do contrato</span>
                <p>
                  Todos os campos são exibidos, inclusive os recebidos como
                  null.
                </p>
              </div>
              <div className="jsonInspector">
                <pre>
                  {JSON.stringify(
                    jsonCompletoPedido(dadoJsonSelecionado),
                    null,
                    2,
                  )}
                </pre>
              </div>
            </div>
            {integracaoPedidoSelecionado?.status === "erro" && (
              <div className="modalFooter">
                {podeExcluirPedido && <button className="danger" onClick={()=>{const item=integracaoPedidoSelecionado;setDadoJsonSelecionado(null);setIntegracaoPedidoSelecionado(null);setIntegradoParaExcluir(item)}}>Excluir da integração</button>}
                <button className="primary" onClick={()=>{const item=integracaoPedidoSelecionado;setDadoJsonSelecionado(null);setIntegracaoPedidoSelecionado(null);setIntegradoParaReprocessar(item)}}>Tentar integrar novamente</button>
              </div>
            )}
          </Modal>
        )}
        {conteudo[pagina]}
        <footer>
          CONTROL S CONSULTORIA - Direitos Reservados | CNPJ: 21.421.411/0001-20
        </footer>
      </main>
    </div>
  );
}

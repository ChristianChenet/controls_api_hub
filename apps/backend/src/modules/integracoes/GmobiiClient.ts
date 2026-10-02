import { env } from '../../config/env.js';

export interface ItemGmobii { codigo: string | null; descricao: string; quantidade: number; unidade: string; valor: number | null }
export interface PedidoGmobii {
  numero_pedido: string;
  cliente: string | null;
  cliente_documento: string | null;
  vendedor: string | null;
  vendedor_documento: string | null;
  empresa: string | null;
  empresa_documento: string | null;
  tipo_servico: string | null;
  data_criacao: string;
  data_envio_producao: string;
  observacoes: string | null;
  chapas_total: number | null;
  deslocamentos: number | null;
  fita_borda_m: number | null;
  itens: ItemGmobii[] | null;
  [campo: string]: unknown;
}

type RespostaLista = { pedidos?: PedidoGmobii[]; total?: number; proximo_desde?: string; erro?: string; mensagem?: string };

export class ErroIntegracao extends Error {
  constructor(message: string, public codigo: string, public statusHttp?: number) { super(message); }
}

export class GmobiiClient {
  async listar(urlBase: string, token: string, desde?: string, limite = 200) {
    const url = new URL(urlBase);
    if (desde) url.searchParams.set('desde', desde);
    url.searchParams.set('limite', String(Math.min(Math.max(limite, 1), 200)));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.integrationTimeoutMs);
    const inicio = Date.now();
    try {
      const resposta = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: controller.signal });
      const corpo = await resposta.json().catch(() => ({})) as RespostaLista;
      if (!resposta.ok) throw new ErroIntegracao(corpo.mensagem || this.mensagemStatus(resposta.status), corpo.erro || `HTTP_${resposta.status}`, resposta.status);
      if (!Array.isArray(corpo.pedidos)) throw new ErroIntegracao('A GMOBii retornou uma resposta fora do formato esperado.', 'RESPOSTA_INVALIDA', resposta.status);
      return { pedidos: corpo.pedidos, total: corpo.total ?? corpo.pedidos.length, proximoDesde: corpo.proximo_desde, statusHttp: resposta.status, duracaoMs: Date.now() - inicio };
    } catch (error) {
      if (error instanceof ErroIntegracao) throw error;
      if (error instanceof Error && error.name === 'AbortError') throw new ErroIntegracao('A GMOBii nao respondeu dentro do tempo limite.', 'TEMPO_LIMITE');
      throw new ErroIntegracao(error instanceof Error ? error.message : 'Falha de comunicacao com a GMOBii.', 'FALHA_COMUNICACAO');
    } finally { clearTimeout(timeout); }
  }

  private mensagemStatus(status: number) {
    if (status === 401) return 'Token ausente, invalido ou revogado.';
    if (status === 404) return 'Recurso nao encontrado na GMOBii.';
    if (status >= 500) return 'A GMOBii apresentou uma falha temporaria.';
    return `A GMOBii respondeu com o status HTTP ${status}.`;
  }
}

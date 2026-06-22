import { ApiCadastrada } from '../../domain/types.js';
import { erro, sucesso } from '../../http/responses.js';

type Query = Record<string, string | undefined>;

function normalizarDocumento(valor?: string) {
  return valor?.replace(/\D/g, '');
}

function diferencaDias(dataInicial: string, dataFinal: string) {
  const inicio = new Date(`${dataInicial}T00:00:00`);
  const fim = new Date(`${dataFinal}T00:00:00`);
  return Math.ceil((fim.getTime() - inicio.getTime()) / 86400000) + 1;
}

export class ApiExecutionEngine {
  executarParceirosComissoes(api: ApiCadastrada, query: Query) {
    const documentoParceiro = normalizarDocumento(query.documentoParceiro);
    const dataInicial = query.dataInicial;
    const dataFinal = query.dataFinal;
    const pagina = Number(query.pagina ?? 1);
    const quantidadePorPagina = Math.min(Number(query.quantidadePorPagina ?? 100), api.regras.quantidadeMaximaPorPagina ?? 100);

    if (!documentoParceiro && (!dataInicial || !dataFinal)) {
      return {
        status: 400,
        body: erro(
          'FILTRO_OBRIGATORIO_NAO_INFORMADO',
          'Informe documentoParceiro ou o periodo completo com dataInicial e dataFinal.'
        )
      };
    }

    if ((dataInicial && !dataFinal) || (!dataInicial && dataFinal)) {
      return {
        status: 400,
        body: erro('PERIODO_INVALIDO', 'Informe dataInicial e dataFinal em conjunto para consultar por periodo.')
      };
    }

    if (documentoParceiro && ![11, 14].includes(documentoParceiro.length)) {
      return {
        status: 400,
        body: erro('DOCUMENTO_INVALIDO', 'O documentoParceiro deve conter um CPF com 11 digitos ou CNPJ com 14 digitos.')
      };
    }

    if (!documentoParceiro && dataInicial && dataFinal && diferencaDias(dataInicial, dataFinal) > 31) {
      return {
        status: 400,
        body: erro(
          'PERIODO_MAIOR_QUE_O_PERMITIDO',
          'Consultas sem documentoParceiro permitem periodo maximo de 31 dias.'
        )
      };
    }

    const dados = [
      {
        codigoParceiro: '1024',
        nomeParceiro: 'Parceiro Exemplo Ltda',
        documentoParceiro: documentoParceiro ?? '12345678000190',
        pedido: 'PD-100245',
        statusPedido: 'E',
        dataPedido: dataInicial ?? '2026-05-10',
        nomeCliente: 'Cliente Exemplo S.A.',
        valorPedido: 1850.9,
        percentualRt: 5,
        valorRt: 92.55,
        descricaoFormaPagamento: 'Boleto 30 dias',
        tipoPagamento: 'Boleto',
        primeiroPagamento: '2026-06-10',
        statusPagamento: 'A PAGAR',
        dataPagamento: null,
        portador: '206',
        statusRt: 'Previsto',
        dataVencimentoOriginal: '2026-06-15',
        previsaoRt: '2026-06-15',
        pagamentoRt: null,
        dataBaixaPagamentoRt: null,
        valorRtTitulo: 92.55,
        valorPagoRt: 0
      }
    ];

    return {
      status: 200,
      body: sucesso(dados, {
        pagina,
        quantidadePorPagina,
        totalRegistros: dados.length
      })
    };
  }
}

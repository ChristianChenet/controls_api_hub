import { ApiCadastrada } from '../domain/types.js';

export const sqlParceirosComissoes = `
SELECT
  TIT.FORNECEDOR AS codigoParceiro,
  FORN.NOME AS nomeParceiro,
  COALESCE(fis.CPF, jur.CNPJ) AS documentoParceiro,
  PVC.PEDIDO AS pedido,
  PVC.STATUS AS statusPedido,
  PVC.DATA_EMISSAO AS dataPedido,
  CLI.NOME AS nomeCliente,
  PVC.VALOR_TOTAL AS valorPedido,
  COM.PERCENTUAL AS percentualRt,
  ((PVC.VALOR_TOTAL * COM.PERCENTUAL) / 100) AS valorRt,
  FPC.Descricao AS descricaoFormaPagamento,
  CASE
    WHEN FPC.Tipo = 001 THEN 'Dinheiro'
    WHEN FPC.Tipo = 002 THEN 'Duplicata'
    WHEN FPC.Tipo = 003 THEN 'Cheque'
    WHEN FPC.Tipo = 004 THEN 'Cartao Credito'
    WHEN FPC.Tipo = 005 THEN 'Cartao Debito'
    WHEN FPC.Tipo = 006 THEN 'Boleto'
    WHEN FPC.Tipo = 007 THEN 'Deposito'
    WHEN FPC.Tipo = 008 THEN 'Credito Loja'
    WHEN FPC.Tipo = 009 THEN 'Vale Alimentacao'
    WHEN FPC.Tipo = 010 THEN 'Vale Refeicao'
    WHEN FPC.Tipo = 011 THEN 'Vale Presente'
    WHEN FPC.Tipo = 012 THEN 'Vale Combustivel'
    WHEN FPC.Tipo = 013 THEN 'Outros'
    WHEN FPC.Tipo = 014 THEN 'Taxa Adm. Cartao'
    ELSE 'Cadastro Incompleto'
  END AS tipoPagamento,
  MIN(RECB.DATAVENCIMENTO) AS primeiroPagamento,
  CASE
    WHEN MIN(RECB.DATAPAGAMENTO) IS NULL THEN 'A PAGAR'
    ELSE 'PAGO'
  END AS statusPagamento,
  MIN(RECB.DATAPAGAMENTO) AS dataPagamento,
  TIT.PORTADOR AS portador,
  por.DESCRICAO AS statusRt,
  TIT.DATAVENCIMENTOORIGINAL AS dataVencimentoOriginal,
  TIT.DATAVENCIMENTO AS previsaoRt,
  TIT.DATAPAGAMENTO AS pagamentoRt,
  MIN(TIT.DATAPAGAMENTOLOG) AS dataBaixaPagamentoRt,
  TIT.VALOR AS valorRtTitulo,
  TIT.VALORPAGO AS valorPagoRt
FROM vdpvendacomissao COM
LEFT JOIN VDPVENDAC PVC ON COM.PedidoSequencial = PVC.PedidoSequencial
LEFT JOIN CPTITULO TIT ON PVC.PEDIDO = TIT.TITULO
LEFT JOIN CGPESSOA CLI ON PVC.PESSOA = CLI.PESSOA
LEFT JOIN CGPESSOA FORN ON TIT.FORNECEDOR = FORN.PESSOA
LEFT JOIN cgformapgtoc FPC ON PVC.forma_pgto = FPC.forma_pgto
LEFT JOIN CGPORTADOR por ON TIT.PORTADOR = por.PORTADOR
LEFT JOIN CRTITULO RECB ON TIT.TITULO = RECB.TITULO
LEFT JOIN CGFISICA fis ON COM.Vendedor = fis.PESSOA
LEFT JOIN CGJURIDICA jur ON COM.Vendedor = jur.PESSOA
WHERE
  COM.FlagTipoComissao = 2
  AND TIT.PORTADOR IN (206, 207, 20)
  AND TIT.FORNECEDOR = COM.Vendedor
  AND PVC.VALOR_TOTAL > 1
  AND PVC.STATUS IN ('D', 'E', 'P', 'R')
  AND (:documentoParceiro IS NULL OR REPLACE(REPLACE(REPLACE(COALESCE(fis.CPF, jur.CNPJ), '.', ''), '/', ''), '-', '') = :documentoParceiro)
  AND (:dataInicial IS NULL OR PVC.DATA_EMISSAO >= :dataInicial)
  AND (:dataFinal IS NULL OR PVC.DATA_EMISSAO < :dataFinalMaisUmDia)
GROUP BY
  PVC.PEDIDO, fis.CPF, jur.CNPJ, PVC.DATA_EMISSAO, PVC.STATUS, CLI.NOME, PVC.VALOR_TOTAL,
  TIT.FORNECEDOR, FORN.NOME, COM.PERCENTUAL, TIT.PORTADOR, por.DESCRICAO,
  TIT.DATAPAGAMENTO, TIT.DATAVENCIMENTO, TIT.DATAVENCIMENTOORIGINAL, TIT.VALOR,
  TIT.VALORPAGO, FPC.Tipo, FPC.Descricao
ORDER BY PVC.PEDIDO
`;

export const apiParceirosComissoes: ApiCadastrada = {
  id: 'api-parceiros-comissoes',
  nome: 'Comissoes de parceiros',
  nomeApi: 'Comissoes de parceiros',
  codigoInterno: 'PARCEIROS_COMISSOES',
  clienteId: 'cliente-control-s-demo',
  empresaId: 'cliente-control-s-demo',
  descricao: 'Consulta corporativa de comissoes, pedidos e previsoes de repasse de parceiros.',
  versao: '1.0.0',
  categoria: 'Financeiro',
  status: 'publicado',
  metodoHttp: 'GET',
  endpoint: '/v1/parceiros/comissoes',
  rotaPublica: '/v1/parceiros/comissoes',
  origemDados: 'ERP do cliente',
  conexaoId: 'conexao-demo-sqlserver',
  tipoExecucao: 'consultaSql',
  autenticacao: 'bearerToken',
  paginacaoHabilitada: true,
  ativa: true,
  exigeToken: true,
  permitePaginacao: true,
  timeoutSegundos: 30,
  dataCriacao: '2026-05-20T09:00:00.000Z',
  publicadaEm: '2026-05-20T09:30:00.000Z',
  ultimaPublicacao: '2026-05-20T09:30:00.000Z',
  sqlBase: sqlParceirosComissoes,
  parametros: [
    {
      id: 'param-documento-parceiro',
      nomeTecnico: 'documentoParceiro',
      nomePublico: 'documentoParceiro',
      tipo: 'documento',
      obrigatorio: false,
      origem: 'query',
      descricao: 'CPF ou CNPJ do parceiro, com ou sem mascara.',
      exemplo: '12345678000190',
      normalizacao: 'removerMascara'
    },
    {
      id: 'param-data-inicial',
      nomeTecnico: 'dataInicial',
      nomePublico: 'dataInicial',
      tipo: 'data',
      obrigatorio: false,
      origem: 'query',
      descricao: 'Data inicial do periodo no formato AAAA-MM-DD.',
      exemplo: '2026-05-01'
    },
    {
      id: 'param-data-final',
      nomeTecnico: 'dataFinal',
      nomePublico: 'dataFinal',
      tipo: 'data',
      obrigatorio: false,
      origem: 'query',
      descricao: 'Data final do periodo no formato AAAA-MM-DD.',
      exemplo: '2026-05-20'
    }
  ],
  regras: {
    exigirAoMenosUmGrupo: [['documentoParceiro'], ['dataInicial', 'dataFinal']],
    periodoObrigatorioEmConjunto: ['dataInicial', 'dataFinal'],
    limiteMaximoIntervaloDias: 31,
    quantidadeMaximaPorPagina: 100,
    ordenacaoPadrao: 'pedido',
    timeoutMs: 30000,
    removerMascaraDocumento: true,
    paginacaoPermitida: true
  },
  campos: [
    { origem: 'codigoParceiro', nomePublico: 'codigoParceiro', tipo: 'texto', descricao: 'Codigo interno do parceiro.', exemplo: '1024' },
    { origem: 'nomeParceiro', nomePublico: 'nomeParceiro', tipo: 'texto', descricao: 'Nome do parceiro.', exemplo: 'Parceiro Exemplo Ltda' },
    { origem: 'documentoParceiro', nomePublico: 'documentoParceiro', tipo: 'documento', descricao: 'CPF ou CNPJ do parceiro sem mascara.', exemplo: '12345678000190' },
    { origem: 'pedido', nomePublico: 'pedido', tipo: 'texto', descricao: 'Numero do pedido.', exemplo: 'PD-100245' },
    { origem: 'statusPedido', nomePublico: 'statusPedido', tipo: 'texto', descricao: 'Status operacional do pedido.', exemplo: 'E' },
    { origem: 'dataPedido', nomePublico: 'dataPedido', tipo: 'data', descricao: 'Data de emissao do pedido.', exemplo: '2026-05-10' },
    { origem: 'nomeCliente', nomePublico: 'nomeCliente', tipo: 'texto', descricao: 'Nome do cliente do pedido.', exemplo: 'Cliente Exemplo S.A.' },
    { origem: 'valorPedido', nomePublico: 'valorPedido', tipo: 'numero', descricao: 'Valor total do pedido.', exemplo: 1850.9 },
    { origem: 'percentualRt', nomePublico: 'percentualRt', tipo: 'numero', descricao: 'Percentual de repasse.', exemplo: 5 },
    { origem: 'valorRt', nomePublico: 'valorRt', tipo: 'numero', descricao: 'Valor calculado do repasse.', exemplo: 92.55 }
  ]
};

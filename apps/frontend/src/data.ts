export const indicadores = [
  ['APIs cadastradas', '18', '+4 neste mes'],
  ['APIs publicadas', '12', '99,8% disponivel'],
  ['Rascunhos', '6', '3 aguardando validacao'],
  ['Conexoes ativas', '9', 'Oracle, SQL Server, Firebird'],
  ['Clientes ativos', '7', 'multiempresa'],
  ['Tokens ativos', '26', 'por parceiro e cliente'],
  ['Chamadas 24h', '14.820', 'pico as 10:00'],
  ['Erros recentes', '11', '0 criticos']
];

export const clientes = [
  ['Control S', '21.421.411/0001-20', 'Homologacao', 'api.controlsconsultoria.com.br', 'Ativo'],
  ['Cliente Industrial Alfa', '12.345.678/0001-90', 'Producao', 'api.alfa.com.br', 'Ativo'],
  ['Grupo Comercial Beta', '98.765.432/0001-10', 'Local', 'api.beta.local', 'Ativo']
];

export const conexoes = [
  ['ERP Demonstracao SQL Server', 'SQL Server', 'localhost:1433', 'ERP_DEMO', 'Ativa'],
  ['ERP Demonstracao Oracle', 'Oracle', 'servidor-oracle:1521', 'ORCLPDB1', 'Inativa'],
  ['ERP Demonstracao Firebird', 'Firebird', 'servidor-firebird:3050', 'C:\\Dados\\ERP\\BASE.FDB', 'Inativa']
];

export const apis = [
  ['Comissoes de parceiros', 'GET', '/v1/parceiros/comissoes', '1.0.0', 'Publicado'],
  ['Pedidos por cliente', 'GET', '/v1/pedidos', '0.3.0', 'Rascunho'],
  ['Titulos financeiros', 'GET', '/v1/financeiro/titulos', '0.2.0', 'Rascunho']
];

export const logs = [
  ['10:00', 'Comissoes de parceiros', '200', '184 ms', '127.0.0.1'],
  ['10:05', 'Comissoes de parceiros', '400', '12 ms', '127.0.0.1'],
  ['10:08', 'Pedidos por cliente', '401', '8 ms', '10.0.0.15']
];

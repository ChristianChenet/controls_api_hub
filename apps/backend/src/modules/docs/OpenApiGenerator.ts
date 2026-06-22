import { ApiCadastrada } from '../../domain/types.js';
import { env } from '../../config/env.js';

export class OpenApiGenerator {
  gerar(api: ApiCadastrada, urlBaseApi = env.appPublicUrl) {
    const schemaDados = Object.fromEntries(
      api.campos.map((campo) => [
        campo.nomePublico,
        {
          type: campo.tipo === 'numero' ? 'number' : campo.tipo === 'booleano' ? 'boolean' : 'string',
          description: campo.descricao,
          example: campo.exemplo
        }
      ])
    );
    const paginacaoHabilitada = api.permitePaginacao !== false && api.paginacaoHabilitada !== false && api.regras?.paginacaoPermitida !== false;
    const quantidadeMaximaPorPagina = api.regras?.quantidadeMaximaPorPagina ?? 200;
    const parametrosPaginacao = paginacaoHabilitada ? [
      {
        name: 'pagina',
        in: 'query',
        required: false,
        description: 'Numero da pagina desejada. Quando nao informado, a API considera pagina 1.',
        schema: { type: 'integer', minimum: 1, default: 1 },
        example: 1
      },
      {
        name: 'pageSize',
        in: 'query',
        required: false,
        description: `Quantidade solicitada por pagina. O padrao recomendado e 500 para integracoes, mas esta API limita o retorno a no maximo ${quantidadeMaximaPorPagina} registros por pagina para proteger o banco de dados.`,
        schema: { type: 'integer', minimum: 1, maximum: quantidadeMaximaPorPagina, default: 500 },
        example: 500
      }
    ] : [];

    return {
      openapi: '3.0.3',
      info: {
        title: `${api.nome} - Control S API Hub`,
        description: api.descricao,
        version: api.versao
      },
      servers: [{ url: urlBaseApi, description: 'Ambiente configurado no Control S API Hub' }],
      tags: [{ name: api.categoria, description: `APIs da categoria ${api.categoria}` }],
      paths: {
        [api.endpoint]: {
          [api.metodoHttp.toLowerCase()]: {
            tags: [api.categoria],
            summary: api.nome,
            description: api.descricao,
            security: [{ bearerAuth: [] }],
            parameters: api.parametros.map((parametro) => ({
              name: parametro.nomePublico,
              in: parametro.origem,
              required: parametro.obrigatorio,
              description: parametro.descricao,
              schema: { type: parametro.tipo === 'numero' ? 'number' : 'string' },
              example: parametro.exemplo
            })).concat(parametrosPaginacao as any),
            responses: {
              '200': {
                description: 'Consulta executada com sucesso.',
                content: {
                  'application/json': {
                    example: {
                      sucesso: true,
                      meta: { pagina: 1, quantidadePorPagina: quantidadeMaximaPorPagina, totalRegistros: 1, totalPaginas: 1, temProxima: false, temAnterior: false },
                      dados: [Object.fromEntries(api.campos.map((campo) => [campo.nomePublico, campo.exemplo]))]
                    },
                    schema: {
                      type: 'object',
                      properties: {
                        sucesso: { type: 'boolean' },
                        meta: {
                          type: 'object',
                          description: 'Metadados de paginacao retornados pelas APIs publicadas.',
                          properties: {
                            pagina: { type: 'integer', description: 'Pagina retornada.' },
                            quantidadePorPagina: { type: 'integer', description: 'Quantidade de registros retornados por pagina, respeitando o limite da API.' },
                            totalRegistros: { type: 'integer', description: 'Total de registros encontrados antes da paginacao em memoria.' },
                            totalPaginas: { type: 'integer', description: 'Total de paginas disponiveis.' },
                            temProxima: { type: 'boolean', description: 'Indica se existe proxima pagina.' },
                            temAnterior: { type: 'boolean', description: 'Indica se existe pagina anterior.' }
                          }
                        },
                        dados: { type: 'array', items: { type: 'object', properties: schemaDados } }
                      }
                    }
                  }
                }
              },
              '400': {
                description: 'Erro de validacao dos parametros informados.',
                content: {
                  'application/json': {
                    examples: {
                      filtroObrigatorio: {
                        summary: 'Filtro obrigatorio nao informado',
                        value: {
                          sucesso: false,
                          erro: {
                            codigo: 'FILTRO_OBRIGATORIO_NAO_INFORMADO',
                            mensagem: 'Informe documentoParceiro ou o periodo completo com dataInicial e dataFinal.'
                          }
                        }
                      }
                    }
                  }
                }
              },
              '401': { description: 'Token ausente, invalido ou inativo.' },
              '500': { description: 'Erro interno ao executar a API.' }
            }
          }
        }
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'Token'
          }
        }
      }
    };
  }
}

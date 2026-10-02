import { randomUUID } from 'node:crypto';
import { AlertaIntegracao, DadoIntegracao, ExecucaoIntegracao, Integracao, LogIntegracao } from '../../domain/types.js';
import { criptografarSegredo, descriptografarSegredo } from './CofreCredenciais.js';
import { ErroIntegracao, GmobiiClient, PedidoGmobii } from './GmobiiClient.js';
import { IntegracaoRepository } from './IntegracaoRepository.js';

const agora = () => new Date().toISOString();

export class IntegracaoService {
  constructor(private repositorio: IntegracaoRepository, private gmobii = new GmobiiClient()) {}

  async configurar(empresaId: string, entrada: Partial<Integracao> & { token?: string }) {
    const existentes = await this.repositorio.listarIntegracoes(empresaId);
    const atual = existentes.find((item) => item.provedor === 'gmobii');
    const item: Integracao = {
      id: atual?.id ?? randomUUID(), empresaId, provedor: 'gmobii', nome: entrada.nome?.trim() || atual?.nome || 'GMOBii - Pedidos em producao',
      urlBase: entrada.urlBase?.trim() || atual?.urlBase || 'https://api.gmobii.com.br/functions/v1/production-orders',
      status: entrada.status === 'inativa' ? 'inativa' : atual?.status === 'erro' ? 'erro' : 'ativa',
      intervaloMinutos: Math.min(Math.max(Number(entrada.intervaloMinutos ?? atual?.intervaloMinutos ?? 15), 1), 1440),
      limitePorLote: Math.min(Math.max(Number(entrada.limitePorLote ?? atual?.limitePorLote ?? 200), 1), 200),
      tokenConfigurado: atual?.tokenConfigurado || Boolean(entrada.token), ultimoCursor: atual?.ultimoCursor,
      ultimaSincronizacao: atual?.ultimaSincronizacao, ultimoSucesso: atual?.ultimoSucesso, ultimaFalha: atual?.ultimaFalha,
      totalRegistros: atual?.totalRegistros ?? 0, criadoEm: atual?.criadoEm ?? agora(), atualizadoEm: agora()
    };
    const salva = await this.repositorio.salvarIntegracao(item);
    if (entrada.token?.trim()) await this.repositorio.salvarCredencial(salva.id, criptografarSegredo(entrada.token.trim()));
    await this.log(salva, undefined, 'informacao', 'configuracao_atualizada', 'Configuracao da integracao atualizada com sucesso.');
    return this.repositorio.obterIntegracao(salva.id, empresaId);
  }

  async testar(integracao: Integracao) {
    const execucao = this.novaExecucao(integracao, 'teste');
    await this.repositorio.criarExecucao(execucao);
    const inicio = Date.now();
    try {
      const token = await this.token(integracao);
      const resposta = await this.gmobii.listar(integracao.urlBase, token, undefined, 1);
      Object.assign(execucao, { status:'sucesso', finalizadaEm:agora(), duracaoMs:Date.now()-inicio, registrosRecebidos:resposta.pedidos.length, lotesProcessados:1, mensagem:'Conexao validada com sucesso.' });
      await this.repositorio.finalizarExecucao(execucao);
      await this.log(integracao, execucao.id, 'informacao', 'conexao_validada', 'Conexao e credencial validadas com sucesso.', resposta.statusHttp, resposta.duracaoMs);
      return execucao;
    } catch (error) { await this.falhar(integracao, execucao, error, inicio); throw error; }
  }

  async sincronizar(integracao: Integracao) {
    const execucao = this.novaExecucao(integracao, 'sincronizacao');
    await this.repositorio.criarExecucao(execucao);
    const inicio = Date.now();
    try {
      const token = await this.token(integracao);
      let cursor = integracao.ultimoCursor ? new Date(new Date(integracao.ultimoCursor).getTime() - 1000).toISOString() : undefined;
      let continuar = true;
      while (continuar && execucao.lotesProcessados < 100) {
        const resposta = await this.gmobii.listar(integracao.urlBase, token, cursor, integracao.limitePorLote);
        execucao.registrosRecebidos += resposta.pedidos.length;
        execucao.lotesProcessados++;
        const camposContrato = ['numero_pedido','cliente','cliente_documento','vendedor','vendedor_documento','empresa','empresa_documento','tipo_servico','data_criacao','data_envio_producao','observacoes','chapas_total','deslocamentos','fita_borda_m','itens'];
        // Data de envio e observações fazem parte do contrato, porém são opcionais.
        // A ausência ou o valor nulo continua visível na conferência, sem gerar alerta crítico.
        const camposObrigatorios = ['numero_pedido','cliente_documento','vendedor_documento','empresa_documento','data_criacao','itens'];
        const diagnosticos = resposta.pedidos.map((pedido) => ({
          numeroPedido: String(pedido.numero_pedido),
          campos: [...camposContrato.map((campo) => {
            const presente = Object.prototype.hasOwnProperty.call(pedido, campo);
            const valor = presente ? pedido[campo] : undefined;
            return { campo, estado: !presente ? 'ausente' : valor === null ? 'nulo_recebido' : typeof valor === 'string' && valor.trim() === '' ? 'em_branco' : Array.isArray(valor) && valor.length === 0 ? 'em_branco' : 'preenchido', valor: valor ?? null };
          }), ...(Array.isArray(pedido.itens) ? pedido.itens.flatMap((item,index)=>['codigo','descricao','quantidade','unidade','valor'].map((campo)=>{const presente=Object.prototype.hasOwnProperty.call(item,campo);const valor=item[campo as keyof typeof item];return {campo:`itens[${index}].${campo}`,estado:!presente?'ausente':valor===null?'nulo_recebido':typeof valor==='string'&&valor.trim()===''?'em_branco':'preenchido',valor:valor??null,produtoIndice:index+1,produtoCodigo:item.codigo??null,produtoDescricao:item.descricao??null}})) : [])],
          camposAusentes: camposContrato.filter((campo) => !Object.prototype.hasOwnProperty.call(pedido, campo)),
          camposNulos: camposContrato.filter((campo) => Object.prototype.hasOwnProperty.call(pedido, campo) && pedido[campo] === null),
          problemasCriticos: [
            ...camposObrigatorios.filter((campo) => {
              const valor=pedido[campo];
              return !Object.prototype.hasOwnProperty.call(pedido,campo) || valor === null || (typeof valor === 'string' && valor.trim() === '') || (Array.isArray(valor) && valor.length === 0);
            }).map((campo)=>`Campo obrigatório ${campo} não informado`),
            ...(Array.isArray(pedido.itens) ? pedido.itens.flatMap((item,index) => {
              const problemas:string[]=[];
              for (const campo of ['codigo','quantidade']) {
                const valor=item[campo as keyof typeof item];
                if (!Object.prototype.hasOwnProperty.call(item,campo) || valor === null || (typeof valor === 'string' && valor.trim() === '')) {
                  const produto=[item.codigo,item.descricao].filter(Boolean).join(' — ')||`item ${index+1}`;
                  problemas.push(`Produto ${produto}: campo obrigatório itens[${index}].${campo} não informado`);
                }
              }
              return problemas;
            }) : ['Lista de itens obrigatória não informada'])
          ]
        }));
        const divergentes = diagnosticos.filter((item) => item.camposAusentes.length || item.camposNulos.length || item.problemasCriticos.length);
        if (divergentes.length) {
          const ausentes = divergentes.filter((item) => item.camposAusentes.length).length;
          await this.log(integracao, execucao.id, 'aviso', 'dados_incompletos_gmobii', `${divergentes.length} pedido(s) retornaram campos nulos, vazios ou ausentes. Campos ausentes: ${ausentes} pedido(s). Consulte os detalhes do log para diferenciar informações opcionais de campos obrigatórios.`, resposta.statusHttp, resposta.duracaoMs, { versaoContrato:'1.3 Control S', pedidos:divergentes });
        }
        for (const diagnostico of diagnosticos) {
          if (!diagnostico.problemasCriticos.length) {
            await this.repositorio.resolverAlertasColetaSemCriticidade(integracao.id,integracao.empresaId,diagnostico.numeroPedido);
            continue;
          }
          await this.repositorio.criarAlerta({id:randomUUID(),integracaoId:integracao.id,empresaId:integracao.empresaId,severidade:'critico',titulo:`Pedido ${diagnostico.numeroPedido} · conferência GMOBii`,mensagem:diagnostico.problemasCriticos.join(' · '),detalhes:{numeroPedido:diagnostico.numeroPedido,versaoContrato:'1.3 Control S',campos:diagnostico.campos,camposObrigatorios,problemasCriticos:diagnostico.problemasCriticos},lido:false,criadoEm:agora()});
        }
        const dados = resposta.pedidos.map((pedido) => this.mapPedido(integracao, pedido));
        const resultado = await this.repositorio.transacao((client) => this.repositorio.salvarDados(client, dados));
        execucao.registrosInseridos += resultado.inseridos;
        execucao.registrosAtualizados += resultado.atualizados;
        await this.log(integracao, execucao.id, 'informacao', 'lote_processado', `Lote ${execucao.lotesProcessados} processado com ${resposta.pedidos.length} pedido(s).`, resposta.statusHttp, resposta.duracaoMs, { quantidade: resposta.pedidos.length });
        cursor = resposta.proximoDesde || cursor;
        continuar = resposta.pedidos.length >= integracao.limitePorLote && Boolean(resposta.proximoDesde);
      }
      const total = await this.repositorio.totalDados(integracao.id);
      await this.repositorio.atualizarSucesso(integracao.id, cursor, total);
      Object.assign(execucao, { status:'sucesso', finalizadaEm:agora(), duracaoMs:Date.now()-inicio, mensagem:`Sincronizacao concluida com ${execucao.registrosRecebidos} registro(s) recebido(s).` });
      await this.repositorio.finalizarExecucao(execucao);
      await this.log(integracao, execucao.id, 'informacao', 'sincronizacao_concluida', execucao.mensagem || 'Sincronizacao concluida.', undefined, execucao.duracaoMs, { inseridos:execucao.registrosInseridos, atualizados:execucao.registrosAtualizados, totalArmazenado:total });
      return execucao;
    } catch (error) { await this.falhar(integracao, execucao, error, inicio); throw error; }
  }

  private async token(integracao: Integracao) { const valor=await this.repositorio.obterCredencial(integracao.id); if(!valor) throw new ErroIntegracao('Configure o token da GMOBii antes de continuar.','TOKEN_NAO_CONFIGURADO'); return descriptografarSegredo(valor); }
  private novaExecucao(i:Integracao,tipo:'teste'|'sincronizacao'):ExecucaoIntegracao { return {id:randomUUID(),integracaoId:i.id,empresaId:i.empresaId,tipo,status:'executando',iniciadaEm:agora(),registrosRecebidos:0,registrosInseridos:0,registrosAtualizados:0,lotesProcessados:0}; }
  private mapPedido(i:Integracao,p:PedidoGmobii):DadoIntegracao { return {id:randomUUID(),integracaoId:i.id,empresaId:i.empresaId,tipo:'pedido_producao',chaveExterna:String(p.numero_pedido),dataReferencia:p.data_envio_producao,conteudo:p,criadoEm:agora(),atualizadoEm:agora()}; }
  private async log(i:Integracao,execucaoId: string|undefined,nivel:LogIntegracao['nivel'],evento:string,mensagem:string,statusHttp?:number,duracaoMs?:number,detalhes?:Record<string,unknown>) { await this.repositorio.salvarLog({id:randomUUID(),integracaoId:i.id,execucaoId,empresaId:i.empresaId,nivel,evento,mensagem,statusHttp,duracaoMs,detalhes,criadoEm:agora()}); }
  private async falhar(i:Integracao,e:ExecucaoIntegracao,error:unknown,inicio:number) { const falha=error instanceof ErroIntegracao?error:new ErroIntegracao(error instanceof Error?error.message:'Falha inesperada.','FALHA_INESPERADA'); Object.assign(e,{status:'falha',finalizadaEm:agora(),duracaoMs:Date.now()-inicio,mensagem:falha.message,codigoErro:falha.codigo}); await this.repositorio.finalizarExecucao(e); await this.repositorio.atualizarFalha(i.id); await this.log(i,e.id,'erro','falha_integracao',falha.message,falha.statusHttp,e.duracaoMs,{codigo:falha.codigo}); const alerta:AlertaIntegracao={id:randomUUID(),integracaoId:i.id,empresaId:i.empresaId,severidade:falha.statusHttp===401?'critico':'aviso',titulo:`Falha na integracao ${i.nome}`,mensagem:falha.message,lido:false,criadoEm:agora()}; await this.repositorio.criarAlerta(alerta); }
}

import { Pool, PoolClient } from 'pg';
import { env } from '../../config/env.js';
import { AlertaIntegracao, DadoIntegracao, ExecucaoIntegracao, Integracao, LogIntegracao } from '../../domain/types.js';

export class IntegracaoRepository {
  private pool = new Pool({ connectionString: env.databaseUrl });

  async criarSchema() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS integracoes (
        id UUID PRIMARY KEY, empresa_id TEXT NOT NULL, provedor TEXT NOT NULL, nome TEXT NOT NULL,
        url_base TEXT NOT NULL, status TEXT NOT NULL, intervalo_minutos INTEGER NOT NULL DEFAULT 15,
        limite_por_lote INTEGER NOT NULL DEFAULT 200, token_configurado BOOLEAN NOT NULL DEFAULT FALSE,
        ultimo_cursor TIMESTAMPTZ, ultima_sincronizacao TIMESTAMPTZ, ultimo_sucesso TIMESTAMPTZ,
        ultima_falha TIMESTAMPTZ, total_registros INTEGER NOT NULL DEFAULT 0,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (empresa_id, provedor)
      );
      CREATE TABLE IF NOT EXISTS credenciais_integracao (
        integracao_id UUID PRIMARY KEY REFERENCES integracoes(id) ON DELETE CASCADE,
        segredo_criptografado TEXT NOT NULL, atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS execucoes_integracao (
        id UUID PRIMARY KEY, integracao_id UUID NOT NULL REFERENCES integracoes(id) ON DELETE CASCADE,
        empresa_id TEXT NOT NULL, tipo TEXT NOT NULL, status TEXT NOT NULL, iniciada_em TIMESTAMPTZ NOT NULL,
        finalizada_em TIMESTAMPTZ, duracao_ms INTEGER, registros_recebidos INTEGER NOT NULL DEFAULT 0,
        registros_inseridos INTEGER NOT NULL DEFAULT 0, registros_atualizados INTEGER NOT NULL DEFAULT 0,
        lotes_processados INTEGER NOT NULL DEFAULT 0, mensagem TEXT, codigo_erro TEXT
      );
      CREATE TABLE IF NOT EXISTS logs_integracao (
        id UUID PRIMARY KEY, integracao_id UUID NOT NULL REFERENCES integracoes(id) ON DELETE CASCADE,
        execucao_id UUID REFERENCES execucoes_integracao(id) ON DELETE SET NULL, empresa_id TEXT NOT NULL,
        nivel TEXT NOT NULL, evento TEXT NOT NULL, mensagem TEXT NOT NULL, status_http INTEGER,
        duracao_ms INTEGER, detalhes JSONB, criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS alertas_integracao (
        id UUID PRIMARY KEY, integracao_id UUID NOT NULL REFERENCES integracoes(id) ON DELETE CASCADE,
        empresa_id TEXT NOT NULL, severidade TEXT NOT NULL, titulo TEXT NOT NULL, mensagem TEXT NOT NULL, detalhes JSONB,
        lido BOOLEAN NOT NULL DEFAULT FALSE, criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), resolvido_em TIMESTAMPTZ
      );
      CREATE TABLE IF NOT EXISTS dados_integracao (
        id UUID PRIMARY KEY, integracao_id UUID NOT NULL REFERENCES integracoes(id) ON DELETE CASCADE,
        empresa_id TEXT NOT NULL, tipo TEXT NOT NULL, chave_externa TEXT NOT NULL, data_referencia TIMESTAMPTZ,
        conteudo JSONB NOT NULL, criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (integracao_id, tipo, chave_externa)
      );
      CREATE INDEX IF NOT EXISTS ix_integracoes_empresa ON integracoes(empresa_id);
      CREATE INDEX IF NOT EXISTS ix_execucoes_integracao_data ON execucoes_integracao(integracao_id, iniciada_em DESC);
      CREATE INDEX IF NOT EXISTS ix_logs_integracao_data ON logs_integracao(integracao_id, criado_em DESC);
      CREATE INDEX IF NOT EXISTS ix_alertas_integracao_pendentes ON alertas_integracao(empresa_id, lido, criado_em DESC);
      CREATE INDEX IF NOT EXISTS ix_dados_integracao_referencia ON dados_integracao(integracao_id, data_referencia DESC);
      ALTER TABLE alertas_integracao ADD COLUMN IF NOT EXISTS detalhes JSONB;
      ALTER TABLE dados_integracao ADD COLUMN IF NOT EXISTS excluido BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE dados_integracao ADD COLUMN IF NOT EXISTS excluido_em TIMESTAMPTZ;
      ALTER TABLE dados_integracao ADD COLUMN IF NOT EXISTS excluido_por TEXT;
      ALTER TABLE dados_integracao ADD COLUMN IF NOT EXISTS excluido_por_nome TEXT;
      DELETE FROM alertas_integracao antigo
      USING alertas_integracao recente
      WHERE antigo.integracao_id = recente.integracao_id
        AND antigo.lido = FALSE AND recente.lido = FALSE
        AND antigo.detalhes->>'numeroPedido' IS NOT NULL
        AND antigo.detalhes->>'numeroPedido' = recente.detalhes->>'numeroPedido'
        AND (antigo.criado_em < recente.criado_em OR (antigo.criado_em = recente.criado_em AND antigo.id::text < recente.id::text));
    `);
  }

  async listarIntegracoes(empresaId: string): Promise<Integracao[]> {
    const { rows } = await this.pool.query('SELECT * FROM integracoes WHERE empresa_id = $1 ORDER BY atualizado_em DESC', [empresaId]);
    return rows.map(this.mapIntegracao);
  }
  async obterIntegracao(id: string, empresaId: string) {
    const { rows } = await this.pool.query('SELECT * FROM integracoes WHERE id = $1 AND empresa_id = $2', [id, empresaId]);
    return rows[0] ? this.mapIntegracao(rows[0]) : undefined;
  }
  async salvarIntegracao(item: Integracao) {
    await this.pool.query(`INSERT INTO integracoes (id, empresa_id, provedor, nome, url_base, status, intervalo_minutos, limite_por_lote, token_configurado, criado_em, atualizado_em)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (empresa_id, provedor) DO UPDATE SET nome=EXCLUDED.nome,url_base=EXCLUDED.url_base,status=EXCLUDED.status,intervalo_minutos=EXCLUDED.intervalo_minutos,limite_por_lote=EXCLUDED.limite_por_lote,token_configurado=integracoes.token_configurado OR EXCLUDED.token_configurado,atualizado_em=NOW()`,
      [item.id,item.empresaId,item.provedor,item.nome,item.urlBase,item.status,item.intervaloMinutos,item.limitePorLote,item.tokenConfigurado,item.criadoEm,item.atualizadoEm]);
    const { rows } = await this.pool.query('SELECT * FROM integracoes WHERE empresa_id=$1 AND provedor=$2', [item.empresaId,item.provedor]);
    return this.mapIntegracao(rows[0]);
  }
  async salvarCredencial(integracaoId: string, segredo: string) {
    await this.pool.query(`INSERT INTO credenciais_integracao (integracao_id, segredo_criptografado) VALUES ($1,$2)
      ON CONFLICT (integracao_id) DO UPDATE SET segredo_criptografado=EXCLUDED.segredo_criptografado, atualizado_em=NOW()`, [integracaoId, segredo]);
    await this.pool.query('UPDATE integracoes SET token_configurado=TRUE, atualizado_em=NOW() WHERE id=$1', [integracaoId]);
  }
  async obterCredencial(integracaoId: string) {
    const { rows } = await this.pool.query('SELECT segredo_criptografado FROM credenciais_integracao WHERE integracao_id=$1', [integracaoId]);
    return rows[0]?.segredo_criptografado as string | undefined;
  }
  async criarExecucao(item: ExecucaoIntegracao) { await this.pool.query(`INSERT INTO execucoes_integracao (id,integracao_id,empresa_id,tipo,status,iniciada_em,registros_recebidos,registros_inseridos,registros_atualizados,lotes_processados) VALUES ($1,$2,$3,$4,$5,$6,0,0,0,0)`, [item.id,item.integracaoId,item.empresaId,item.tipo,item.status,item.iniciadaEm]); }
  async finalizarExecucao(item: ExecucaoIntegracao) { await this.pool.query(`UPDATE execucoes_integracao SET status=$2,finalizada_em=$3,duracao_ms=$4,registros_recebidos=$5,registros_inseridos=$6,registros_atualizados=$7,lotes_processados=$8,mensagem=$9,codigo_erro=$10 WHERE id=$1`, [item.id,item.status,item.finalizadaEm,item.duracaoMs,item.registrosRecebidos,item.registrosInseridos,item.registrosAtualizados,item.lotesProcessados,item.mensagem,item.codigoErro]); }
  async salvarLog(item: LogIntegracao) { await this.pool.query(`INSERT INTO logs_integracao (id,integracao_id,execucao_id,empresa_id,nivel,evento,mensagem,status_http,duracao_ms,detalhes,criado_em) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [item.id,item.integracaoId,item.execucaoId,item.empresaId,item.nivel,item.evento,item.mensagem,item.statusHttp,item.duracaoMs,item.detalhes ?? null,item.criadoEm]); }
  async criarAlerta(item: AlertaIntegracao) {
    const numeroPedido = item.detalhes?.numeroPedido;
    if (numeroPedido) {
      const atualizado = await this.pool.query(`UPDATE alertas_integracao SET severidade=$3,titulo=$4,mensagem=$5,detalhes=$6,criado_em=$7
        WHERE id=(SELECT id FROM alertas_integracao WHERE integracao_id=$1 AND empresa_id=$2 AND lido=FALSE AND detalhes->>'numeroPedido'=$8 ORDER BY criado_em DESC LIMIT 1)`,
        [item.integracaoId,item.empresaId,item.severidade,item.titulo,item.mensagem,item.detalhes,item.criadoEm,String(numeroPedido)]);
      if (atualizado.rowCount) return;
    }
    await this.pool.query(`INSERT INTO alertas_integracao (id,integracao_id,empresa_id,severidade,titulo,mensagem,detalhes,lido,criado_em) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [item.id,item.integracaoId,item.empresaId,item.severidade,item.titulo,item.mensagem,item.detalhes ?? null,item.lido,item.criadoEm]);
  }
  async marcarAlertaLido(id: string, empresaId: string) { return (await this.pool.query('UPDATE alertas_integracao SET lido=TRUE,resolvido_em=NOW() WHERE id=$1 AND empresa_id=$2', [id,empresaId])).rowCount; }
  async resolverAlertasColetaSemCriticidade(integracaoId:string,empresaId:string,numeroPedido:string) {
    await this.pool.query(`UPDATE alertas_integracao SET lido=TRUE,resolvido_em=NOW()
      WHERE integracao_id=$1 AND empresa_id=$2 AND lido=FALSE
        AND detalhes->>'numeroPedido'=$3
        AND COALESCE(detalhes->>'origem','coleta')<>'integracao_construshow'`,[integracaoId,empresaId,numeroPedido]);
  }
  async listarExecucoes(id: string, empresaId: string) { const { rows } = await this.pool.query('SELECT * FROM execucoes_integracao WHERE integracao_id=$1 AND empresa_id=$2 ORDER BY iniciada_em DESC LIMIT 50',[id,empresaId]); return rows.map((r)=>({id:r.id,integracaoId:r.integracao_id,empresaId:r.empresa_id,tipo:r.tipo,status:r.status,iniciadaEm:r.iniciada_em,finalizadaEm:r.finalizada_em,duracaoMs:r.duracao_ms,registrosRecebidos:r.registros_recebidos,registrosInseridos:r.registros_inseridos,registrosAtualizados:r.registros_atualizados,lotesProcessados:r.lotes_processados,mensagem:r.mensagem,codigoErro:r.codigo_erro} as ExecucaoIntegracao)); }
  async listarLogs(id: string, empresaId: string) { const { rows } = await this.pool.query('SELECT * FROM logs_integracao WHERE integracao_id=$1 AND empresa_id=$2 ORDER BY criado_em DESC LIMIT 100',[id,empresaId]); return rows.map((r)=>({id:r.id,integracaoId:r.integracao_id,execucaoId:r.execucao_id,empresaId:r.empresa_id,nivel:r.nivel,evento:r.evento,mensagem:r.mensagem,statusHttp:r.status_http,duracaoMs:r.duracao_ms,detalhes:r.detalhes,criadoEm:r.criado_em} as LogIntegracao)); }
  async listarAlertas(empresaId: string) { const { rows } = await this.pool.query('SELECT * FROM alertas_integracao WHERE empresa_id=$1 ORDER BY lido, criado_em DESC LIMIT 100',[empresaId]); return rows.map((r)=>({id:r.id,integracaoId:r.integracao_id,empresaId:r.empresa_id,severidade:r.severidade,titulo:r.titulo,mensagem:r.mensagem,detalhes:r.detalhes??undefined,lido:r.lido,criadoEm:r.criado_em,resolvidoEm:r.resolvido_em} as AlertaIntegracao)); }
  async listarDados(id:string,empresaId:string,filtros:{pagina:number;quantidadePorPagina:number;busca?:string;tipoServico?:string;somenteAlertas?:string;situacaoExclusao?:string;dataInicial?:string;dataFinal?:string}) {
    const condicoes=['d.integracao_id=$1','d.empresa_id=$2']; const valores:any[]=[id,empresaId];
    const possuiIntegracaoAtual=`EXISTS(SELECT 1 FROM integracoes_construshow ic WHERE ic.integracao_id=d.integracao_id AND ic.empresa_id=d.empresa_id AND ic.pedido_gmobii=d.chave_externa AND ic.historico=FALSE AND ic.status IN ('integrado','existente') AND NOT EXISTS(SELECT 1 FROM cancelamentos_gmobii cg WHERE cg.integracao_id=ic.integracao_id AND cg.empresa_id=ic.empresa_id AND cg.estab=ic.estab AND cg.id_carrinho=ic.id_carrinho AND cg.status='concluido' AND cg.concluido_em IS NOT NULL AND d.atualizado_em>cg.concluido_em))`;
    if(filtros.situacaoExclusao==='excluidos')condicoes.push('d.excluido=TRUE');
    else if(filtros.situacaoExclusao!=='todos'){
      condicoes.push('d.excluido=FALSE');
      if(filtros.situacaoExclusao==='integrados')condicoes.push(possuiIntegracaoAtual);
      if(filtros.situacaoExclusao==='nao_integrados')condicoes.push(`NOT (${possuiIntegracaoAtual})`);
    }
    if(filtros.busca){valores.push(`%${filtros.busca}%`);condicoes.push(`(d.chave_externa ILIKE $${valores.length} OR d.conteudo->>'cliente' ILIKE $${valores.length} OR d.conteudo->>'empresa' ILIKE $${valores.length})`);}
    if(filtros.tipoServico){valores.push(filtros.tipoServico);condicoes.push(`d.conteudo->>'tipo_servico'=$${valores.length}`);}
    if(filtros.somenteAlertas==='sim')condicoes.push(`(NOT EXISTS(SELECT 1 FROM validacoes_erp_gmobii ve WHERE ve.integracao_id=d.integracao_id AND ve.pedido_gmobii=d.chave_externa) OR EXISTS(SELECT 1 FROM validacoes_erp_gmobii ve WHERE ve.integracao_id=d.integracao_id AND ve.pedido_gmobii=d.chave_externa AND ve.status='pendente') OR EXISTS(SELECT 1 FROM alertas_integracao ai WHERE ai.integracao_id=d.integracao_id AND ai.empresa_id=d.empresa_id AND ai.detalhes->>'numeroPedido'=d.chave_externa AND ai.lido=FALSE AND ai.severidade='critico'))`);
    // O período da tela é aplicado à data de criação informada pela GMOBii.
    // LEFT(...,10) equivale ao TRUNC solicitado e impede que a hora interfira no resultado.
    const dataCriacaoSql=`CASE WHEN d.conteudo->>'data_criacao' ~ '^\\d{4}-\\d{2}-\\d{2}' THEN LEFT(d.conteudo->>'data_criacao',10)::date END`;
    if(filtros.dataInicial){valores.push(filtros.dataInicial);condicoes.push(`${dataCriacaoSql} >= $${valores.length}::date`);}
    if(filtros.dataFinal){valores.push(filtros.dataFinal);condicoes.push(`${dataCriacaoSql} <= $${valores.length}::date`);}
    const onde=condicoes.join(' AND '); const total=(await this.pool.query(`SELECT COUNT(*)::int total FROM dados_integracao d WHERE ${onde}`,valores)).rows[0].total as number;
    valores.push(filtros.quantidadePorPagina,(filtros.pagina-1)*filtros.quantidadePorPagina);
    const {rows}=await this.pool.query(`SELECT d.*,(SELECT jsonb_build_object('status',v.status,'detalhes',v.detalhes,'atualizadoEm',v.atualizado_em) FROM validacoes_erp_gmobii v WHERE v.integracao_id=d.integracao_id AND v.pedido_gmobii=d.chave_externa) validacao_erp FROM dados_integracao d WHERE ${onde} ORDER BY d.data_referencia DESC NULLS LAST LIMIT $${valores.length-1} OFFSET $${valores.length}`,valores);
    const dados=rows.map((r)=>({id:r.id,integracaoId:r.integracao_id,empresaId:r.empresa_id,tipo:r.tipo,chaveExterna:r.chave_externa,dataReferencia:r.data_referencia,conteudo:r.conteudo,criadoEm:r.criado_em,atualizadoEm:r.atualizado_em,excluido:r.excluido,excluidoEm:r.excluido_em,excluidoPor:r.excluido_por,excluidoPorNome:r.excluido_por_nome,validacaoErp:r.validacao_erp??undefined} as DadoIntegracao & {validacaoErp?:unknown;excluido?:boolean;excluidoEm?:string;excluidoPor?:string;excluidoPorNome?:string}));
    return {dados,meta:{pagina:filtros.pagina,quantidadePorPagina:filtros.quantidadePorPagina,totalRegistros:total,totalPaginas:Math.max(Math.ceil(total/filtros.quantidadePorPagina),1)}};
  }
  async excluirDadoNaoIntegrado(id:string,integracaoId:string,empresaId:string,opcoes:{definitiva:boolean;usuarioId:string;usuarioNome:string}) {
    return this.transacao(async(client)=>{
      const consulta=await client.query(`SELECT * FROM dados_integracao WHERE id=$1 AND integracao_id=$2 AND empresa_id=$3 FOR UPDATE`,[id,integracaoId,empresaId]);
      const registro=consulta.rows[0];
      if(!registro)return {situacao:'nao_encontrado' as const};
      const integrado=await client.query(`SELECT ic.id,ic.status,ic.id_carrinho FROM integracoes_construshow ic WHERE ic.integracao_id=$1 AND ic.empresa_id=$2 AND ic.pedido_gmobii=$3 AND ic.historico=FALSE AND ic.status IN ('integrado','existente') AND NOT EXISTS(SELECT 1 FROM cancelamentos_gmobii cg WHERE cg.integracao_id=ic.integracao_id AND cg.empresa_id=ic.empresa_id AND cg.estab=ic.estab AND cg.id_carrinho=ic.id_carrinho AND cg.status='concluido' AND cg.concluido_em IS NOT NULL AND $4::timestamptz>cg.concluido_em) LIMIT 1`,[integracaoId,empresaId,registro.chave_externa,registro.atualizado_em]);
      if(integrado.rowCount)return {situacao:'integrado' as const,integracao:integrado.rows[0]};
      // Sem carrinho integrado, removemos também validações e tentativas com erro
      // para não deixar alertas ou registros órfãos após a exclusão da coleta.
      const tentativas=await client.query(`DELETE FROM integracoes_construshow WHERE integracao_id=$1 AND empresa_id=$2 AND pedido_gmobii=$3 AND historico=FALSE AND status='erro' RETURNING id,status,mensagem`,[integracaoId,empresaId,registro.chave_externa]);
      await client.query(`DELETE FROM validacoes_erp_gmobii WHERE integracao_id=$1 AND empresa_id=$2 AND pedido_gmobii=$3`,[integracaoId,empresaId,registro.chave_externa]);
      await client.query(`UPDATE alertas_integracao SET lido=TRUE,resolvido_em=NOW() WHERE integracao_id=$1 AND empresa_id=$2 AND detalhes->>'numeroPedido'=$3 AND lido=FALSE`,[integracaoId,empresaId,registro.chave_externa]);
      if(opcoes.definitiva)await client.query('DELETE FROM dados_integracao WHERE id=$1',[id]);
      else await client.query(`UPDATE dados_integracao SET excluido=TRUE,excluido_em=NOW(),excluido_por=$2,excluido_por_nome=$3,atualizado_em=NOW() WHERE id=$1`,[id,opcoes.usuarioId,opcoes.usuarioNome]);
      return {situacao:'excluido' as const,modo:opcoes.definitiva?'definitiva' as const:'logica' as const,tentativasRemovidas:tentativas.rows,dado:{id:registro.id,tipo:registro.tipo,chaveExterna:registro.chave_externa,dataReferencia:registro.data_referencia,conteudo:registro.conteudo,criadoEm:registro.criado_em,atualizadoEm:registro.atualizado_em}};
    });
  }
  async salvarDados(client: PoolClient, dados: DadoIntegracao[]) { let inseridos=0, atualizados=0; for (const d of dados) { const r=await client.query(`INSERT INTO dados_integracao (id,integracao_id,empresa_id,tipo,chave_externa,data_referencia,conteudo,criado_em,atualizado_em) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (integracao_id,tipo,chave_externa) DO UPDATE SET data_referencia=EXCLUDED.data_referencia,conteudo=EXCLUDED.conteudo,atualizado_em=NOW() RETURNING (xmax = 0) AS inserido`,[d.id,d.integracaoId,d.empresaId,d.tipo,d.chaveExterna,d.dataReferencia,d.conteudo,d.criadoEm,d.atualizadoEm]); r.rows[0].inserido ? inseridos++ : atualizados++; } return {inseridos,atualizados}; }
  async transacao<T>(fn:(client:PoolClient)=>Promise<T>) { const c=await this.pool.connect(); try { await c.query('BEGIN'); const r=await fn(c); await c.query('COMMIT'); return r; } catch(e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); } }
  async atualizarSucesso(id:string,cursor:string|undefined,total:number) { await this.pool.query(`UPDATE integracoes SET status='ativa',ultimo_cursor=COALESCE($2,ultimo_cursor),ultima_sincronizacao=NOW(),ultimo_sucesso=NOW(),total_registros=$3,atualizado_em=NOW() WHERE id=$1`,[id,cursor,total]); }
  async atualizarFalha(id:string) { await this.pool.query(`UPDATE integracoes SET status='erro',ultima_sincronizacao=NOW(),ultima_falha=NOW(),atualizado_em=NOW() WHERE id=$1`,[id]); }
  async totalDados(id:string) { const {rows}=await this.pool.query('SELECT COUNT(*)::int total FROM dados_integracao WHERE integracao_id=$1 AND excluido=FALSE',[id]); return rows[0].total as number; }

  private mapIntegracao(r:any): Integracao { return {id:r.id,empresaId:r.empresa_id,provedor:r.provedor,nome:r.nome,urlBase:r.url_base,status:r.status,intervaloMinutos:r.intervalo_minutos,limitePorLote:r.limite_por_lote,tokenConfigurado:r.token_configurado,ultimoCursor:r.ultimo_cursor,ultimaSincronizacao:r.ultima_sincronizacao,ultimoSucesso:r.ultimo_sucesso,ultimaFalha:r.ultima_falha,totalRegistros:r.total_registros,criadoEm:r.criado_em,atualizadoEm:r.atualizado_em}; }
}

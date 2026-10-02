import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { env } from '../../../config/env.js';
import { ConexaoBanco } from '../../../domain/types.js';

export interface ConfiguracaoConstrushowIntegracao {
  estab:number; estabProduto:number; estabNc:number; idNotaConf:number;
  idCliente?:number; idVendedor?:number; validadeCarrinho:number; diasPrevisaoEntrega?:number;
}

type Pedido = Record<string, any>;

class CadastroErpNaoLocalizado extends Error {
  constructor(
    mensagem:string,
    readonly entidade:'produto'|'cliente'|'vendedor'|'empresa',
    readonly campo:string,
    readonly valor:unknown,
  ){super(mensagem);this.name='CadastroErpNaoLocalizado'}
}

class CampoNumericoOracleInvalido extends Error {
  constructor(
    readonly campoOracle:string,
    readonly campoOrigem:string,
    readonly valorRecebido:unknown,
  ){
    super(`O campo ${campoOracle} recebeu um valor numérico inválido a partir de ${campoOrigem}: ${String(valorRecebido)}.`);
    this.name='CampoNumericoOracleInvalido';
  }
}

function senha(conexao:ConexaoBanco){return conexao.senhaCriptografada.startsWith('criptografado:')?Buffer.from(conexao.senhaCriptografada.slice(14),'base64').toString('utf8'):conexao.senhaCriptografada}
function documento(valor:unknown){return String(valor??'').replace(/\D/g,'')}
function campo<T=any>(linha:any,nome:string):T{return linha?.[nome]??linha?.[nome.toUpperCase()]??linha?.[nome.toLowerCase()]}

/**
 * Serviço transacional da integração com o Construshow.
 *
 * A classe não depende da interface web. Isso permite manter, testar e evoluir
 * a regra de integração sem misturá-la com rotas HTTP ou componentes visuais.
 */
export class ConstrushowIntegrationService {
  private postgres=new Pool({connectionString:env.databaseUrl});

  async iniciar(){await this.postgres.query(`CREATE TABLE IF NOT EXISTS integracoes_construshow(id UUID PRIMARY KEY,integracao_id UUID NOT NULL,empresa_id TEXT NOT NULL,pedido_gmobii TEXT NOT NULL,estab INTEGER,id_carrinho INTEGER,status TEXT NOT NULL,mensagem TEXT,dados_coletados JSONB,dados_construshow JSONB,criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW());
    ALTER TABLE integracoes_construshow ADD COLUMN IF NOT EXISTS historico BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE integracoes_construshow ADD COLUMN IF NOT EXISTS substituido_em TIMESTAMPTZ;
    ALTER TABLE integracoes_construshow DROP CONSTRAINT IF EXISTS integracoes_construshow_integracao_id_pedido_gmobii_key;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_integracoes_construshow_atual ON integracoes_construshow(integracao_id,pedido_gmobii) WHERE historico=FALSE;
    CREATE INDEX IF NOT EXISTS ix_integracoes_construshow_empresa ON integracoes_construshow(empresa_id,atualizado_em DESC);
    CREATE TABLE IF NOT EXISTS validacoes_erp_gmobii(id UUID PRIMARY KEY,integracao_id UUID NOT NULL,empresa_id TEXT NOT NULL,pedido_gmobii TEXT NOT NULL,status TEXT NOT NULL,detalhes JSONB NOT NULL,atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(integracao_id,pedido_gmobii));
    CREATE INDEX IF NOT EXISTS ix_validacoes_erp_gmobii_empresa ON validacoes_erp_gmobii(empresa_id,status,atualizado_em DESC);
    CREATE TABLE IF NOT EXISTS cancelamentos_gmobii(id UUID PRIMARY KEY,integracao_id UUID NOT NULL,empresa_id TEXT NOT NULL,pedido_gmobii TEXT NOT NULL,estab INTEGER NOT NULL,id_carrinho INTEGER NOT NULL,situacao_oracle TEXT NOT NULL,acao TEXT NOT NULL DEFAULT 'excluir',motivo TEXT NOT NULL DEFAULT 'CANC',status TEXT NOT NULL,tentativas INTEGER NOT NULL DEFAULT 0,status_http INTEGER,resposta JSONB,mensagem TEXT,primeira_deteccao TIMESTAMPTZ NOT NULL DEFAULT NOW(),ultima_tentativa TIMESTAMPTZ,concluido_em TIMESTAMPTZ,UNIQUE(integracao_id,estab,id_carrinho));
    CREATE INDEX IF NOT EXISTS ix_cancelamentos_gmobii_pendentes ON cancelamentos_gmobii(empresa_id,status,ultima_tentativa);
    CREATE TABLE IF NOT EXISTS aprovacoes_gmobii(id UUID PRIMARY KEY,integracao_id UUID NOT NULL,empresa_id TEXT NOT NULL,pedido_gmobii TEXT NOT NULL,estab INTEGER NOT NULL,id_carrinho INTEGER NOT NULL,id_nota TEXT NOT NULL,passou_caixa TEXT NOT NULL DEFAULT 'S',status TEXT NOT NULL,tentativas INTEGER NOT NULL DEFAULT 0,status_http INTEGER,resposta JSONB,mensagem TEXT,primeira_deteccao TIMESTAMPTZ NOT NULL DEFAULT NOW(),ultima_tentativa TIMESTAMPTZ,concluido_em TIMESTAMPTZ,UNIQUE(integracao_id,estab,id_carrinho,id_nota));
    CREATE INDEX IF NOT EXISTS ix_aprovacoes_gmobii_pendentes ON aprovacoes_gmobii(empresa_id,status,ultima_tentativa);`);await this.completarLogsErrosAnteriores()}

  private valorAusente(valor:unknown){return valor===undefined||valor===null||(typeof valor==='string'&&valor.trim()==='')||(Array.isArray(valor)&&valor.length===0)}
  private pendenciasObrigatorias(pedido:Pedido){const pendencias:Array<{campo:string;valor:unknown;mensagem:string;produtoIndice?:number;produtoCodigo?:unknown;produtoDescricao?:unknown}>=[];for(const nome of ['numero_pedido','cliente_documento','vendedor_documento','empresa_documento','data_criacao','itens'])if(this.valorAusente(pedido[nome]))pendencias.push({campo:nome,valor:pedido[nome],mensagem:`Campo obrigatório ${nome} não informado.`});if(Array.isArray(pedido.itens))for(const [indice,item] of pedido.itens.entries())for(const nome of ['codigo','quantidade'])if(this.valorAusente(item?.[nome])){const produto=[item?.codigo,item?.descricao].filter(Boolean).join(' — ')||`item ${indice+1}`;pendencias.push({campo:`itens[${indice}].${nome}`,valor:item?.[nome],produtoIndice:indice+1,produtoCodigo:item?.codigo,produtoDescricao:item?.descricao,mensagem:`Produto ${produto}: campo obrigatório ${nome} não informado.`})}return pendencias}
  async validarCamposObrigatorios(integracaoId:string,empresaId:string,pedidoNumero?:string){const {rows}=await this.postgres.query(`SELECT chave_externa,conteudo FROM dados_integracao WHERE integracao_id=$1 AND empresa_id=$2 AND excluido=FALSE AND ($3::text IS NULL OR chave_externa=$3) ORDER BY atualizado_em`,[integracaoId,empresaId,pedidoNumero??null]);return rows.map(row=>({pedido:String(row.chave_externa),pendencias:this.pendenciasObrigatorias(row.conteudo as Pedido)}))}

  private async completarLogsErrosAnteriores(){const {rows}=await this.postgres.query(`SELECT c.* FROM integracoes_construshow c WHERE c.status='erro'`);for(const item of rows){const etapa=item.dados_construshow?.etapa??'tentativa_anterior';const erroNumericoLegado=/NJS-105/i.test(String(item.mensagem??''))&&etapa==='gravacao_cabecalho_carrinho';const complemento=erroNumericoLegado?{campoOracle:'CARRINHO.IDPESS / CARRINHO.IDVENDINDICADO',campoOrigem:'PESSOADOC.IDPESS do cliente e do vendedor',valorRecebido:'NaN',codigoCopiar:`CAMPOS ORACLE: CARRINHO.IDPESS / CARRINHO.IDVENDINDICADO\nORIGEM: PESSOADOC.IDPESS\nVALOR RECEBIDO: NaN\nPEDIDO GMOBII: ${item.pedido_gmobii}`,orientacao:'Os códigos de cliente e vendedor foram localizados, mas a leitura do retorno Oracle não preservou os nomes das colunas. A aplicação foi corrigida; use “Tentar novamente”.'}:{};const detalhes={numeroPedido:item.pedido_gmobii,estab:item.estab,idCarrinho:item.id_carrinho,etapa,codigoOracle:this.codigoOracle(item.mensagem),orientacao:this.orientacaoErroOracle(item.mensagem),...complemento};await this.postgres.query(`UPDATE integracoes_construshow SET dados_construshow=COALESCE(dados_construshow,'{}'::jsonb)||$2::jsonb,atualizado_em=atualizado_em WHERE id=$1`,[item.id,{mensagem:item.mensagem,...detalhes}]);const existe=await this.postgres.query(`SELECT 1 FROM logs_integracao WHERE integracao_id=$1 AND empresa_id=$2 AND evento='integracao_construshow_falhou' AND detalhes->>'numeroPedido'=$3 LIMIT 1`,[item.integracao_id,item.empresa_id,String(item.pedido_gmobii)]);if(existe.rowCount){await this.postgres.query(`UPDATE logs_integracao SET detalhes=COALESCE(detalhes,'{}'::jsonb)||$4::jsonb WHERE integracao_id=$1 AND empresa_id=$2 AND evento='integracao_construshow_falhou' AND detalhes->>'numeroPedido'=$3`,[item.integracao_id,item.empresa_id,String(item.pedido_gmobii),detalhes]);await this.postgres.query(`UPDATE alertas_integracao SET detalhes=COALESCE(detalhes,'{}'::jsonb)||$4::jsonb WHERE integracao_id=$1 AND empresa_id=$2 AND lido=FALSE AND detalhes->>'numeroPedido'=$3`,[item.integracao_id,item.empresa_id,String(item.pedido_gmobii),detalhes])}else await this.salvarLogCancelamento(item.integracao_id,item.empresa_id,'erro','integracao_construshow_falhou',item.mensagem??`Falha ao integrar o pedido ${item.pedido_gmobii}.`,undefined,{...detalhes,dadosColetados:item.dados_coletados})}}
  private codigoOracle(valor:unknown){return String(valor??'').match(/(?:ORA|NJS)-\d{3,5}/i)?.[0]?.toUpperCase()??null}
  private campoInvalidoOracle(valor:unknown){return String(valor??'').match(/ORA-00904:\s*"([^"]+)"/i)?.[1]?.toUpperCase()??null}
  private orientacaoErroOracle(valor:unknown){const texto=String(valor??'');if(/NJS-105/i.test(texto))return 'Um campo numérico foi preparado com valor inválido. Veja o campo e o valor identificados abaixo; corrija a origem e tente novamente.';if(/ORA-00904/i.test(texto)){const campoInvalido=this.campoInvalidoOracle(texto);return campoInvalido?`O Oracle informou que o campo ${campoInvalido} não existe. Os campos próprios da GMOBii usam o sufixo _GM e são criados automaticamente antes da integração.`:'A estrutura Oracle utilizada pela integração está incompleta ou incompatível. Os campos próprios da GMOBii são verificados e criados automaticamente antes da integração.'}if(/ORA-00942/i.test(texto))return 'Confira o schema e as permissões do usuário Oracle para a tabela informada.';if(/ORA-00001/i.test(texto))return 'Registro duplicado identificado. Confira o vínculo existente antes de uma nova tentativa.';return 'Consulte o código Oracle, a etapa registrada e os dados do pedido antes de reenviar.'}

  private numeroOracle(campoOracle:string,campoOrigem:string,valor:unknown){
    const numero=typeof valor==='number'?valor:Number(valor);
    if(!Number.isFinite(numero))throw new CampoNumericoOracleInvalido(campoOracle,campoOrigem,valor);
    return numero;
  }

  /**
   * O ViaSoft exige DTPREVISAOENT preenchida ao abrir o carrinho, mesmo que a
   * coluna Oracle aceite NULL. A previsão parte da data de criação do pedido e
   * soma a quantidade de dias definida na Configuração Construshow (4 por
   * padrão). O horário original é preservado.
   */
  private previsaoEntrega(pedido:Pedido,diasConfigurados:unknown){
    const dataCriacao=new Date(pedido.data_criacao);
    const base=Number.isNaN(dataCriacao.getTime())?new Date():dataCriacao;
    const dias=Math.min(Math.max(Number(diasConfigurados??4)||0,0),999);
    const previsao=new Date(base);
    previsao.setDate(previsao.getDate()+dias);
    return previsao;
  }

  /** Pré-valida e enriquece o pedido com os códigos encontrados no ERP antes da gravação. */
  async preValidar(integracaoId:string,empresaId:string,conexaoBanco:ConexaoBanco,config:ConfiguracaoConstrushowIntegracao,pedidoNumero?:string){
    const {rows}=await this.postgres.query(`SELECT chave_externa,conteudo FROM dados_integracao WHERE integracao_id=$1 AND empresa_id=$2 AND excluido=FALSE AND ($3::text IS NULL OR chave_externa=$3) ORDER BY atualizado_em`,[integracaoId,empresaId,pedidoNumero??null]);
    if(!rows.length)return [];
    const oracle=await import('oracledb');const driver=oracle.default??oracle;let conexao:any;const validacoes:any[]=[];
    try{
      conexao=await driver.getConnection({user:conexaoBanco.usuario,password:senha(conexaoBanco),connectionString:`${conexaoBanco.host}:${conexaoBanco.porta}/${conexaoBanco.bancoOuServico}`});
      // A estrutura técnica é garantida já na pré-validação. Assim a coluna é
      // criada mesmo quando todos os pedidos estão bloqueados por dados/cadastros.
      await this.colunaPedidoCarrinho(conexao,driver,integracaoId,empresaId);
      await this.resolverFalhasEstruturaCorrigida(integracaoId,empresaId);
      for(const row of rows){
        const pedido=row.conteudo as Pedido;const pendencias:any[]=[];
        const localizarPessoa=async(tipo:'cliente'|'vendedor',doc:string,padrao?:number)=>{
          const colunaMarcacao=tipo==='cliente'?'EHCLIENTE':'EHREPRESENTANTE';
          const rotuloMarcacao=tipo==='cliente'?'Cadastro Não é Cliente':'Cadastro Não é Vendedor';
          const regraMarcacao=tipo==='cliente'
            ? "EXISTS(SELECT 1 FROM PESSOADOCMCP M WHERE M.IDPESS=P.IDPESS AND NVL(M.EHCLIENTE,'N')='S')"
            : "NVL(P.EHREPRESENTANTE,'N')='S'";
          const consultar=async(filtro:'documento'|'codigo',valor:string|number)=>conexao.execute(
            `SELECT P.IDPESS,P.NOME,CASE WHEN ${regraMarcacao} THEN 'S' ELSE 'N' END CADASTRO_VALIDO FROM PESSOADOC P WHERE ${filtro==='documento'?"REGEXP_REPLACE(P.CNPJF,'[^0-9]','')=:valor":"P.IDPESS=:valor"} FETCH FIRST 1 ROWS ONLY`,
            {valor},
            {outFormat:driver.OUT_FORMAT_OBJECT},
          );
          let resultado=doc?await consultar('documento',doc):{rows:[]};
          let origem='documento';
          if(!resultado.rows?.length&&padrao){resultado=await consultar('codigo',padrao);origem='configuracao_padrao'}
          if(resultado.rows?.length){
            const linha=resultado.rows[0];
            const codigoErp=Number(campo(linha,'IDPESS'));
            const cadastroValido=String(campo(linha,'CADASTRO_VALIDO')??'N').toUpperCase()==='S';
            const origemMarcacao=tipo==='cliente'?'PESSOADOCMCP.EHCLIENTE': 'PESSOADOC.EHREPRESENTANTE';
            if(!cadastroValido)pendencias.push({entidade:tipo,tipo:'marcacao_obrigatoria',campo:`${tipo}_${colunaMarcacao.toLowerCase()}`,rotulo:rotuloMarcacao,valor:`IDPESS ${codigoErp}`,codigoErp,mensagem:`${rotuloMarcacao}: o IDPESS ${codigoErp} foi localizado, porém ${origemMarcacao} não está marcado como 'S'.`});
            return {documento:doc,codigoErp,nome:campo(linha,'NOME'),encontrado:true,cadastroValido,marcacaoObrigatoria:colunaMarcacao,origem};
          }
          pendencias.push({entidade:tipo,tipo:'nao_localizado',campo:`${tipo}_codigo_erp`,rotulo:`Código ERP do ${tipo}`,valor:doc||padrao,mensagem:`${tipo} não localizado no ERP pelo documento e sem cadastro padrão válido configurado.`});
          return {documento:doc,encontrado:false,cadastroValido:false,marcacaoObrigatoria:colunaMarcacao};
        };
        const docEmpresa=documento(pedido.empresa_documento);const filial=docEmpresa?await conexao.execute(`SELECT ESTAB,REDUZIDO FROM FILIAL WHERE ESTAB=:estab AND REGEXP_REPLACE(CNPJ,'[^0-9]','')=:doc FETCH FIRST 1 ROWS ONLY`,{estab:config.estab,doc:docEmpresa},{outFormat:driver.OUT_FORMAT_OBJECT}):{rows:[]};
        const empresa=filial.rows?.length?{documento:docEmpresa,codigoErp:Number(campo(filial.rows[0],'ESTAB')),nome:campo(filial.rows[0],'REDUZIDO'),encontrado:true}:{documento:docEmpresa,codigoErp:config.estab,encontrado:false};
        if(!empresa.encontrado)pendencias.push({entidade:'empresa',campo:'empresa_codigo_erp',rotulo:'Código ERP da filial',valor:docEmpresa,mensagem:`Empresa não localizada no ERP para a filial ${config.estab}.`});
        const cliente=await localizarPessoa('cliente',documento(pedido.cliente_documento),config.idCliente);const vendedor=await localizarPessoa('vendedor',documento(pedido.vendedor_documento),config.idVendedor);
        const produtos=[];for(const [indice,item] of (Array.isArray(pedido.itens)?pedido.itens:[]).entries()){const codigo=item.codigo;const r=codigo!==null&&codigo!==undefined&&String(codigo).trim()?await conexao.execute(`SELECT IDITEM,DESCRICAO FROM ITEM WHERE ESTAB=:estab AND IDITEM=:id FETCH FIRST 1 ROWS ONLY`,{estab:config.estabProduto,id:Number(codigo)},{outFormat:driver.OUT_FORMAT_OBJECT}):{rows:[]};const encontrado=Boolean(r.rows?.length);produtos.push({indice:indice+1,codigoRecebido:codigo,codigoErp:encontrado?Number(campo(r.rows[0],'IDITEM')):null,descricao:encontrado?campo(r.rows[0],'DESCRICAO'):null,encontrado});if(!encontrado)pendencias.push({entidade:'produto',campo:`itens[${indice}].codigo_erp`,rotulo:`Código ERP do produto ${indice+1}`,valor:codigo,mensagem:`Produto ${codigo??'não informado'} não localizado no estabelecimento ${config.estabProduto}.`})}
        const detalhes={cliente,vendedor,empresa,produtos,pendencias};const status=pendencias.length?'pendente':'apto';
        await this.postgres.query(`INSERT INTO validacoes_erp_gmobii(id,integracao_id,empresa_id,pedido_gmobii,status,detalhes,atualizado_em) VALUES($1,$2,$3,$4,$5,$6,NOW()) ON CONFLICT(integracao_id,pedido_gmobii) DO UPDATE SET status=EXCLUDED.status,detalhes=EXCLUDED.detalhes,atualizado_em=NOW()`,[randomUUID(),integracaoId,empresaId,String(row.chave_externa),status,detalhes]);
        await this.registrarAlertaPreValidacao(integracaoId,empresaId,String(row.chave_externa),pendencias);
        validacoes.push({pedido:String(row.chave_externa),status,detalhes});
      }
      return validacoes;
    }finally{if(conexao)await conexao.close().catch(()=>undefined)}
  }

  private async registrarAlertaPreValidacao(integracaoId:string,empresaId:string,pedido:string,pendencias:any[]){
    if(!pendencias.length){await this.postgres.query(`UPDATE alertas_integracao SET lido=TRUE,resolvido_em=NOW() WHERE integracao_id=$1 AND empresa_id=$2 AND lido=FALSE AND detalhes->>'origem'='pre_validacao_erp' AND detalhes->>'numeroPedido'=$3`,[integracaoId,empresaId,pedido]);return}
    const titulo=`Pedido ${pedido} · cadastros não aptos no ERP`;
    const mensagem=pendencias.map((pendencia)=>String(pendencia.mensagem??'Cadastro obrigatório não localizado no ERP.')).join(' · ');
    const detalhes={origem:'pre_validacao_erp',numeroPedido:pedido,tipoProblema:'validacao_cadastro_erp',divergenciasErp:pendencias};
    const atualizado=await this.postgres.query(`UPDATE alertas_integracao SET severidade='critico',titulo=$4,mensagem=$5,detalhes=$6,lido=FALSE,resolvido_em=NULL,criado_em=NOW() WHERE id=(SELECT id FROM alertas_integracao WHERE integracao_id=$1 AND empresa_id=$2 AND detalhes->>'origem'='pre_validacao_erp' AND detalhes->>'numeroPedido'=$3 ORDER BY criado_em DESC LIMIT 1)`,[integracaoId,empresaId,pedido,titulo,mensagem,detalhes]);
    if(!atualizado.rowCount)await this.postgres.query(`INSERT INTO alertas_integracao(id,integracao_id,empresa_id,severidade,titulo,mensagem,detalhes,lido,criado_em) VALUES($1,$2,$3,'critico',$4,$5,$6,FALSE,NOW())`,[randomUUID(),integracaoId,empresaId,titulo,mensagem,detalhes]);
  }

  /**
   * Detecta carrinhos cancelados no ViaSoft e comunica a exclusão à GMOBii.
   * A operação é idempotente: um carrinho concluído nunca é reenviado e uma
   * resposta 404 após a detecção é aceita como exclusão já processada.
   */
  async processarCancelamentos(integracaoId:string,empresaId:string,conexaoBanco:ConexaoBanco,token:string,urlBase:string,acao:'excluir'|'devolver'='excluir'){
    const {rows}=await this.postgres.query(`SELECT pedido_gmobii,estab,id_carrinho FROM integracoes_construshow WHERE integracao_id=$1 AND empresa_id=$2 AND historico=FALSE AND status IN ('integrado','existente') AND id_carrinho IS NOT NULL ORDER BY atualizado_em`,[integracaoId,empresaId]);
    if(!rows.length)return {verificados:0,cancelados:0,erros:0};
    let conexao:any;let cancelados=0;let erros=0;
    try{
      const oracle=await import('oracledb');const driver=oracle.default??oracle;
      conexao=await driver.getConnection({user:conexaoBanco.usuario,password:senha(conexaoBanco),connectionString:`${conexaoBanco.host}:${conexaoBanco.porta}/${conexaoBanco.bancoOuServico}`});
      for(const item of rows){
        const resultado=await conexao.execute(`SELECT SITUACAO FROM CARRINHO WHERE ESTAB=:estab AND IDCARRINHO=:id FETCH FIRST 1 ROWS ONLY`,{estab:Number(item.estab),id:Number(item.id_carrinho)},{outFormat:driver.OUT_FORMAT_OBJECT});
        if(String(campo(resultado.rows?.[0],'SITUACAO')??'').trim().toUpperCase()!=='E')continue;
        const controle=await this.registrarDeteccaoCancelamento(integracaoId,empresaId,item,acao);
        if(controle.status==='concluido'||controle.status==='bloqueado')continue;
        if(controle.ultima_tentativa&&Date.now()-new Date(controle.ultima_tentativa).getTime()<5*60000)continue;
        try{await this.enviarExclusaoGmobii(integracaoId,empresaId,controle,token,urlBase);cancelados++}catch{erros++}
      }
      return {verificados:rows.length,cancelados,erros};
    }finally{if(conexao)await conexao.close().catch(()=>undefined)}
  }

  private async registrarDeteccaoCancelamento(integracaoId:string,empresaId:string,item:any,acao:'excluir'|'devolver'){const {rows}=await this.postgres.query(`INSERT INTO cancelamentos_gmobii(id,integracao_id,empresa_id,pedido_gmobii,estab,id_carrinho,situacao_oracle,acao,motivo,status) VALUES($1,$2,$3,$4,$5,$6,'E',$7,'CANC','pendente') ON CONFLICT(integracao_id,estab,id_carrinho) DO UPDATE SET situacao_oracle='E',acao=CASE WHEN cancelamentos_gmobii.status IN ('pendente','erro') THEN EXCLUDED.acao ELSE cancelamentos_gmobii.acao END RETURNING *`,[randomUUID(),integracaoId,empresaId,item.pedido_gmobii,Number(item.estab),Number(item.id_carrinho),acao]);return rows[0]}

  private async enviarExclusaoGmobii(integracaoId:string,empresaId:string,controle:any,token:string,urlBase:string){
    const acao=controle.acao==='devolver'?'devolver':'excluir';
    const corpo={acao,numero:String(controle.pedido_gmobii),motivo:'CANC'};
    let resposta:Response|undefined;let conteudo:any={};
    try{
      resposta=await fetch(urlBase,{method:'POST',headers:{'x-api-key':token,'Content-Type':'application/json'},body:JSON.stringify(corpo),signal:AbortSignal.timeout(env.integrationTimeoutMs)});
      conteudo=await resposta.json().catch(()=>({}));
      if(resposta.ok||(acao==='excluir'&&resposta.status===404)){
        const descricao=acao==='devolver'?'devolvido para a GMOBii':'excluído na GMOBii';
        await this.postgres.query(`UPDATE cancelamentos_gmobii SET status='concluido',tentativas=tentativas+1,status_http=$2,resposta=$3,mensagem=$4,ultima_tentativa=NOW(),concluido_em=NOW() WHERE id=$1`,[controle.id,resposta.status,conteudo,resposta.status===404?'Pedido já não está disponível na GMOBii; operação considerada concluída.':`Pedido ${descricao}.`]);
        await this.salvarLogCancelamento(integracaoId,empresaId,'info','cancelamento_gmobii_concluido',`Pedido ${controle.pedido_gmobii} ${descricao} após cancelamento do carrinho ${controle.id_carrinho}.`,resposta.status,{...corpo,resposta:conteudo,estab:controle.estab,idCarrinho:controle.id_carrinho});return;
      }
      const bloqueado=[400,401,404,405,409].includes(resposta.status);const mensagem=String(conteudo?.mensagem??`GMOBii respondeu HTTP ${resposta.status}.`);
      await this.postgres.query(`UPDATE cancelamentos_gmobii SET status=$2,tentativas=tentativas+1,status_http=$3,resposta=$4,mensagem=$5,ultima_tentativa=NOW() WHERE id=$1`,[controle.id,bloqueado?'bloqueado':'erro',resposta.status,conteudo,mensagem]);
      await this.registrarFalhaCancelamento(integracaoId,empresaId,controle,mensagem,resposta.status,conteudo);throw new Error(mensagem);
    }catch(error){
      if(resposta)throw error;const mensagem=error instanceof Error?error.message:'Falha de comunicação com a GMOBii.';
      await this.postgres.query(`UPDATE cancelamentos_gmobii SET status='erro',tentativas=tentativas+1,mensagem=$2,ultima_tentativa=NOW() WHERE id=$1`,[controle.id,mensagem]);
      await this.registrarFalhaCancelamento(integracaoId,empresaId,controle,mensagem,undefined,{});throw error;
    }
  }

  private async registrarFalhaCancelamento(integracaoId:string,empresaId:string,controle:any,mensagem:string,statusHttp?:number,resposta?:any){
    const operacao=controle.acao==='devolver'?'retornar':'excluir';
    await this.salvarLogCancelamento(integracaoId,empresaId,'erro','cancelamento_gmobii_falhou',`Não foi possível ${operacao} o pedido ${controle.pedido_gmobii} na GMOBii: ${mensagem}`,statusHttp,{pedido:controle.pedido_gmobii,estab:controle.estab,idCarrinho:controle.id_carrinho,acao:controle.acao,motivo:'CANC',resposta});
    const detalhes={origem:'cancelamento_construshow',numeroPedido:String(controle.pedido_gmobii),estab:controle.estab,idCarrinho:controle.id_carrinho,motivo:'CANC'};
    const titulo=`Falha ao ${operacao} pedido ${controle.pedido_gmobii} na GMOBii`;
    const atualizado=await this.postgres.query(`UPDATE alertas_integracao SET severidade='critico',titulo=$4,mensagem=$5,detalhes=$6,criado_em=NOW() WHERE id=(SELECT id FROM alertas_integracao WHERE integracao_id=$1 AND empresa_id=$2 AND lido=FALSE AND detalhes->>'origem'='cancelamento_construshow' AND detalhes->>'numeroPedido'=$3 ORDER BY criado_em DESC LIMIT 1)`,[integracaoId,empresaId,String(controle.pedido_gmobii),titulo,mensagem,detalhes]);
    if(!atualizado.rowCount)await this.postgres.query(`INSERT INTO alertas_integracao(id,integracao_id,empresa_id,severidade,titulo,mensagem,detalhes,lido,criado_em) VALUES($1,$2,$3,'critico',$4,$5,$6,FALSE,NOW())`,[randomUUID(),integracaoId,empresaId,titulo,mensagem,detalhes]);
  }
  private async salvarLogCancelamento(integracaoId:string,empresaId:string,nivel:string,evento:string,mensagem:string,statusHttp?:number,detalhes?:any){await this.postgres.query(`INSERT INTO logs_integracao(id,integracao_id,empresa_id,nivel,evento,mensagem,status_http,detalhes,criado_em) VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,[randomUUID(),integracaoId,empresaId,nivel,evento,mensagem,statusHttp??null,detalhes??null])}

  /**
   * Localiza a nota vinculada ao carrinho e aprova o pedido na GMOBii somente
   * depois que o ViaSoft indicar que o documento já passou pelo caixa.
   *
   * A tabela de controle garante idempotência local. A própria GMOBii também
   * permite repetir `produzir`: quando o pedido já está em produção, devolve
   * HTTP 200 com a data original e apenas atualiza carrinho/nota informados.
   */
  async processarAprovacoes(integracaoId:string,empresaId:string,conexaoBanco:ConexaoBanco,token:string,urlBase:string){
    const {rows}=await this.postgres.query(`SELECT pedido_gmobii,estab,id_carrinho FROM integracoes_construshow WHERE integracao_id=$1 AND empresa_id=$2 AND historico=FALSE AND status IN ('integrado','existente') AND id_carrinho IS NOT NULL ORDER BY atualizado_em`,[integracaoId,empresaId]);
    if(!rows.length)return {verificados:0,aprovados:0,erros:0};
    let conexao:any;let aprovados=0;let erros=0;
    try{
      const oracle=await import('oracledb');const driver=oracle.default??oracle;
      conexao=await driver.getConnection({user:conexaoBanco.usuario,password:senha(conexaoBanco),connectionString:`${conexaoBanco.host}:${conexaoBanco.porta}/${conexaoBanco.bancoOuServico}`});
      for(const item of rows){
        // Pode existir mais de uma nota vinculada. A mais recente que já saiu
        // do caixa é usada, preservando exatamente seu identificador como texto.
        const resultado=await conexao.execute(`SELECT NC.ESTAB,NC.IDNOTA,NC.IDCARRINHO,CASE WHEN N.MOSTRACAIXA <> 1 THEN 'S' ELSE 'N' END PASSOUCAIXA FROM NOTA N INNER JOIN NOTACARRINHO NC ON NC.ESTAB=N.ESTAB AND NC.IDNOTA=N.IDNOTA INNER JOIN CARRINHO C ON C.ESTAB=NC.ESTAB AND C.IDCARRINHO=NC.IDCARRINHO WHERE NC.ESTAB=:estab AND NC.IDCARRINHO=:id AND COALESCE(C.SITUACAO,'A')<>'E' ORDER BY NC.IDNOTA DESC`,{estab:Number(item.estab),id:Number(item.id_carrinho)},{outFormat:driver.OUT_FORMAT_OBJECT});
        const nota=(resultado.rows??[]).find((linha:any)=>String(campo(linha,'PASSOUCAIXA')??'N').trim().toUpperCase()==='S');
        if(!nota)continue;
        const idNota=String(campo(nota,'IDNOTA'));
        const controle=await this.registrarDeteccaoAprovacao(integracaoId,empresaId,item,idNota);
        if(controle.status==='concluido'||controle.status==='bloqueado')continue;
        if(controle.ultima_tentativa&&Date.now()-new Date(controle.ultima_tentativa).getTime()<5*60000)continue;
        try{await this.enviarAprovacaoGmobii(integracaoId,empresaId,controle,token,urlBase);aprovados++}catch{erros++}
      }
      return {verificados:rows.length,aprovados,erros};
    }finally{if(conexao)await conexao.close().catch(()=>undefined)}
  }

  private async registrarDeteccaoAprovacao(integracaoId:string,empresaId:string,item:any,idNota:string){
    const {rows}=await this.postgres.query(`INSERT INTO aprovacoes_gmobii(id,integracao_id,empresa_id,pedido_gmobii,estab,id_carrinho,id_nota,passou_caixa,status) VALUES($1,$2,$3,$4,$5,$6,$7,'S','pendente') ON CONFLICT(integracao_id,estab,id_carrinho,id_nota) DO UPDATE SET passou_caixa='S' RETURNING *`,[randomUUID(),integracaoId,empresaId,String(item.pedido_gmobii),Number(item.estab),Number(item.id_carrinho),idNota]);
    return rows[0];
  }

  private async enviarAprovacaoGmobii(integracaoId:string,empresaId:string,controle:any,token:string,urlBase:string){
    const corpo={acao:'produzir',numero:String(controle.pedido_gmobii),numero_carrinho:String(controle.id_carrinho),numero_nota:String(controle.id_nota)};
    let resposta:Response|undefined;let conteudo:any={};
    try{
      resposta=await fetch(urlBase,{method:'POST',headers:{'x-api-key':token,'Content-Type':'application/json'},body:JSON.stringify(corpo),signal:AbortSignal.timeout(env.integrationTimeoutMs)});
      conteudo=await resposta.json().catch(()=>({}));
      const situacao=String(conteudo?.pedido?.situacao??'');
      if(resposta.status===200&&situacao==='em_producao'){
        await this.postgres.query(`UPDATE aprovacoes_gmobii SET status='concluido',tentativas=tentativas+1,status_http=200,resposta=$2,mensagem='Pedido aprovado para produção na GMOBii.',ultima_tentativa=NOW(),concluido_em=NOW() WHERE id=$1`,[controle.id,conteudo]);
        await this.salvarLogCancelamento(integracaoId,empresaId,'info','aprovacao_gmobii_concluida',`Pedido ${controle.pedido_gmobii} aprovado após o carrinho ${controle.id_carrinho} passar pelo caixa.`,200,{...corpo,resposta:conteudo,estab:controle.estab});
        await this.postgres.query(`UPDATE alertas_integracao SET lido=TRUE,resolvido_em=NOW() WHERE integracao_id=$1 AND empresa_id=$2 AND lido=FALSE AND detalhes->>'origem'='aprovacao_construshow' AND detalhes->>'numeroPedido'=$3`,[integracaoId,empresaId,String(controle.pedido_gmobii)]);
        return;
      }
      const mensagem=resposta.status===200?`Resposta 200 recebida sem situacao em_producao (recebido: ${situacao||'não informado'}).`:String(conteudo?.mensagem??`GMOBii respondeu HTTP ${resposta.status}.`);
      const bloqueado=[400,401,404,409].includes(resposta.status);
      await this.postgres.query(`UPDATE aprovacoes_gmobii SET status=$2,tentativas=tentativas+1,status_http=$3,resposta=$4,mensagem=$5,ultima_tentativa=NOW() WHERE id=$1`,[controle.id,bloqueado?'bloqueado':'erro',resposta.status,conteudo,mensagem]);
      await this.registrarFalhaAprovacao(integracaoId,empresaId,controle,mensagem,resposta.status,conteudo);throw new Error(mensagem);
    }catch(error){
      if(resposta)throw error;const mensagem=error instanceof Error?error.message:'Falha de comunicação com a GMOBii.';
      await this.postgres.query(`UPDATE aprovacoes_gmobii SET status='erro',tentativas=tentativas+1,mensagem=$2,ultima_tentativa=NOW() WHERE id=$1`,[controle.id,mensagem]);
      await this.registrarFalhaAprovacao(integracaoId,empresaId,controle,mensagem,undefined,{});throw error;
    }
  }

  private async registrarFalhaAprovacao(integracaoId:string,empresaId:string,controle:any,mensagem:string,statusHttp?:number,resposta?:any){
    const detalhes={origem:'aprovacao_construshow',numeroPedido:String(controle.pedido_gmobii),estab:controle.estab,idCarrinho:controle.id_carrinho,idNota:controle.id_nota,resposta};
    await this.salvarLogCancelamento(integracaoId,empresaId,'erro','aprovacao_gmobii_falhou',`Não foi possível aprovar o pedido ${controle.pedido_gmobii} na GMOBii: ${mensagem}`,statusHttp,detalhes);
    const titulo=`Falha ao aprovar pedido ${controle.pedido_gmobii} na GMOBii`;
    const atualizado=await this.postgres.query(`UPDATE alertas_integracao SET severidade='critico',titulo=$4,mensagem=$5,detalhes=$6,criado_em=NOW() WHERE id=(SELECT id FROM alertas_integracao WHERE integracao_id=$1 AND empresa_id=$2 AND lido=FALSE AND detalhes->>'origem'='aprovacao_construshow' AND detalhes->>'numeroPedido'=$3 ORDER BY criado_em DESC LIMIT 1)`,[integracaoId,empresaId,String(controle.pedido_gmobii),titulo,mensagem,detalhes]);
    if(!atualizado.rowCount)await this.postgres.query(`INSERT INTO alertas_integracao(id,integracao_id,empresa_id,severidade,titulo,mensagem,detalhes,lido,criado_em) VALUES($1,$2,$3,'critico',$4,$5,$6,FALSE,NOW())`,[randomUUID(),integracaoId,empresaId,titulo,mensagem,detalhes]);
  }

  async integrar(integracaoId:string,empresaId:string,conexao:ConexaoBanco,config:ConfiguracaoConstrushowIntegracao,pedidoNumero?:string){
    const {rows}=await this.postgres.query(`SELECT chave_externa,conteudo FROM dados_integracao d WHERE integracao_id=$1 AND empresa_id=$2 AND d.excluido=FALSE AND ($3::text IS NULL OR d.chave_externa=$3) AND EXISTS(SELECT 1 FROM validacoes_erp_gmobii v WHERE v.integracao_id=d.integracao_id AND v.pedido_gmobii=d.chave_externa AND v.status='apto') AND NOT EXISTS(SELECT 1 FROM integracoes_construshow c WHERE c.integracao_id=d.integracao_id AND c.pedido_gmobii=d.chave_externa AND c.historico=FALSE AND c.status IN ('integrado','existente') AND NOT EXISTS(SELECT 1 FROM cancelamentos_gmobii x WHERE x.integracao_id=c.integracao_id AND x.empresa_id=c.empresa_id AND x.estab=c.estab AND x.id_carrinho=c.id_carrinho AND x.status='concluido' AND x.concluido_em IS NOT NULL AND d.atualizado_em>x.concluido_em)) ORDER BY data_referencia`,[integracaoId,empresaId,pedidoNumero??null]);
    const resultados=[];
    for(const row of rows){const pendencias=this.pendenciasObrigatorias(row.conteudo as Pedido);if(pendencias.length){await this.salvarLogCancelamento(integracaoId,empresaId,'aviso','pedido_bloqueado_validacao',`Pedido ${row.chave_externa} não enviado ao Oracle: ${pendencias.length} campo(s) obrigatório(s) pendente(s).`,undefined,{numeroPedido:String(row.chave_externa),etapa:'validacao_anterior_integracao',pendencias});continue}resultados.push(await this.integrarPedido(integracaoId,empresaId,conexao,config,row.conteudo))}
    return resultados;
  }

  private async integrarPedido(integracaoId:string,empresaId:string,conexaoBanco:ConexaoBanco,config:ConfiguracaoConstrushowIntegracao,pedido:Pedido){
    const numero=String(pedido.numero_pedido);
    let oracle:any; let conexao:any;let etapa='abertura_conexao_oracle';
    try{
      oracle=await import('oracledb'); const driver=oracle.default??oracle;
      conexao=await driver.getConnection({user:conexaoBanco.usuario,password:senha(conexaoBanco),connectionString:`${conexaoBanco.host}:${conexaoBanco.porta}/${conexaoBanco.bancoOuServico}`});
      etapa='identificacao_coluna_pedido';
      const colunaPedido=await this.colunaPedidoCarrinho(conexao,driver,integracaoId,empresaId);
      // Idempotência: carrinhos existentes são apenas associados e nunca alterados.
      etapa='consulta_carrinho_existente';
      const existente=await conexao.execute(`SELECT IDCARRINHO FROM CARRINHO WHERE ESTAB=:estab AND ${colunaPedido}=:pedido AND COALESCE(SITUACAO,'A')<>'E' FETCH FIRST 1 ROWS ONLY`,{estab:config.estab,pedido:numero},{outFormat:driver.OUT_FORMAT_OBJECT});
      if(existente.rows?.length)return await this.registrar(integracaoId,empresaId,numero,config.estab,Number(campo(existente.rows[0],'IDCARRINHO')),'existente','Carrinho já existente; nenhuma alteração realizada.',pedido);

      etapa='validacao_empresa_cliente_vendedor';
      await this.validarEmpresa(conexao,documento(pedido.empresa_documento),config.estab);
      const idCliente=await this.localizarPessoa(conexao,driver,documento(pedido.cliente_documento),config.idCliente,'cliente');
      const idVendedor=await this.localizarPessoa(conexao,driver,documento(pedido.vendedor_documento),config.idVendedor,'vendedor');
      const itens=Array.isArray(pedido.itens)?pedido.itens:[];
      if(!itens.length)throw new Error('Pedido sem itens; integração cancelada.');
      etapa='validacao_produtos';const produtos=[];
      for(const [indice,item] of itens.entries()){
        if(!item.codigo)throw new Error(`Item ${indice+1} sem código de produto.`);
        const r=await conexao.execute(`SELECT IDITEM,UNIDADE,DESCRICAO FROM ITEM WHERE ESTAB=:estab AND IDITEM=:id FETCH FIRST 1 ROWS ONLY`,{estab:config.estabProduto,id:String(item.codigo)},{outFormat:driver.OUT_FORMAT_OBJECT});
        if(!r.rows?.length)throw new CadastroErpNaoLocalizado(`Produto ${item.codigo} não localizado no estabelecimento ${config.estabProduto}.`,'produto',`itens[${indice}].codigo`,item.codigo);
        const idItem=String(campo(r.rows[0],'IDITEM'));
        const quantidade=this.numeroOracle(`CARRINHOITEM.QUANTIDADE (item ${indice+1})`,`GMOBii.itens[${indice}].quantidade`,item.quantidade);
        const valorRecebido=Number(item.valor);
        const buscarPreco=!Number.isFinite(valorRecebido)||valorRecebido<=0;
        let valorUnitario=valorRecebido;
        if(buscarPreco){
          const preco=await conexao.execute(`SELECT COALESCE(TRUARR(CASE WHEN COALESCE(P.PRECO2,0)=0 THEN P.PRECO ELSE P.PRECO2 END,FCV.DECVALOR,FCP.IAT),0) AS PRECO FROM (SELECT :estab AS ESTAB,:iditem AS IDITEM FROM DUAL) X INNER JOIN TABLE(RETORNAITEMPRECO(X.ESTAB,X.IDITEM,0,'S',0)) P ON (0=0) LEFT JOIN FILIALCONFPROC FCP ON FCP.ESTAB=X.ESTAB LEFT JOIN FILIALCONFVDA FCV ON FCV.ESTAB=X.ESTAB FETCH FIRST 1 ROWS ONLY`,{estab:config.estab,iditem:this.numeroOracle('RETORNAITEMPRECO.IDITEM',`ITEM.IDITEM do produto ${item.codigo}`,idItem)},{outFormat:driver.OUT_FORMAT_OBJECT});
          valorUnitario=Number(campo(preco.rows?.[0],'PRECO')??0);
          if(!Number.isFinite(valorUnitario)||valorUnitario<=0)throw new CadastroErpNaoLocalizado(`Produto ${item.codigo} está sem valor na GMOBii e não possui preço válido no Construshow para a filial ${config.estab}.`,'produto',`itens[${indice}].valor`,item.valor);
        }
        const valorTotal=buscarPreco?valorUnitario*quantidade:valorRecebido;
        if(!buscarPreco)valorUnitario=quantidade?valorTotal/quantidade:valorTotal;
        produtos.push({...item,idItem,unidade:campo(r.rows[0],'UNIDADE'),quantidadeIntegracao:quantidade,valorUnitario,valorTotal,origemValor:buscarPreco?'construshow':'gmobii'});
      }
      etapa='validacao_configuracao_documento';const tipo=await conexao.execute(`SELECT N.IDTIPOOPER FROM NOTACONF N WHERE N.ESTAB=:estab AND N.IDNOTACONF=:id FETCH FIRST 1 ROWS ONLY`,{estab:config.estabNc,id:config.idNotaConf},{outFormat:driver.OUT_FORMAT_OBJECT});
      if(!tipo.rows?.length)throw new Error('Configuração de documento não localizada no Construshow.');
      const retirada=await conexao.execute(`SELECT IDLOCALRETIRADA FROM LOCALRETIRADA WHERE ESTAB=:estab AND PADENTREGA='S' FETCH FIRST 1 ROWS ONLY`,{estab:config.estab},{outFormat:driver.OUT_FORMAT_OBJECT});
      const idLocal=this.numeroOracle('CARRINHOITEM.IDLOCALRETIRADA','LOCALRETIRADA.IDLOCALRETIRADA',campo(retirada.rows?.[0],'IDLOCALRETIRADA')??0);
      const chave=await conexao.execute(`SELECT VIASOFTMCP.SEQPRIMARYKEY_INT('CARRINHO','*','IDCARRINHO') IDCARRINHO FROM DUAL`,{},{outFormat:driver.OUT_FORMAT_OBJECT});
      const idCarrinho=this.numeroOracle('CARRINHO.IDCARRINHO',"VIASOFTMCP.SEQPRIMARYKEY_INT('CARRINHO')",campo(chave.rows[0],'IDCARRINHO'));
      const total=produtos.reduce((s,i)=>s+i.valorTotal,0);
      const observacao=`**GMOBII-API** PEDIDO: ${numero} | ${pedido.observacoes??''} | Chapas: ${pedido.chapas_total??0} | Deslocamentos: ${pedido.deslocamentos??0} | Fita: ${pedido.fita_borda_m??0}`.slice(0,1000);

      const bindsCabecalho={
        id:idCarrinho,
        cartao:String(idCarrinho),
        estab:this.numeroOracle('CARRINHO.ESTAB','Configuração Construshow > Filial',config.estab),
        abertura:new Date(pedido.data_criacao),
        cliente:this.numeroOracle('CARRINHO.IDPESS','Código ERP do cliente (PESSOADOC.IDPESS)',idCliente),
        nome:String(pedido.cliente??''),
        obs:observacao,
        pedidoNumero:this.numeroOracle('CARRINHO.NRODAV','GMOBii.numero_pedido',numero),
        pedidoGmobii:numero,
        nota:this.numeroOracle('CARRINHO.IDNOTACONF','Configuração Construshow > Configuração de documento',config.idNotaConf),
        validade:new Date(Date.now()+this.numeroOracle('CARRINHO.DTVALIDADE','Configuração Construshow > Validade do carrinho',config.validadeCarrinho)*86400000),
        vendedor:this.numeroOracle('CARRINHO.IDVENDINDICADO','Código ERP do vendedor (PESSOADOC.IDPESS)',idVendedor),
        documento:documento(pedido.cliente_documento),
        total:this.numeroOracle('CARRINHO.TOTAL_GM','Soma dos valores dos itens',total),
      };

      // A gravação ocorre somente depois de todas as validações acima.
      etapa='gravacao_cabecalho_carrinho';await conexao.execute(`INSERT INTO CARRINHO(IDCARRINHO,ESTAB,NROCARTAO,DTABERT,SITUACAO,IDPESS,NOME,TAXAFRETE,OBS,BLOQUEADO,NRODAV,DESPESAS,INVALIDO,IAT,IDNOTACONF,DTVALIDADE,JUROS,DESPCAIXA,FORMACOMPRA,PRAZOMED,TAXAPRAZO,IDVENDINDICADO,OVERPRICE,USAFRETEMANUAL,CPFCNPJ,TAXAFRETEMIN,PRAZOMEDPGTO,${colunaPedido},TOTDESCONTO_GM,TOTTAXAFRETE_GM,TOTAL_GM) VALUES(:id,:estab,:cartao,:abertura,'A',:cliente,:nome,0,:obs,'N',:pedidoNumero,0,'N','A',:nota,:validade,0,0,9,60,0,:vendedor,0,'S',:documento,0,0,:pedidoGmobii,0,0,:total)`,bindsCabecalho,{autoCommit:false});
      etapa='gravacao_historico_carrinho';
      await conexao.execute(`INSERT INTO CARRINHOHIST(IDCARRINHO,SEQHIST,USERIDALT,OLDVALUE,NEWVALUE,DTHRALT,IDDOCTO) VALUES(:id,1,'INTEGRACAO',NULL,'A',SYSTIMESTAMP,0)`,{id:idCarrinho},{autoCommit:false});
      etapa='gravacao_itens_carrinho';
      const previsaoEntrega=this.previsaoEntrega(pedido,config.diasPrevisaoEntrega);
      for(const [indice,item] of produtos.entries()){
        const quantidade=item.quantidadeIntegracao; const unitario=item.valorUnitario; const valor=item.valorTotal;
        await conexao.execute(`INSERT INTO CARRINHOITEM(ESTAB,IDCARRINHO,SEQITEM,IDITEM,QUANTIDADE,VALORUNIT,IDVENDEDOR,DESCITEM,DESCONTO,INVALIDO,ENTREGAR,QTDEENTREGA,PROMOCAO,IDLOCALRETIRADA,ESTABBX,CUSTOAQUIS,DTPREVISAOENT,VALORC,SERVICO,ADDAGREGADO,PRECONORMALORI,PRECOPROMOORI,PRECOTABELAORI,QTDEVOL,TOTQTDEVOL,ESTOQUE,ESTABLOCALRETENTREGA,CFOP) VALUES(:estab,:carrinho,:seq,:item,:quantidade,:unitario,:vendedor,0,0,'N','S',:quantidade,'N',:local,:estab,0,:previsao,:valor,'N','N',:unitario,:unitario,:unitario,:quantidade,:quantidade,'N',:estab,'5405')`,{estab:config.estab,carrinho:idCarrinho,seq:indice+1,item:item.idItem,quantidade,unitario,vendedor:idVendedor,local:idLocal,previsao:previsaoEntrega,valor},{autoCommit:false});
      }
      etapa='confirmacao_transacao';await conexao.commit();
      return await this.registrar(integracaoId,empresaId,numero,config.estab,idCarrinho,'integrado','Pedido integrado com sucesso.',pedido);
    }catch(error){if(conexao)await conexao.rollback().catch(()=>undefined);const mensagem=error instanceof Error?error.message:'Falha inesperada na integração.';const campoOracleInvalido=this.campoInvalidoOracle(mensagem);const diagnosticoNumerico=error instanceof CampoNumericoOracleInvalido?{campoOracle:error.campoOracle,campoOrigem:error.campoOrigem,valorRecebido:error.valorRecebido,codigoCopiar:`CAMPO ORACLE: ${error.campoOracle}\nORIGEM: ${error.campoOrigem}\nVALOR RECEBIDO: ${String(error.valorRecebido)}\nPEDIDO GMOBII: ${numero}`}:{...(campoOracleInvalido?{campoOracle:`CARRINHO.${campoOracleInvalido}`}:{ }),codigoCopiar:`CÓDIGO: ${this.codigoOracle(mensagem)??'SEM_CODIGO'}\n${campoOracleInvalido?`CAMPO: CARRINHO.${campoOracleInvalido}\n`:''}ETAPA: ${etapa}\nPEDIDO GMOBII: ${numero}\nERRO: ${mensagem}`};const detalhesErro={etapa,codigoOracle:this.codigoOracle(mensagem),orientacao:error instanceof CampoNumericoOracleInvalido?'Corrija o campo/origem indicado. Depois use “Tentar novamente”; nenhuma gravação parcial foi mantida.':this.orientacaoErroOracle(mensagem),...diagnosticoNumerico,...(error instanceof CadastroErpNaoLocalizado?{tipoProblema:'nao_localizado_erp',divergenciasErp:[{entidade:error.entidade,campo:error.campo,valor:error.valor,mensagem:error.message}]}:{})};return await this.registrar(integracaoId,empresaId,numero,config.estab,undefined,'erro',mensagem,pedido,detalhesErro)}finally{if(conexao)await conexao.close().catch(()=>undefined)}
  }

  /**
   * Garante o campo técnico exclusivo da integração GMOBii.
   *
   * Em uma base nova, todos os campos exclusivos GMOBii são criados antes de
   * qualquer consulta ou gravação do carrinho. Nenhuma coluna legada com
   * sufixo _MP é reutilizada. A criação é idempotente e tolera concorrência.
   */
  private async colunaPedidoCarrinho(
    conexao:any,
    driver:any,
    integracaoId:string,
    empresaId:string,
  ):Promise<'IDPEDIDO_GM'> {
    const colunas=[
      {nome:'IDPEDIDO_GM',tipo:'VARCHAR2(50)'},
      {nome:'TOTDESCONTO_GM',tipo:'NUMBER'},
      {nome:'TOTTAXAFRETE_GM',tipo:'NUMBER'},
      {nome:'TOTAL_GM',tipo:'NUMBER'},
    ] as const;
    const consultar=()=>conexao.execute(
      `SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME='CARRINHO' AND COLUMN_NAME IN ('IDPEDIDO_GM','TOTDESCONTO_GM','TOTTAXAFRETE_GM','TOTAL_GM')`,
      {},
      {outFormat:driver.OUT_FORMAT_OBJECT},
    );
    let resultado=await consultar();
    const existentes=new Set((resultado.rows??[]).map((linha:any)=>String(campo(linha,'COLUMN_NAME')).toUpperCase()));
    for(const coluna of colunas){
      if(existentes.has(coluna.nome))continue;
      try{
        await conexao.execute(`ALTER TABLE CARRINHO ADD ${coluna.nome} ${coluna.tipo}`);
        await this.salvarLogCancelamento(
          integracaoId,
          empresaId,
          'info',
          'estrutura_oracle_adequada',
          `Campo CARRINHO.${coluna.nome} criado automaticamente para a integração GMOBii.`,
          undefined,
          {tabela:'CARRINHO',campo:coluna.nome,tipo:coluna.tipo},
        );
      }catch(error){
        // ORA-01430 indica que outro processo criou a coluna entre a consulta e o ALTER.
        if(!/ORA-01430/i.test(error instanceof Error?error.message:String(error)))throw error;
      }
    }

    resultado=await consultar();
    const confirmadas=new Set((resultado.rows??[]).map((linha:any)=>String(campo(linha,'COLUMN_NAME')).toUpperCase()));
    const faltantes=colunas.filter((coluna)=>!confirmadas.has(coluna.nome)).map((coluna)=>`CARRINHO.${coluna.nome}`);
    if(faltantes.length)throw new Error(`Não foi possível criar os campos GMOBii: ${faltantes.join(', ')}. Verifique a permissão ALTER TABLE do usuário Oracle.`);
    return 'IDPEDIDO_GM';
  }

  /**
   * Remove apenas a tentativa técnica sem carrinho que ficou registrada antes
   * da adequação automática. O histórico é preservado com uma mensagem limpa e
   * o pedido volta a aparecer somente em Dados coletados para nova conferência.
   */
  private async resolverFalhasEstruturaCorrigida(integracaoId:string,empresaId:string){
    const mensagem='A estrutura CARRINHO.IDPEDIDO_GM estava ausente e foi corrigida automaticamente. O pedido permaneceu nos dados coletados para nova validação.';
    await this.postgres.query(`UPDATE logs_integracao SET mensagem=$3,detalhes=COALESCE(detalhes,'{}'::jsonb)||jsonb_build_object('estruturaCorrigida',TRUE,'campo','CARRINHO.IDPEDIDO_GM') WHERE integracao_id=$1 AND empresa_id=$2 AND mensagem ILIKE '%IDPEDIDO_%'`,[integracaoId,empresaId,mensagem]);
    await this.postgres.query(`UPDATE alertas_integracao SET lido=TRUE,resolvido_em=NOW(),mensagem=$3 WHERE integracao_id=$1 AND empresa_id=$2 AND lido=FALSE AND detalhes->>'origem'='integracao_construshow' AND mensagem ILIKE '%IDPEDIDO_%'`,[integracaoId,empresaId,mensagem]);
    await this.postgres.query(`DELETE FROM integracoes_construshow WHERE integracao_id=$1 AND empresa_id=$2 AND status='erro' AND id_carrinho IS NULL AND mensagem ILIKE '%IDPEDIDO_%'`,[integracaoId,empresaId]);
  }

  private async validarEmpresa(conexao:any,doc:string,estab:number){if(!doc)throw new CadastroErpNaoLocalizado('Empresa não localizada: documento não informado pela GMOBii.','empresa','empresa_documento',doc);const r=await conexao.execute(`SELECT ESTAB,REDUZIDO FROM FILIAL WHERE ESTAB=:estab AND REGEXP_REPLACE(CNPJ,'[^0-9]','')=:doc FETCH FIRST 1 ROWS ONLY`,{estab,doc});if(!r.rows?.length)throw new CadastroErpNaoLocalizado(`Empresa do documento ${doc} não localizada na filial ${estab} configurada no Construshow.`,'empresa','empresa_documento',doc)}
  private async localizarPessoa(conexao:any,driver:any,doc:string,padrao:number|undefined,tipo:'cliente'|'vendedor'){
    const colunaMarcacao=tipo==='cliente'?'EHCLIENTE':'EHREPRESENTANTE';
    const regraMarcacao=tipo==='cliente'
      ? "EXISTS(SELECT 1 FROM PESSOADOCMCP M WHERE M.IDPESS=P.IDPESS AND NVL(M.EHCLIENTE,'N')='S')"
      : "NVL(P.EHREPRESENTANTE,'N')='S'";
    const consultar=async(filtro:'documento'|'codigo',valor:string|number)=>conexao.execute(
      `SELECT P.IDPESS,CASE WHEN ${regraMarcacao} THEN 'S' ELSE 'N' END CADASTRO_VALIDO FROM PESSOADOC P WHERE ${filtro==='documento'?"REGEXP_REPLACE(P.CNPJF,'[^0-9]','')=:valor":"P.IDPESS=:valor"} FETCH FIRST 1 ROWS ONLY`,
      {valor},
      {outFormat:driver.OUT_FORMAT_OBJECT},
    );
    let resultado=doc?await consultar('documento',doc):{rows:[]};
    if(!resultado.rows?.length&&padrao)resultado=await consultar('codigo',padrao);
    if(!resultado.rows?.length)throw new CadastroErpNaoLocalizado(`${tipo} não localizado pelo documento e sem cadastro padrão válido configurado.`,tipo,`${tipo}_documento`,doc||padrao);
    const idPessoa=this.numeroOracle(`CARRINHO.${tipo==='cliente'?'IDPESS':'IDVENDINDICADO'}`,`PESSOADOC.IDPESS (${tipo})`,campo(resultado.rows[0],'IDPESS'));
    if(String(campo(resultado.rows[0],'CADASTRO_VALIDO')??'N').toUpperCase()!=='S'){
      const descricao=tipo==='cliente'?"PESSOADOCMCP.EHCLIENTE='S'":"PESSOADOC.EHREPRESENTANTE='S'";
      throw new CadastroErpNaoLocalizado(`Cadastro Não é ${tipo==='cliente'?'Cliente':'Vendedor'}: o IDPESS ${idPessoa} foi localizado, mas está sem a classificação obrigatória ${descricao}.`,tipo,`${tipo}_${colunaMarcacao.toLowerCase()}`,idPessoa);
    }
    return idPessoa;
  }
  private async registrar(integracaoId:string,empresaId:string,pedido:string,estab:number,idCarrinho:number|undefined,status:string,mensagem:string,dados:Pedido,detalhesErro?:Record<string,unknown>){
    const id=randomUUID();
    const diagnostico=status==='erro'?{mensagem,numeroPedido:pedido,estab,idCarrinho:idCarrinho??null,...detalhesErro}:null;
    const cliente=await this.postgres.connect();
    let registro:any;
    try{
      await cliente.query('BEGIN');
      const atual=(await cliente.query(`SELECT c.*,x.acao cancelamento_acao,x.status cancelamento_status,x.status_http cancelamento_status_http,x.resposta cancelamento_resposta,x.mensagem cancelamento_mensagem,x.concluido_em cancelamento_concluido_em FROM integracoes_construshow c LEFT JOIN LATERAL(SELECT acao,status,status_http,resposta,mensagem,concluido_em FROM cancelamentos_gmobii WHERE integracao_id=c.integracao_id AND empresa_id=c.empresa_id AND estab=c.estab AND id_carrinho=c.id_carrinho ORDER BY primeira_deteccao DESC LIMIT 1)x ON TRUE WHERE c.integracao_id=$1 AND c.empresa_id=$2 AND c.pedido_gmobii=$3 AND c.historico=FALSE FOR UPDATE OF c`,[integracaoId,empresaId,pedido])).rows[0];
      if(atual?.cancelamento_status==='concluido'){
        await cliente.query(`UPDATE integracoes_construshow SET historico=TRUE,substituido_em=NOW() WHERE id=$1`,[atual.id]);
        const acao=atual.cancelamento_acao==='devolver'?'Retornado no GMOBii':'Excluído no GMOBii';
        await cliente.query(`INSERT INTO logs_integracao(id,integracao_id,empresa_id,nivel,evento,mensagem,status_http,detalhes,criado_em) VALUES($1,$2,$3,'info','carrinho_cancelado_movido_historico',$4,$5,$6,NOW())`,[randomUUID(),integracaoId,empresaId,`Carrinho ${atual.id_carrinho} mantido no histórico (${acao}). Uma nova tentativa do pedido ${pedido} foi iniciada.`,atual.cancelamento_status_http??null,{numeroPedido:pedido,estab:atual.estab,idCarrinhoCancelado:atual.id_carrinho,acao:atual.cancelamento_acao,situacao:acao,resposta:atual.cancelamento_resposta,mensagemCancelamento:atual.cancelamento_mensagem,canceladoEm:atual.cancelamento_concluido_em,novoIdCarrinho:idCarrinho??null}]);
      }
      const {rows}=await cliente.query(`INSERT INTO integracoes_construshow(id,integracao_id,empresa_id,pedido_gmobii,estab,id_carrinho,status,mensagem,dados_coletados,dados_construshow,historico,criado_em,atualizado_em) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,FALSE,NOW(),NOW()) ON CONFLICT(integracao_id,pedido_gmobii) WHERE historico=FALSE DO UPDATE SET estab=EXCLUDED.estab,id_carrinho=EXCLUDED.id_carrinho,status=EXCLUDED.status,mensagem=EXCLUDED.mensagem,dados_coletados=EXCLUDED.dados_coletados,dados_construshow=EXCLUDED.dados_construshow,atualizado_em=NOW() RETURNING *`,[id,integracaoId,empresaId,pedido,estab,idCarrinho??null,status,mensagem,dados,diagnostico]);
      registro=rows[0];
      await cliente.query('COMMIT');
    }catch(error){await cliente.query('ROLLBACK');throw error}finally{cliente.release()}
    if(status==='erro'){
      const detalhes={origem:'integracao_construshow',numeroPedido:pedido,estab,idCarrinho:idCarrinho??null,...detalhesErro};
      await this.salvarLogCancelamento(integracaoId,empresaId,'erro','integracao_construshow_falhou',mensagem,undefined,detalhes);
      await this.postgres.query(`DELETE FROM alertas_integracao WHERE integracao_id=$1 AND lido=FALSE AND detalhes->>'origem'='integracao_construshow' AND detalhes->>'numeroPedido'=$2`,[integracaoId,pedido]);
      await this.postgres.query(`INSERT INTO alertas_integracao(id,integracao_id,empresa_id,severidade,titulo,mensagem,detalhes,lido,criado_em) VALUES($1,$2,$3,'critico',$4,$5,$6,FALSE,NOW())`,[randomUUID(),integracaoId,empresaId,`Falha ao integrar pedido ${pedido}`,mensagem,detalhes]);
    }else if(status==='integrado'||status==='existente'){
      await this.postgres.query(`UPDATE alertas_integracao SET lido=TRUE,resolvido_em=NOW() WHERE integracao_id=$1 AND empresa_id=$2 AND lido=FALSE AND detalhes->>'origem'='integracao_construshow' AND detalhes->>'numeroPedido'=$3`,[integracaoId,empresaId,pedido]);
      await this.salvarLogCancelamento(integracaoId,empresaId,'info','integracao_construshow_concluida',mensagem,undefined,{numeroPedido:pedido,estab,idCarrinho:idCarrinho??null,status});
    }
    return registro;
  }
  async listar(integracaoId:string,empresaId:string,conexaoBanco?:ConexaoBanco){const {rows}=await this.postgres.query(`SELECT c.*,a.id_nota aprovacao_id_nota,a.passou_caixa aprovacao_passou_caixa,a.status aprovacao_status,a.resposta aprovacao_resposta,x.acao cancelamento_acao,x.status cancelamento_status,x.status_http cancelamento_status_http,x.mensagem cancelamento_mensagem,x.concluido_em cancelamento_concluido_em FROM integracoes_construshow c LEFT JOIN LATERAL(SELECT id_nota,passou_caixa,status,resposta FROM aprovacoes_gmobii WHERE integracao_id=c.integracao_id AND empresa_id=c.empresa_id AND estab=c.estab AND id_carrinho=c.id_carrinho ORDER BY primeira_deteccao DESC LIMIT 1)a ON TRUE LEFT JOIN LATERAL(SELECT acao,status,status_http,mensagem,concluido_em FROM cancelamentos_gmobii WHERE integracao_id=c.integracao_id AND empresa_id=c.empresa_id AND estab=c.estab AND id_carrinho=c.id_carrinho ORDER BY primeira_deteccao DESC LIMIT 1)x ON TRUE WHERE c.integracao_id=$1 AND c.empresa_id=$2 AND c.historico=FALSE ORDER BY c.atualizado_em DESC`,[integracaoId,empresaId]);const eventos=(await this.postgres.query(`SELECT evento,nivel,mensagem,status_http,duracao_ms,detalhes,criado_em,COALESCE(detalhes->>'numeroPedido',detalhes->>'numero',detalhes->>'pedido') numero_pedido FROM logs_integracao WHERE integracao_id=$1 AND empresa_id=$2 ORDER BY criado_em DESC`,[integracaoId,empresaId])).rows;const historicos=(await this.postgres.query(`SELECT c.pedido_gmobii,c.estab,c.id_carrinho,c.substituido_em,x.acao,x.status_http,x.resposta,x.mensagem,x.concluido_em FROM integracoes_construshow c LEFT JOIN LATERAL(SELECT acao,status_http,resposta,mensagem,concluido_em FROM cancelamentos_gmobii WHERE integracao_id=c.integracao_id AND empresa_id=c.empresa_id AND estab=c.estab AND id_carrinho=c.id_carrinho ORDER BY primeira_deteccao DESC LIMIT 1)x ON TRUE WHERE c.integracao_id=$1 AND c.empresa_id=$2 AND c.historico=TRUE ORDER BY c.substituido_em DESC NULLS LAST`,[integracaoId,empresaId])).rows;for(const item of rows){const eventosPedido=eventos.filter(evento=>String(evento.numero_pedido??'')===String(item.pedido_gmobii)).map(({numero_pedido,...evento})=>evento);const carrinhosAnteriores=historicos.filter(anterior=>String(anterior.pedido_gmobii)===String(item.pedido_gmobii)).map(anterior=>({evento:'carrinho_cancelado_historico',nivel:'info',mensagem:`Carrinho ${anterior.id_carrinho} mantido no histórico — ${anterior.acao==='devolver'?'Retornado no GMOBii':'Excluído no GMOBii'}.`,status_http:anterior.status_http,duracao_ms:null,criado_em:anterior.substituido_em??anterior.concluido_em,detalhes:{numeroPedido:item.pedido_gmobii,estab:anterior.estab,idCarrinhoCancelado:anterior.id_carrinho,acao:anterior.acao,resposta:anterior.resposta,mensagemCancelamento:anterior.mensagem,canceladoEm:anterior.concluido_em}}));item.eventos_pedido=[...eventosPedido,...carrinhosAnteriores].sort((a,b)=>new Date(b.criado_em??0).getTime()-new Date(a.criado_em??0).getTime())}if(!conexaoBanco||!rows.some(item=>item.id_carrinho))return rows;let conexao:any;try{const oracle=await import('oracledb');const driver=oracle.default??oracle;conexao=await driver.getConnection({user:conexaoBanco.usuario,password:senha(conexaoBanco),connectionString:`${conexaoBanco.host}:${conexaoBanco.porta}/${conexaoBanco.bancoOuServico}`});for(const item of rows){if(!item.id_carrinho)continue;try{const resultado=await conexao.execute(`SELECT C.SITUACAO,NC.IDNOTA,CASE WHEN N.MOSTRACAIXA <> 1 THEN 'S' ELSE 'N' END PASSOUCAIXA FROM CARRINHO C LEFT JOIN NOTACARRINHO NC ON NC.ESTAB=C.ESTAB AND NC.IDCARRINHO=C.IDCARRINHO LEFT JOIN NOTA N ON N.ESTAB=NC.ESTAB AND N.IDNOTA=NC.IDNOTA WHERE C.ESTAB=:estab AND C.IDCARRINHO=:id ORDER BY NC.IDNOTA DESC`,{estab:Number(item.estab),id:Number(item.id_carrinho)},{outFormat:driver.OUT_FORMAT_OBJECT});const atual=resultado.rows?.[0];item.situacao_carrinho=campo(atual,'SITUACAO')??null;item.id_nota=campo(atual,'IDNOTA')??item.aprovacao_id_nota??null;item.passou_caixa=campo(atual,'PASSOUCAIXA')??item.aprovacao_passou_caixa??'N';item.dados_construshow={...(item.dados_construshow??{}),estab:item.estab,idCarrinho:item.id_carrinho,numeroNota:item.id_nota,situacaoCarrinho:item.situacao_carrinho,passouCaixa:item.passou_caixa,statusAprovacao:item.aprovacao_status??'aguardando_caixa',respostaAprovacao:item.aprovacao_resposta??null}}catch(error){item.dados_construshow={...(item.dados_construshow??{}),consultaOracleErro:error instanceof Error?error.message:'Não foi possível consultar o carrinho no Oracle.'}}}return rows}catch(error){return rows.map(item=>({...item,dados_construshow:{...(item.dados_construshow??{}),consultaOracleErro:error instanceof Error?error.message:'Não foi possível conectar ao Oracle.'}}))}finally{if(conexao)await conexao.close().catch(()=>undefined)}}
  async detalharCarrinho(integracaoId:string,empresaId:string,registroId:string,conexaoBanco:ConexaoBanco){
    const {rows}=await this.postgres.query(`SELECT pedido_gmobii,estab,id_carrinho FROM integracoes_construshow WHERE id=$1 AND integracao_id=$2 AND empresa_id=$3`,[registroId,integracaoId,empresaId]);
    const registro=rows[0];
    if(!registro)throw new Error('Registro integrado não encontrado.');
    if(!registro.id_carrinho)throw new Error('Este pedido ainda não possui carrinho no Construshow.');
    let conexao:any;
    try{
      const oracle=await import('oracledb');const driver=oracle.default??oracle;
      conexao=await driver.getConnection({user:conexaoBanco.usuario,password:senha(conexaoBanco),connectionString:`${conexaoBanco.host}:${conexaoBanco.porta}/${conexaoBanco.bancoOuServico}`});
      const binds={estab:Number(registro.estab),id:Number(registro.id_carrinho)};
      const cabecalhoResultado=await conexao.execute(`SELECT C.ESTAB,C.IDCARRINHO,C.NROCARTAO,C.DTABERT,C.SITUACAO,C.IDPESS,C.NOME,C.CPFCNPJ,C.IDVENDINDICADO,(SELECT MAX(P.NOME) FROM PESSOADOC P WHERE P.IDPESS=C.IDVENDINDICADO) NOMEVENDEDOR,C.OBS,C.DTVALIDADE,C.FORMACOMPRA,C.PRAZOMED,C.TAXAPRAZO,C.TAXAFRETE,C.DESPESAS,C.JUROS,C.TOTAL_GM,C.TOTDESCONTO_GM,C.TOTTAXAFRETE_GM,(SELECT MAX(NC.IDNOTA) FROM NOTACARRINHO NC WHERE NC.ESTAB=C.ESTAB AND NC.IDCARRINHO=C.IDCARRINHO) IDNOTA FROM CARRINHO C WHERE C.ESTAB=:estab AND C.IDCARRINHO=:id FETCH FIRST 1 ROWS ONLY`,binds,{outFormat:driver.OUT_FORMAT_OBJECT});
      const cabecalho=cabecalhoResultado.rows?.[0];
      if(!cabecalho)throw new Error(`Carrinho ${registro.id_carrinho} não localizado no Construshow.`);
      const itensResultado=await conexao.execute(`SELECT CI.SEQITEM,CI.IDITEM,I.DESCRICAO,I.UNIDADE,CI.QUANTIDADE,CI.VALORUNIT,CI.VALORC,CI.DESCONTO,CI.ENTREGAR,CI.QTDEENTREGA,CI.DTPREVISAOENT,CI.CFOP,CI.IDVENDEDOR,CI.IDLOCALRETIRADA FROM CARRINHOITEM CI LEFT JOIN ITEM I ON I.ESTAB=CI.ESTAB AND I.IDITEM=CI.IDITEM WHERE CI.ESTAB=:estab AND CI.IDCARRINHO=:id ORDER BY CI.SEQITEM`,binds,{outFormat:driver.OUT_FORMAT_OBJECT});
      return {pedidoGmobii:String(registro.pedido_gmobii),cabecalho:{estabelecimento:Number(campo(cabecalho,'ESTAB')),numeroCarrinho:Number(campo(cabecalho,'IDCARRINHO')),numeroCartao:campo(cabecalho,'NROCARTAO'),abertura:campo(cabecalho,'DTABERT'),situacao:campo(cabecalho,'SITUACAO'),codigoCliente:campo(cabecalho,'IDPESS'),cliente:campo(cabecalho,'NOME'),documento:campo(cabecalho,'CPFCNPJ'),codigoVendedor:campo(cabecalho,'IDVENDINDICADO'),vendedor:campo(cabecalho,'NOMEVENDEDOR'),observacao:campo(cabecalho,'OBS'),validade:campo(cabecalho,'DTVALIDADE'),formaCompra:campo(cabecalho,'FORMACOMPRA'),prazoMedio:campo(cabecalho,'PRAZOMED'),taxaPrazo:campo(cabecalho,'TAXAPRAZO'),taxaFrete:campo(cabecalho,'TAXAFRETE'),despesas:campo(cabecalho,'DESPESAS'),juros:campo(cabecalho,'JUROS'),total:Number(campo(cabecalho,'TOTAL_GM')??0),totalDesconto:Number(campo(cabecalho,'TOTDESCONTO_GM')??0),totalFrete:Number(campo(cabecalho,'TOTTAXAFRETE_GM')??0),numeroNota:campo(cabecalho,'IDNOTA')},itens:(itensResultado.rows??[]).map((item:any)=>({sequencia:Number(campo(item,'SEQITEM')),codigo:String(campo(item,'IDITEM')??''),descricao:String(campo(item,'DESCRICAO')??''),unidade:String(campo(item,'UNIDADE')??''),quantidade:Number(campo(item,'QUANTIDADE')??0),valorUnitario:Number(campo(item,'VALORUNIT')??0),valorTotal:Number(campo(item,'VALORC')??0),desconto:Number(campo(item,'DESCONTO')??0),entregar:String(campo(item,'ENTREGAR')??''),quantidadeEntrega:Number(campo(item,'QTDEENTREGA')??0),previsaoEntrega:campo(item,'DTPREVISAOENT'),cfop:campo(item,'CFOP'),codigoVendedor:campo(item,'IDVENDEDOR'),localRetirada:campo(item,'IDLOCALRETIRADA')}))};
    }finally{if(conexao)await conexao.close().catch(()=>undefined)}
  }
  async excluirTentativaComErro(id:string,integracaoId:string,empresaId:string){const cliente=await this.postgres.connect();try{await cliente.query('BEGIN');const {rows}=await cliente.query(`SELECT * FROM integracoes_construshow WHERE id=$1 AND integracao_id=$2 AND empresa_id=$3 FOR UPDATE`,[id,integracaoId,empresaId]);const registro=rows[0];if(!registro){await cliente.query('ROLLBACK');return {situacao:'nao_encontrado' as const}}if(registro.status!=='erro'){await cliente.query('ROLLBACK');return {situacao:'nao_permitido' as const,registro}}await cliente.query(`DELETE FROM integracoes_construshow WHERE id=$1`,[id]);await cliente.query(`UPDATE alertas_integracao SET lido=TRUE,resolvido_em=NOW() WHERE integracao_id=$1 AND empresa_id=$2 AND lido=FALSE AND detalhes->>'origem'='integracao_construshow' AND detalhes->>'numeroPedido'=$3`,[integracaoId,empresaId,String(registro.pedido_gmobii)]);await cliente.query('COMMIT');return {situacao:'excluido' as const,registro}}catch(error){await cliente.query('ROLLBACK');throw error}finally{cliente.release()}}
}

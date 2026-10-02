# Integração GMOBii e Construshow

## Objetivo

Este documento consolida os contratos recebidos da GMOBii e a implementação do Control S API Hub para coleta de pedidos, criação de carrinhos no Construshow, cancelamento/devolução e aprovação para produção após o caixa.

## Contratos recebidos

| Processo | Versão | Método | Endpoint |
|---|---:|---|---|
| Coleta de pedidos | 1.2 | GET | `https://api.gmobii.com.br/functions/v1/production-orders` |
| Devolver ou excluir | 1.4 | POST | Mesmo endpoint |
| Aprovar para produção | 1.6 | POST | Mesmo endpoint |

A autenticação aceita `x-api-key: <chave>` ou `Authorization: Bearer <chave>`. O Control S guarda o token criptografado e usa `x-api-key` nas chamadas de servidor.

## Fluxo completo

1. O Control S coleta os pedidos autorizados na GMOBii e preserva o JSON original no PostgreSQL.
2. Os campos obrigatórios são conferidos e os códigos de cliente, vendedor, filial e produtos são pré-validados no Oracle.
3. Pedidos aptos podem criar `CARRINHO`, `CARRINHOHIST` e `CARRINHOITEM` em uma única transação Oracle.
4. O vínculo entre `numero_pedido`, `ESTAB` e `IDCARRINHO` é armazenado em `integracoes_construshow`.
5. Se o carrinho chegar à situação `E`, o monitor envia `excluir` ou `devolver`, conforme a configuração.
6. Quando a nota vinculada ao carrinho passar pelo caixa, o monitor envia `produzir` com os números do carrinho e da nota.

Na tela **Dados coletados**, o período inicial corresponde ao dia atual. O botão **Limpar** remove também as datas, e o filtro de situação diferencia **Não integrados**, **Integrados** e **Excluídos**.

O painel de indicadores abre com o período do mês atual, do primeiro dia até hoje, e permite alterar livremente as datas. Os totais, execuções, alertas e agrupamentos são recalculados para o período selecionado. **Registros locais** abre exatamente os mesmos pedidos considerados na contagem. O resumo **Pedidos integrados por situação** agrupa os pedidos conforme a situação atual; ao clicar em uma situação, são exibidos os pedidos correspondentes com estabelecimento, número do carrinho e nota do Construshow. O número do carrinho abre sua consulta completa no Oracle.

Na tela **Dados integrados**, há filtros por busca, situação, caixa e período. A grade permite ordenar, redimensionar, mover e ocultar colunas. O número do carrinho é um atalho para consultar os dados atuais diretamente no Oracle. A visualização apresenta cabeçalho, cliente, vendedor, situação, observações, itens, quantidades, valores unitários, totais e previsão de entrega.

A coluna **Situação do carrinho** apresenta o código com sua descrição em português — **A - Aberto**, **E - Cancelado** e **F - Finalizado** — ou o resultado operacional na GMOBii, incluindo **Excluído no GMOBii** e **Retornado no GMOBii**. Essas situações estão disponíveis no filtro. Ao clicar no **Status**, a aplicação abre o histórico completo dos eventos vinculados ao pedido, com data, mensagem, HTTP, dados enviados e resposta recebida.

Se um pedido já excluído ou retornado for recebido novamente pela GMOBii depois do cancelamento, ele cria um novo carrinho. A comparação das datas impede que o pedido antigo seja recriado sem um novo recebimento. O carrinho cancelado permanece somente no histórico, com número, ação, resposta da API e data do cancelamento; o registro mais recente passa a ser o vigente nas grades, filtros e processos automáticos.

### Campos e validações obrigatórias

- Pedido: `numero_pedido`, `cliente_documento`, `vendedor_documento`, `empresa_documento`, `data_criacao` e `itens`.
- Item: `codigo` e `quantidade`. O `valor` pode ser omitido ou enviado como zero; nesses casos, a integração consulta o preço vigente no Construshow.
- Cliente: localizado pelo documento em `PESSOADOC` e classificado com `PESSOADOCMCP.EHCLIENTE = 'S'`.
- Vendedor: localizado pelo documento em `PESSOADOC` e classificado com `PESSOADOC.EHREPRESENTANTE = 'S'`.
- Empresa: documento compatível com a filial configurada.
- Produto: o código recebido precisa existir em `ITEM` no estabelecimento de produtos configurado.

Nome do cliente, vendedor e empresa, `tipo_servico`, `data_envio_producao` e `observacoes` não bloqueiam a integração. Quando uma validação obrigatória falha, o pedido inteiro é bloqueado antes de qualquer gravação no Oracle.

### Valor dos produtos

Quando `itens[].valor` vier preenchido com valor maior que zero, a regra já existente para o valor recebido da GMOBii permanece inalterada: ele é utilizado como total do item e o valor unitário é calculado pela quantidade. Quando estiver ausente, nulo ou igual a zero, a integração consulta o preço unitário no Construshow para a filial de integração:

```sql
SELECT COALESCE(TRUARR(
  CASE
    WHEN COALESCE(P.PRECO2, 0) = 0 THEN P.PRECO
    ELSE P.PRECO2
  END,
  FCV.DECVALOR,
  FCP.IAT
), 0) AS PRECO
FROM (SELECT :estab AS ESTAB, :iditem AS IDITEM FROM DUAL) X
INNER JOIN TABLE(RETORNAITEMPRECO(X.ESTAB, X.IDITEM, 0, 'S', 0)) P ON (0 = 0)
LEFT JOIN FILIALCONFPROC FCP ON FCP.ESTAB = X.ESTAB
LEFT JOIN FILIALCONFVDA FCV ON FCV.ESTAB = X.ESTAB;
```

Os valores gravados seguem estas fórmulas:

```text
CARRINHOITEM.VALORUNIT = valor GMOBii ÷ quantidade, quando o valor foi recebido
CARRINHOITEM.VALORC    = valor recebido da GMOBii, sem alteração

No fallback do Construshow:
CARRINHOITEM.VALORUNIT = preço unitário consultado
CARRINHOITEM.VALORC    = preço unitário consultado × quantidade
CARRINHO.TOTAL_GM      = soma de todos os valores totais dos itens
```

A falta de valor no pedido GMOBii não gera alerta e não bloqueia a integração. Um alerta só é criado se o valor também não puder ser obtido no Construshow.

### Estrutura própria da GMOBii no Oracle

A integração não utiliza colunas legadas com sufixo `_MP`. Antes de consultar ou gravar um carrinho, a aplicação verifica e cria automaticamente, quando ausentes:

| Campo | Tipo | Finalidade |
|---|---|---|
| `CARRINHO.IDPEDIDO_GM` | `VARCHAR2(50)` | Número do pedido GMOBii e idempotência |
| `CARRINHO.TOTDESCONTO_GM` | `NUMBER` | Total de desconto do fluxo GMOBii |
| `CARRINHO.TOTTAXAFRETE_GM` | `NUMBER` | Total de frete do fluxo GMOBii |
| `CARRINHO.TOTAL_GM` | `NUMBER` | Total recebido nos itens GMOBii |

O usuário Oracle precisa possuir permissão para `ALTER TABLE CARRINHO`. A criação é idempotente e registrada nos logs.

### Previsão de entrega dos itens

Embora `CARRINHOITEM.DTPREVISAOENT` aceite `NULL` no Oracle, a tela do carrinho no ViaSoft exige um valor válido. A integração nunca grava esse campo vazio. A regra é:

```text
DTPREVISAOENT = data_criacao do pedido + Dias para previsão de entrega
```

O parâmetro **Dias para previsão de entrega** fica em **Integrações > GMOBii > Conf. Construshow**, aceita valores de 0 a 999 e possui padrão de **4 dias**, inclusive para configurações antigas que ainda não tenham o campo salvo. O horário da criação é preservado. Se a data de criação recebida for tecnicamente inválida, a aplicação usa o momento da integração como proteção final.

## Cancelamento ou devolução

Corpo enviado:

```json
{
  "acao": "excluir",
  "numero": "10000001",
  "motivo": "CANC"
}
```

`excluir` é o padrão e remove definitivamente o pedido da GMOBii quando a situação permitir. `devolver` libera o pedido ao vendedor para edição; após o reenvio, o pedido reaparece com o mesmo número e dados atualizados.

A resposta HTTP 200 conclui a ação. Para exclusão repetida após timeout, HTTP 404 é aceito como já concluído. HTTP 400, 401, 405 e 409 bloqueiam novas tentativas e geram alerta crítico. Erros temporários e HTTP 500 permanecem disponíveis para nova tentativa.

## Aprovação após o caixa

Consulta Oracle implementada:

```sql
SELECT
  NC.ESTAB,
  NC.IDNOTA,
  NC.IDCARRINHO,
  CASE WHEN N.MOSTRACAIXA <> 1 THEN 'S' ELSE 'N' END PASSOUCAIXA
FROM NOTA N
INNER JOIN NOTACARRINHO NC
  ON NC.ESTAB = N.ESTAB
 AND NC.IDNOTA = N.IDNOTA
WHERE NC.ESTAB = :estab
  AND NC.IDCARRINHO = :idCarrinho
ORDER BY NC.IDNOTA DESC;
```

Ao localizar `PASSOUCAIXA = S`, o Control S envia:

```json
{
  "acao": "produzir",
  "numero": "10000001",
  "numero_carrinho": "458213",
  "numero_nota": "000123456"
}
```

Os números de carrinho e nota são convertidos em texto porque a GMOBii os grava exatamente como enviados. A aprovação só é concluída após HTTP 200 com `pedido.situacao = "em_producao"`.

A ação `produzir` é idempotente. Se o pedido já estiver em produção, uma repetição responde 200 com a data original e pode atualizar apenas carrinho e nota. Timeout, falha de rede e HTTP 500 podem ser tentados novamente. HTTP 400, 401, 404 e 409 exigem análise e ficam bloqueados com alerta crítico.

## Auditoria e idempotência

| Tabela | Finalidade |
|---|---|
| `dados_integracao` | JSON original coletado da GMOBii |
| `validacoes_erp_gmobii` | Resultado do De → Para antes da integração |
| `integracoes_construshow` | Vínculo pedido/carrinho e resultado da criação |
| `cancelamentos_gmobii` | Ação, motivo, tentativas e resposta do cancelamento |
| `aprovacoes_gmobii` | Nota, carrinho, tentativas e resposta da aprovação |
| `logs_integracao` | Eventos técnicos e operacionais |
| `alertas_integracao` | Pendências críticas visíveis na plataforma |

Uma operação concluída não é reenviada pelo Control S. Operações temporariamente falhas são reavaliadas no intervalo configurado. Os registros sobrevivem a reinícios do serviço.

## Configuração na plataforma

Em **Integrações > GMOBii > Conf. Construshow**:

- selecione a conexão Oracle e os cadastros necessários ao carrinho;
- defina os dias para previsão de entrega, com padrão de 4 dias;
- ative ou desative a integração automática e defina seu intervalo em minutos;
- ative ou desative o monitoramento de cancelamento;
- escolha `Excluir pedido na GMOBii` ou `Retornar pedido para a GMOBii`;
- defina o intervalo do cancelamento;
- ative ou desative a aprovação após o caixa;
- defina o intervalo de aprovação.
- escolha se a exclusão de dados coletados será lógica ou definitiva;
- configure destinatários, envio imediato e repetição dos alertas da integração.

Os valores são armazenados por empresa. A integração automática fica desativada até ser habilitada e salva. Quando ativa, cada ciclo repete a conferência dos campos obrigatórios, o De → Para do ERP e a validação dos produtos antes de criar o carrinho. Pedidos com pendência permanecem bloqueados. `Excluir` e os monitores de cancelamento e aprovação ativos são os demais padrões para configurações novas.

O perfil de acesso define quem pode excluir. O modo da exclusão é uma configuração geral da integração. Na exclusão lógica, o pedido sai da fila, permanece auditável e pode ser consultado em **Dados coletados > Situação > Excluídos**, destacado em vermelho.

### Controle de acesso

- A permissão **Acessar configurações da integração** controla os menus **Conexão GMOBii** e **Conf. Construshow**.
- Sem acesso a **Indicadores APIs**, o menu **Logs** do grupo APIs não é mostrado.
- Um usuário não administrador com acesso ao cadastro de usuários pode manter contas comuns, mas não pode atribuir o perfil **Administrador**, selecionar o grupo **Admin** nem excluir contas; a ação disponível é inativar.

## Vídeos de treinamento

A documentação incorporada possui o botão **Vídeos**. A biblioteca pesquisa automaticamente:

```text
C:\Control S API Hub\videos\GMOBii
```

Para publicar um treinamento, basta copiar o arquivo para essa pasta. Não é necessário cadastrá-lo nem reiniciar o serviço. O nome do arquivo é usado como título e os arquivos são ordenados pelo nome.

Dentro da biblioteca, o botão **Copiar link** gera um endereço do próprio portal que abre diretamente a área de vídeos com o treinamento escolhido já selecionado. O acesso continua respeitando a autenticação do Control S API Hub.

Todos os arquivos colocados na pasta são listados, independentemente da extensão. MP4, M4V, WebM, OGV, OGG, MOV, AVI, MKV, WMV, FLV, MPEG, MPG, 3GP, TS, MTS e M2TS recebem o tipo de mídia correspondente. MP4 com vídeo H.264 e áudio AAC é o formato recomendado. Formatos sem reprodução nativa no navegador continuam disponíveis pelo botão **Abrir arquivo**.

Os vídeos são transmitidos pelo próprio servidor com suporte a requisições por intervalo de bytes, permitindo avançar e retroceder durante a reprodução sem carregar o arquivo completo.

## Arquivos para manutenção

- `apps/backend/src/modules/integracoes/construshow/ConstrushowIntegrationService.ts`: regras Oracle, transações e chamadas GMOBii.
- `apps/backend/src/app.ts`: configuração, endpoints administrativos e agendadores.
- `apps/frontend/src/App.tsx`: telas de configuração e documentação incorporada.
- `apps/backend/src/config/env.ts`: caminhos dos PDFs originais recebidos.
- `C:\Control S API Hub\videos\GMOBii`: arquivos de treinamento exibidos na documentação.

## Diagnóstico

Em falha, consulte primeiro o alerta do pedido e depois os logs. Para aprovação, confirme `ESTAB`, `IDCARRINHO`, `IDNOTA`, `MOSTRACAIXA`, status HTTP e resposta da GMOBii. Para cancelamento, confirme a situação `E`, a ação configurada e o motivo `CANC`.

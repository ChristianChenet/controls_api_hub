# Integração GMOBii → Construshow

Este diretório concentra exclusivamente a gravação e a consulta de carrinhos no Oracle do Construshow.

## Regras de segurança

- Cada pedido é processado em uma transação Oracle independente.
- Nenhum item é gravado antes da validação de cliente, vendedor, documento e todos os produtos.
- Se qualquer produto não existir, a transação é cancelada e o pedido recebe erro crítico.
- Os campos exclusivos da GMOBii são `CARRINHO.IDPEDIDO_GM`, `TOTDESCONTO_GM`, `TOTTAXAFRETE_GM` e `TOTAL_GM`. Antes de integrar, a aplicação verifica a estrutura e cria automaticamente qualquer um deles que estiver ausente.
- Colunas legadas com sufixo `_MP` não são utilizadas pelo fluxo GMOBii.
- Um carrinho já existente para `ESTAB + pedido GMOBii` nunca é alterado.
- Campos obrigatórios pendentes bloqueiam o pedido antes da abertura da transação Oracle.
- `CARRINHOITEM.DTPREVISAOENT` recebe a data de criação do pedido somada aos dias configurados; o padrão é 4 dias.
- Tentativas com erro podem ser reprocessadas após nova validação ou excluídas sem remover os dados coletados; ambas as ações permanecem auditadas.
- A integração automática é opcional e respeita o intervalo salvo por empresa; cada ciclo refaz as validações antes de gravar qualquer carrinho.
- Cliente e vendedor padrão são usados somente quando a busca pelo documento não encontra cadastro.
- Sem cadastro por documento e sem padrão configurado, o pedido não é importado.
- Todo resultado fica registrado na tabela local `integracoes_construshow`.

## Cancelamento ViaSoft -> GMOBii

- O monitor consulta os carrinhos integrados e identifica `CARRINHO.SITUACAO = 'E'`.
- Para cada cancelamento, envia `POST` ao endpoint da GMOBii com a ação configurada (`excluir` por padrão ou `devolver`), o número do pedido e `motivo = CANC`.
- A resposta HTTP 200 conclui o processo. HTTP 404 também conclui, pois pode representar repetição após timeout.
- HTTP 400, 401, 405 ou 409 bloqueia novas tentativas automáticas e gera alerta crítico.
- Falhas temporárias de comunicação ou HTTP 500 são tentadas novamente, com controle na tabela `cancelamentos_gmobii`.
- O histórico local nunca é apagado: carrinho, pedido, tentativas, resposta e datas permanecem disponíveis para auditoria.

## Aprovação após o caixa

- O monitor parte dos carrinhos integrados e relaciona `NOTA` com `NOTACARRINHO` por `ESTAB + IDNOTA`.
- A consulta é feita por `ESTAB + IDCARRINHO`; somente linhas com `MOSTRACAIXA <> 1` são consideradas como `PASSOUCAIXA = S`.
- O pedido é enviado por `POST` à GMOBii com `acao = produzir`, `numero`, `numero_carrinho` e `numero_nota`.
- A aprovação só é concluída com HTTP 200 e `pedido.situacao = em_producao`.
- Timeout, falha de rede e HTTP 500 permanecem com status de erro para nova tentativa automática.
- HTTP 400, 401, 404 e 409 bloqueiam a tentativa e geram alerta crítico para intervenção.
- A tabela `aprovacoes_gmobii` mantém idempotência e auditoria por integração, estabelecimento, carrinho e nota.
- A GMOBii também trata `produzir` de forma idempotente; uma repetição segura devolve a data original da aprovação.

## Arquivos e manutenção

- Regra Oracle, integração de carrinhos, cancelamento e aprovação: `ConstrushowIntegrationService.ts`.
- Agendamentos e configuração por empresa: `apps/backend/src/app.ts`.
- Tela administrativa: `apps/frontend/src/App.tsx`, seção `Configuração Construshow`.
- Documento consolidado: `docs/INTEGRACAO_GMOBII_CONSTRUSHOW.md`.

O arquivo principal para manutenção é `ConstrushowIntegrationService.ts`.

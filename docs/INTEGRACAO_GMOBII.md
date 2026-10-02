# Integracao GMobii - primeira versao

## Objetivo

O modulo consulta pedidos autorizados para producao na GMobii, guarda uma copia auditavel no PostgreSQL do Control S e apresenta configuracao, dados, execucoes, logs e alertas no portal.

## Compatibilidade

A entrega e aditiva. As tabelas, rotas e telas preexistentes nao foram removidas nem tiveram seus contratos alterados. O novo dominio usa tabelas proprias e rotas sob `/api/admin/integracoes`.

## Seguranca

- O token nunca retorna nas respostas da API nem aparece nos logs.
- A credencial e cifrada com AES-256-GCM antes de ser gravada.
- Em producao, `CREDENTIALS_MASTER_KEY` deve conter uma chave aleatoria de 32 bytes em Base64.
- Se o token for exposto, ele deve ser revogado e substituido junto a GMobii.
- A permissao **Acessar configuracoes da integracao** controla a exibicao dos menus **Conexao GMOBii** e **Conf. Construshow**.
- Sem acesso a **Indicadores APIs**, o menu **Logs** do grupo APIs nao e apresentado.
- Usuarios nao administradores que mantem cadastros de usuarios nao podem atribuir perfil **Administrador**, selecionar o grupo **Admin** ou excluir contas; podem apenas inativa-las.

## Sincronizacao

1. O conector chama exclusivamente o endereco HTTPS documentado pela GMobii.
2. O cursor usa `data_envio_producao` e aplica sobreposicao de um segundo entre consultas.
3. `numero_pedido` e a chave externa. Reprocessar um pedido atualiza o registro existente, sem duplicar.
4. Os lotes aceitam de 1 a 200 registros e sao percorridos do mais antigo para o mais novo.
5. O cursor so avanca depois que o lote e salvo com sucesso.
6. A consulta planejada ocorre a cada 2 minutos no ambiente instalado.
7. A integracao automatica respeita o intervalo configurado no Construshow e repete as validacoes antes de criar o carrinho.
8. Um pedido recebido novamente depois de ser excluido ou retornado cria um novo carrinho; o cancelado permanece somente no historico e o registro mais recente passa a valer.

## Auditoria e monitoramento

- `execucoes_integracao`: resumo de cada teste e sincronizacao.
- `logs_integracao`: eventos por lote, duracao, status HTTP e erro sem dados sensiveis.
- `alertas_integracao`: falhas visiveis no portal, com severidade e confirmacao de leitura.
- `dados_integracao`: espelho JSON do provedor, preservando campos novos que a GMobii venha a adicionar.
- O status do pedido exibe os eventos enviados para a API, a resposta HTTP, os carrinhos cancelados e a troca para o carrinho mais recente.
- Alertas iguais sao consolidados. Pendencias de item informam codigo e descricao do produto no pedido, na plataforma e no e-mail.

## Operacao local

No menu **Integracoes**, informe o token, salve, use **Testar conexao** e depois **Buscar dados agora**. Os pedidos, o historico e os logs aparecem na mesma tela.

**Dados coletados** abre com o periodo do dia; **Limpar** remove tambem as datas. O filtro de situacao diferencia pedidos nao integrados, integrados e excluidos. **Dados integrados** oferece filtros, configuracao da grade, acesso ao carrinho completo e situacoes em portugues, como **A - Aberto**, **E - Cancelado** e **F - Finalizado**, alem de **Excluido no GMOBii** e **Retornado no GMOBii**.

O painel de indicadores utiliza por padrao o periodo do mes atual, do primeiro dia ate hoje, e permite alterar as datas. Totais e detalhes respeitam o periodo selecionado. Os pedidos integrados sao agrupados por situacao; cada total pode ser aberto para consultar os pedidos correspondentes, o estabelecimento, o carrinho e a nota. O numero do carrinho abre os dados completos no Construshow.

Quando um produto chegar sem valor ou com valor zero, o preco unitario vigente do Construshow e utilizado, e o total e calculado pela quantidade. Valores validos recebidos da GMOBii conservam a regra original. Os campos `IDPEDIDO_GM`, `TOTAL_GM`, `TOTDESCONTO_GM` e `TOTTAXAFRETE_GM` sao verificados e criados automaticamente; campos com sufixo `_MP` nao sao utilizados.

Nas notificacoes, varios destinatarios sao separados por ponto e virgula (`;`). A identidade visual utiliza os arquivos instalados no servidor e nao impede o envio se a imagem estiver indisponivel.

O backend e o portal continuam sendo publicados pelo servico Windows ja existente do Control S API Hub; nao ha um segundo processo para administrar.

## Videos de treinamento

A documentacao GMOBii possui uma biblioteca que pesquisa automaticamente os videos em:

```text
C:\Control S API Hub\videos\GMOBii
```

Copie os arquivos para essa pasta e use o botao **Videos** na documentacao. Nao e necessario reiniciar o servico. MP4 com video H.264 e audio AAC e o formato recomendado para compatibilidade com navegadores.

O botao **Copiar link** gera um endereco do portal que abre diretamente a biblioteca e seleciona o treinamento escolhido. O usuario precisa estar autenticado no Control S API Hub.

## Variaveis de ambiente

```text
CREDENTIALS_MASTER_KEY=chave-base64-com-32-bytes
INTEGRATION_TIMEOUT_MS=30000
GMOBII_VIDEOS_PATH=C:\Control S API Hub\videos\GMOBii
```

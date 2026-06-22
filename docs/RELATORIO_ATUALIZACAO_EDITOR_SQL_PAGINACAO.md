# Relatorio de atualizacao - Editor SQL, persistencia, paginacao e acesso externo

## 1. Resumo executivo

Esta atualizacao corrige o comportamento do Editor SQL para manter a API selecionada apos salvar, persiste os campos de parametros de teste e regras de validacao, adiciona paginacao padronizada nas APIs publicadas e melhora a documentacao Swagger/OpenAPI para testes por integradores.

## 2. O que foi corrigido

- O Editor SQL nao volta mais para a primeira API apos salvar.
- Os campos `Parametros de teste` e `Regras de validacao` passam a ser enviados ao backend, salvos no PostgreSQL e recarregados ao selecionar a API.
- APIs publicadas aceitam `pagina`, `page`, `pageSize`, `limit` e `quantidadePorPagina`, retornando metadados em portugues.
- O Swagger publico mostra `pagina` e `pageSize` com exemplo e descricao.
- A URL publica aceita endereco completo com porta, como `http://api.monvizo.com.br:8080`.

## 3. Arquivos alterados

- `apps/backend/src/app.ts`: persistencia de parametros de teste, regras padrao, paginacao publica e preservacao da URL publica completa.
- `apps/backend/src/domain/types.ts`: inclusao de `urlBaseApi` na empresa.
- `apps/backend/src/modules/docs/OpenApiGenerator.ts`: parametros e metadados de paginacao no OpenAPI.
- `apps/frontend/src/App.tsx`: recarga preservando API selecionada e envio dos campos do Editor SQL.
- `scripts/postgres-schema.sql`: update automatico para registros existentes.
- `scripts/atualizar-parametros-editor-sql.sql`: script SQL standalone de atualizacao dos registros antigos.
- `.env.example`: exemplo de URL externa com `api.monvizo.com.br:8080`.
- `scripts/testar-integracao-isolado.mjs`: teste isolado validando persistencia e Swagger com paginacao.

## 4. Migrations / scripts SQL

O instalador executa `scripts/postgres-schema.sql`, que agora tambem atualiza APIs antigas sem `apiSql.parametrosTeste` e sem regras de paginacao.

Script standalone:

```powershell
psql -U postgres -d control_s_api_hub -f "C:\Control S API Hub\scripts\atualizar-parametros-editor-sql.sql"
```

## 5. Como testar

1. Entrar no portal.
2. Abrir `APIs` e criar ou selecionar uma API.
3. Abrir `Editor SQL`.
4. Selecionar uma API que nao seja a primeira.
5. Alterar o SQL, parametros de teste e regras.
6. Clicar em `Salvar SQL` e depois em `Salvar parametros`.
7. Trocar para outra API e voltar.
8. Confirmar que SQL, parametros e regras continuam iguais aos salvos.

## 6. Como usar a paginacao no Swagger

No Swagger publico, cada API publicada com paginacao habilitada mostra:

- `pagina`: pagina desejada, padrao 1.
- `pageSize`: quantidade solicitada por pagina, exemplo 500.

O retorno usa metadados em portugues:

```json
{
  "sucesso": true,
  "meta": {
    "pagina": 1,
    "quantidadePorPagina": 200,
    "totalRegistros": 1234,
    "totalPaginas": 7,
    "temProxima": true,
    "temAnterior": false
  },
  "dados": []
}
```

## 7. O que precisa no aplicativo para acesso externo

No `.env` ou na tela `Dominios`, configure:

```env
HOST=0.0.0.0
PORT=3335
APP_PUBLIC_URL=http://api.monvizo.com.br:8080
PORTAL_PUBLIC_URL=http://api.monvizo.com.br:8080
```

Na tela `Dominios`, usar:

- URL base da API: `http://api.monvizo.com.br:8080`
- URL da documentacao: `http://api.monvizo.com.br:8080/swagger`

## 8. O que depende de infraestrutura

Depende do ambiente:

- DNS `api.monvizo.com.br` apontando para o IP publico correto.
- NAT/roteador redirecionando porta 8080 externa para `192.168.1.70:3333`.
- Nginx no servidor ouvindo `3333` e encaminhando para o backend Node em `127.0.0.1:3335`.
- Firewall do Windows liberando a porta 3333 para entrada TCP.
- Certificado SSL se quiser publicar com `https://`.
- Proxy reverso/IIS/Caddy/Nginx se quiser usar porta 443 sem expor `:8080`.

## 9. Riscos / pontos de atencao

- A paginacao atual e aplicada apos a consulta retornar os registros. Para consultas muito grandes, a SQL deve ter filtro e `ORDER BY` consistente.
- `pageSize` padrao de teste e 500, mas o retorno respeita o limite maximo configurado em `regras.quantidadeMaximaPorPagina`, por padrao 200.
- Para uso externo seguro em producao, o ideal e HTTPS com proxy reverso na porta 443.

## 10. Respostas diretas as perguntas do solicitante

- O problema de salvar e voltar para o primeiro SQL era causado por recarga do frontend que sempre aplicava `apisDados[0]`.
- A correcao preserva o ID da API selecionada e recarrega SQL, parametros e regras do mesmo registro.
- Os parametros de teste nao salvavam porque nao eram enviados nos payloads de salvar SQL/parametros e nao eram reaplicados na leitura.
- A persistencia foi feita dentro de `apiSql.parametrosTeste` e `regras`, no JSONB da tabela `hub_entidades`.
- A paginacao usa `pagina` e `pageSize`, com aliases aceitos, e retorna `meta` em portugues.
- No Swagger, usar `pagina=1` e `pageSize=500` ou o limite permitido pela API.
- Para acessar por dominio externo, o aplicativo precisa estar com `HOST=0.0.0.0` e URL publica configurada.
- Porta, DNS, NAT, firewall e SSL dependem da infraestrutura.
- O Swagger fica acessivel por `http://api.monvizo.com.br:8080/swagger` se o encaminhamento externo estiver correto.
- As APIs ficam acessiveis por `http://api.monvizo.com.br:8080/v1/...` com Bearer Token valido.

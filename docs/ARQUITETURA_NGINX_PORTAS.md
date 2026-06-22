# Arquitetura com Nginx - Control S API Hub

## Fluxo no servidor

```text
api.monvizo.com.br:8080
  -> firewall / NAT
  -> 192.168.1.70:3333
  -> Nginx no servidor
  -> 127.0.0.1:3335
  -> Control S API Hub Node.js
```

## Portas

- `8080`: porta externa publicada para o dominio `api.monvizo.com.br`.
- `3333`: porta interna do servidor onde o Nginx recebe as chamadas.
- `3335`: porta interna onde o Control S API Hub roda em Node.js.

## Configuracao do Control S API Hub

No arquivo `.env` do servidor:

```env
PORT=3335
HOST=0.0.0.0
APP_PUBLIC_URL=http://api.monvizo.com.br:8080
PORTAL_PUBLIC_URL=http://api.monvizo.com.br:8080
```

## Configuracao do Nginx

Use o arquivo:

```text
C:\Control S API Hub\scripts\nginx-control-s-api-hub.conf
```

Copie o conteudo dele para a configuracao do Nginx, normalmente em:

```text
C:\nginx\conf\conf.d\control-s-api-hub.conf
```

ou inclua no `nginx.conf`.

Depois reinicie o Nginx:

```cmd
cd /d C:\nginx
nginx.exe -s reload
```

Se o Nginx ainda nao estiver rodando:

```cmd
cd /d C:\nginx
start nginx.exe
```

## Testes

Teste o Node direto:

```text
http://localhost:3335/saude
```

Teste o Nginx no servidor:

```text
http://localhost:3333/saude
```

Teste externo:

```text
http://api.monvizo.com.br:8080/saude
http://api.monvizo.com.br:8080/swagger
```

## Observacao sobre HTTPS

Essa arquitetura funciona sem certificado usando `http://api.monvizo.com.br:8080`.
Para usar `https://api.monvizo.com.br`, sera necessario certificado SSL e publicacao pela porta 443.

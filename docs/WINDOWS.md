# Instalação e operação em Windows

## Ambiente local

1. Instale Node.js 20 LTS.
2. Instale SQL Server Express ou habilite LocalDB.
3. Abra o PowerShell.
4. Execute:

```powershell
cd "C:\Control S API Hub"
copy .env.example .env
npm install
npm run dev:backend
```

Em outro terminal:

```powershell
cd "C:\Control S API Hub"
npm run dev:frontend
```

## Build

```powershell
cd "C:\Control S API Hub"
npm run build
```

## Execução em Windows Server

1. Instale Node.js LTS.
2. Copie o projeto para `C:\Control S API Hub`.
3. Configure `.env` com chaves de produção.
4. Execute `npm install --omit=dev` após o build, quando aplicável.
5. Inicie o backend com:

```cmd
cd /d "C:\Control S API Hub"
npm run start
```

## Serviço do Windows

Para operação profissional, recomenda-se registrar o backend como serviço usando NSSM ou WinSW.

Exemplo conceitual com NSSM:

```cmd
nssm install ControlSApiHubBackend
```

Configurar:

- Application: caminho do `node.exe`
- Arguments: `apps\backend\dist\server.js`
- Startup directory: `C:\Control S API Hub`

## Publicação com IIS no futuro

Instale:

- IIS
- URL Rewrite
- Application Request Routing

Cenário recomendado:

- IIS recebe `https://api.cliente.com.br`
- Reverse proxy encaminha para `http://localhost:3333`
- `/documentacao` expõe a documentação
- `/v1/...` expõe APIs publicadas

## Observações de segurança

- Troque todos os segredos do `.env`.
- Restrinja portas internas no firewall.
- Use HTTPS no IIS.
- Proteja backups do banco interno.
- Registre logs em volume monitorado.
- Use usuário de serviço com permissões mínimas.

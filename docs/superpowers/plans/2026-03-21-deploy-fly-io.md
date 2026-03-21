# Deploy no Fly.io — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colocar a DevInsight API em produção no Fly.io com deploy automático a cada push no `master` via GitHub Actions.

**Architecture:** A API Node.js/Express é empacotada em uma imagem Docker (node:20-alpine) e executada no Fly.io na região `gru` (São Paulo) com `auto_stop_machines = "off"` para garantir zero cold start. O deploy é disparado automaticamente pelo GitHub Actions após `npm test` passar.

**Tech Stack:** Docker, Fly.io (flyctl CLI), GitHub Actions, Node.js 20

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `Dockerfile` | Criar | Imagem de produção |
| `.dockerignore` | Criar | Excluir arquivos desnecessários da imagem |
| `fly.toml` | Criar | Configuração do app no Fly.io |
| `.github/workflows/deploy.yml` | Criar | Pipeline CI/CD: test → deploy |

---

### Task 1: Dockerfile e .dockerignore

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

**Pré-requisito:** Docker Desktop instalado localmente para validar a imagem antes do primeiro deploy.
Instalar em: https://www.docker.com/products/docker-desktop/

- [ ] **Step 1: Criar o Dockerfile**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "src/server.js"]
```

- [ ] **Step 2: Criar o .dockerignore**

```
node_modules
.env
.env.*
tests/
docs/
coverage/
OUTROS/
*.test.js
.git
.claude
```

- [ ] **Step 3: Build da imagem para verificar que não há erros**

```bash
docker build -t devinsight-api:local .
```

Saída esperada: `Successfully built <id>` (sem erros). Se falhar, verificar se `src/server.js` e `package.json` estão no lugar correto.

- [ ] **Step 4: Rodar o container localmente e testar o health check**

```bash
docker run -d -p 3001:3000 \
  -e SUPABASE_URL="" \
  -e SUPABASE_KEY="" \
  --name devinsight-test \
  devinsight-api:local
```

```bash
curl http://localhost:3001/health
```

Saída esperada: `{"ok":true}`

- [ ] **Step 5: Remover o container de teste**

```bash
docker stop devinsight-test && docker rm devinsight-test
```

- [ ] **Step 6: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "feat: adicionar Dockerfile e .dockerignore para deploy no Fly.io"
```

---

### Task 2: fly.toml

**Files:**
- Create: `fly.toml`

**Pré-requisito:** flyctl instalado. No Windows:
```bash
winget install flyctl
```
Ou pelo PowerShell: `iwr https://fly.io/install.ps1 -useb | iex`

- [ ] **Step 1: Criar fly.toml**

```toml
app = "devinsight-api"
primary_region = "gru"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = "off"
  auto_start_machines = true
  min_machines_running = 1

  [[http_service.checks]]
    grace_period = "5s"
    interval = "10s"
    method = "GET"
    path = "/health"
    timeout = "2s"

[[vm]]
  memory = "256mb"
  cpus = 1
  cpu_kind = "shared"
```

- [ ] **Step 2: Validar a sintaxe do fly.toml**

```bash
flyctl config validate
```

Saída esperada: `✓ Configuration is valid`

Se `flyctl` não estiver no PATH, reiniciar o terminal após a instalação.

- [ ] **Step 3: Commit**

```bash
git add fly.toml
git commit -m "feat: adicionar fly.toml para configuração do Fly.io"
```

---

### Task 3: GitHub Actions — pipeline de deploy

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Criar o diretório e o arquivo de workflow**

```bash
mkdir -p .github/workflows
```

Conteúdo de `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [master]

jobs:
  test-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - run: npm test

      - uses: superfly/flyctl-actions/setup-flyctl@master

      - run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

- [ ] **Step 2: Commit (sem push ainda — secrets ainda não estão configurados)**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat: adicionar GitHub Actions para deploy automático no Fly.io"
```

---

### Task 4: Setup do Fly.io (infraestrutura — feito uma vez)

Estes passos são executados no terminal, não geram código. Devem ser feitos antes do primeiro `git push`.

- [ ] **Step 1: Autenticar no Fly.io**

```bash
flyctl auth login
```

Abre o browser para login/signup em fly.io. Criar conta gratuita se ainda não tiver.

- [ ] **Step 2: Criar o app no Fly.io**

Na raiz do projeto (`C:\PROJETOS\API`):

```bash
flyctl apps create devinsight-api --machines
```

Saída esperada:
```
New app created: devinsight-api
```

Se o nome `devinsight-api` já estiver tomado, use `devinsight-api-<seu-usuario>` e atualize o `fly.toml` (`app = "devinsight-api-<seu-usuario>"`).

- [ ] **Step 3: Configurar os secrets de produção**

```bash
flyctl secrets set \
  SUPABASE_URL=https://wlfjbylsuyjcoyqfhksq.supabase.co \
  SUPABASE_KEY=<sua-service-role-key> \
  NODE_ENV=production
```

Substituir `<sua-service-role-key>` pela chave `service_role` do Supabase (Supabase Dashboard → Project Settings → API → service_role).

Saída esperada: `Secrets are staged for the first deployment`

- [ ] **Step 4: Gerar o token de deploy para o GitHub Actions**

```bash
flyctl tokens create deploy -x 999999h
```

Saída esperada: um token começando com `FlyV1 ...` — **copiar imediatamente**, não será exibido novamente.

- [ ] **Step 5: Adicionar o token no GitHub**

1. Abrir https://github.com/mirutee/devinsight-api/settings/secrets/actions
2. Clicar em **New repository secret**
3. Name: `FLY_API_TOKEN`
4. Secret: colar o token copiado no passo anterior
5. Clicar em **Add secret**

---

### Task 5: Primeiro deploy e validação

- [ ] **Step 1: Push para disparar o GitHub Actions**

```bash
git push origin master
```

- [ ] **Step 2: Acompanhar o pipeline**

Abrir: https://github.com/mirutee/devinsight-api/actions

Aguardar os três passos: `npm ci` → `npm test` → `flyctl deploy`

Tempo esperado: 3-5 minutos no primeiro deploy (build da imagem Docker nos servidores do Fly.io).

- [ ] **Step 3: Verificar o health check em produção**

```bash
curl https://devinsight-api.fly.dev/health
```

Saída esperada: `{"ok":true}`

Se o nome do app foi alterado no passo anterior, a URL será `https://<nome-do-app>.fly.dev/health`.

- [ ] **Step 4: Verificar os logs da aplicação**

```bash
flyctl logs
```

Saída esperada: `DevInsight API rodando na porta 3000`

- [ ] **Step 5: Testar um endpoint real em produção**

```bash
curl -X POST https://devinsight-api.fly.dev/v1/diagnosticos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <api-key-de-um-usuario-cadastrado>" \
  -d '{"url":"/users","method":"GET","categoria":"backend"}'
```

Saída esperada: JSON com `problema`, `causa`, `nivel`, `sugestoes`, `confianca`.

Se retornar 401, significa que a API Key é inválida (esperado — confirma que o auth está funcionando em produção).

- [ ] **Step 6: Atualizar .env.example com a URL de produção**

Adicionar ao final de `.env.example`:
```
# Produção
API_BASE_URL=https://devinsight-api.fly.dev
```

- [ ] **Step 7: Commit e push final**

```bash
git add .env.example
git commit -m "docs: adicionar URL de produção no .env.example"
git push origin master
```

---

## Rollback (se necessário)

```bash
# Listar versões anteriores
flyctl releases list

# Reverter para uma versão específica
flyctl deploy --image <image-ref-da-versao-anterior>
```

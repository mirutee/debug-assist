# DevInsight API — Deploy no Fly.io com CI/CD

**Data:** 2026-03-21
**Fase:** Deploy — colocar a API em produção com zero custo e deploy automático
**Status:** Aprovado

---

## Contexto

A API está completa localmente (MVP + auth por usuário + planos). Esta fase coloca o serviço no ar via Fly.io, com deploy automático a cada push no `master` via GitHub Actions.

---

## Decisões

| Decisão | Motivo |
|---|---|
| Fly.io | Único free tier que não dorme — crítico para uma API |
| Região `gru` (São Paulo) | Menor latência para usuários brasileiros |
| `auto_stop_machines = false` | Garante que a VM nunca hiberna |
| `min_machines_running = 1` | Sempre pelo menos uma instância ativa |
| `node:20-alpine` | Imagem leve (~180MB), suficiente para Node.js puro |
| `npm ci --only=production` | Exclui Jest/supertest da imagem de produção |
| GitHub Actions | Deploy só acontece se `npm test` passar — proteção contra regressões |
| `FLY_API_TOKEN` no GitHub Secrets | Token de deploy nunca entra no repositório |

---

## 1. Arquivos a Criar

| Arquivo | Responsabilidade |
|---|---|
| `Dockerfile` | Imagem de produção |
| `.dockerignore` | Exclui arquivos desnecessários da imagem |
| `fly.toml` | Configuração do app no Fly.io |
| `.github/workflows/deploy.yml` | Pipeline CI/CD: test → deploy |

---

## 2. Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "src/server.js"]
```

- `node:20-alpine` — menor superfície de ataque, imagem ~180MB
- `COPY package*.json` antes do código para aproveitar cache de layers do Docker
- `npm ci --only=production` — instala apenas dependências de runtime

---

## 3. .dockerignore

```
node_modules
.env
.env.*
tests/
docs/
.git
.claude
```

Evita que `node_modules` local (Windows) corrompa a imagem Linux, e que `.env` exponha secrets.

---

## 4. fly.toml

```toml
app = "devinsight-api"
primary_region = "gru"

[build]

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  memory = "256mb"
  cpus = 1
```

- `force_https = true` — HTTPS obrigatório, HTTP redireciona automaticamente
- `auto_stop_machines = false` — nunca dorme (diferencial do Fly.io vs Render/Railway free)
- `min_machines_running = 1` — mantém instância ativa mesmo sem tráfego

---

## 5. GitHub Actions — deploy.yml

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

- `npm test` falhou → pipeline para, deploy bloqueado
- `--remote-only` — build acontece nos servidores do Fly.io, não no runner do GitHub
- `FLY_API_TOKEN` vem de `Settings > Secrets and variables > Actions` no repositório GitHub

---

## 6. Variáveis de Ambiente em Produção

Configuradas via `flyctl secrets set` — nunca no repositório:

```bash
flyctl secrets set SUPABASE_URL=https://wlfjbylsuyjcoyqfhksq.supabase.co
flyctl secrets set SUPABASE_KEY=<service_role_key>
flyctl secrets set NODE_ENV=production
```

O Fly.io injeta os secrets como variáveis de ambiente em runtime. O `.env` local **não** é usado em produção.

---

## 7. Fluxo Completo de Setup (uma vez)

```
1. flyctl auth login
2. flyctl launch --no-deploy  (gera fly.toml, não faz deploy ainda)
3. flyctl secrets set SUPABASE_URL=... SUPABASE_KEY=... NODE_ENV=production
4. flyctl tokens create deploy  → copiar token
5. GitHub: Settings > Secrets > FLY_API_TOKEN = <token copiado>
6. git push master  → GitHub Actions faz o primeiro deploy automaticamente
```

---

## 8. Health Check

O endpoint `GET /health` já existe e retorna `{ status: "ok" }`. O Fly.io usa o HTTP check padrão na porta 3000 — nenhuma configuração adicional necessária.

---

## 9. URL de Produção

Após o primeiro deploy: `https://devinsight-api.fly.dev`

Domínio customizado pode ser adicionado depois via `flyctl certs add <dominio>` — fora do escopo desta fase.

---

## Fora do Escopo

- Domínio customizado
- Múltiplas regiões / réplicas
- Monitoramento (Fly Metrics, Sentry)
- Staging environment

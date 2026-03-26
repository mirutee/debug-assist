# Dashboard: Configurações + Analytics — Design

**Data:** 2026-03-26
**Fase:** Dashboard — página de Configurações com rotação de API Key e gráfico de uso
**Status:** Aprovado

---

## Contexto

O dashboard já tem: Visão Geral, Histórico, Alertas, Pricing, Login, Signup.
Esta fase adiciona a página **Configurações** — última pendência do dashboard — cobrindo:
1. Dados da conta (email read-only)
2. Rotação de API Key (com confirmação antes de invalidar)
3. Analytics: gráfico de barras com uso dos últimos 30 dias

Sem alterações no schema do banco — analytics lê `diagnosticos` agrupando por dia.

---

## Decisões de Design

| Decisão | Motivo |
|---|---|
| Configurações e Analytics na mesma página | Sidebar mais enxuta; evita página extra |
| Últimos 30 dias (rolling) | Mais útil para ver tendências; independente do ciclo de billing |
| Gráfico SVG puro (sem lib) | Zero dependência externa; consistente com abordagem vanilla do projeto |
| Modal de confirmação antes de rotacionar key | Key antiga é invalidada imediatamente — ação irreversível |
| Email read-only | Não há campo `nome` na tabela `usuarios`; troca de senha fora do escopo |
| Sem breakdown por categoria no gráfico | Query simples; suficiente para MVP |

---

## Arquitetura

```
public/dashboard/configuracoes.html   ← nova página estática
     │
     ├── GET /v1/auth/me               ← já existe (email, plano, api_key)
     ├── POST /v1/auth/regenerate-key  ← novo
     └── GET /v1/analytics             ← novo
```

---

## Página `public/dashboard/configuracoes.html`

### Seções (ordem vertical)

**1. Conta**
- Label "Email" + valor read-only vindo de `GET /v1/auth/me`

**2. API Key**
- Campo mascarado + botões Revelar / Copiar (mesmo padrão do index.html)
- Botão "🔄 Gerar nova key" → abre modal de confirmação
- **Modal:** "Sua key atual vai parar de funcionar imediatamente. Tem certeza?" + [Cancelar] [Sim, gerar nova]
- Após confirmar: `POST /v1/auth/regenerate-key` → fecha modal → exibe nova key revelada + feedback "Nova key gerada!"

**3. Uso dos últimos 30 dias**
- Gráfico de barras SVG (inline, gerado por JS)
- Eixo X: datas (label a cada 5 dias)
- Eixo Y: contagem de chamadas com grid lines (5 / 10 / 15)
- Tooltip ao passar o mouse: "22 mar — 7 chamadas"
- Estado vazio: "Nenhuma chamada nos últimos 30 dias"
- Estado de erro: "Não foi possível carregar o gráfico"

### Sidebar

Adicionar link `⚙️ Configurações` entre Alertas e Docs em **todas** as páginas do dashboard:
- `index.html`, `historico.html`, `alertas.html`, `pricing.html`

---

## Novos Endpoints Backend

### `POST /v1/auth/regenerate-key`

**Auth:** Bearer token obrigatório

**O que faz:**
1. Valida token → obtém `usuario_id`
2. Gera novo `uuid` via `gen_random_uuid()`
3. `UPDATE usuarios SET api_key = <novo_uuid> WHERE id = <usuario_id>`
4. Retorna `{ "api_key": "<novo_uuid>" }`

**Arquivo:** `src/routes/auth.js` (nova rota no router existente)

**Resposta de sucesso:**
```json
{ "api_key": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }
```

**Erros:**
| Status | Situação |
|---|---|
| 401 | Token ausente ou inválido |
| 404 | Usuário não encontrado na tabela `usuarios` |
| 500 | Falha no UPDATE |

---

### `GET /v1/analytics`

**Auth:** Bearer token obrigatório

**O que faz:**
1. Valida token → obtém `usuario_id`
2. Query em `diagnosticos` agrupando por dia nos últimos 30 dias:

```sql
SELECT
  DATE(criado_em) AS data,
  COUNT(*)::int   AS total
FROM diagnosticos
WHERE usuario_id = $1
  AND criado_em >= NOW() - INTERVAL '30 days'
GROUP BY DATE(criado_em)
ORDER BY data ASC
```

3. Retorna apenas dias com chamadas (frontend preenche os dias faltantes com `total: 0`)

**Arquivo:** `src/routes/analytics.js` (novo arquivo) + registrado em `src/app.js`

**Resposta de sucesso:**
```json
{
  "dados": [
    { "data": "2026-02-25", "total": 3 },
    { "data": "2026-02-26", "total": 0 },
    { "data": "2026-02-27", "total": 7 }
  ]
}
```

**Nota:** O backend retorna apenas dias com chamadas; o frontend preenche os dias faltantes com `total: 0` para garantir 30 barras no gráfico.

**Erros:**
| Status | Situação |
|---|---|
| 401 | Token ausente ou inválido |
| 500 | Falha na query |

---

## Fluxo de Dados

```
1. Página carrega
   └── GET /v1/auth/me
       ├── 401 → redireciona para /dashboard/login
       └── 200 → preenche email + api_key
               └── GET /v1/analytics
                   ├── erro → "Não foi possível carregar o gráfico"
                   └── 200 → renderiza gráfico SVG

2. Gerar nova key
   └── clique em "🔄 Gerar nova key"
       └── exibe modal de confirmação
           ├── [Cancelar] → fecha modal
           └── [Sim, gerar nova] → POST /v1/auth/regenerate-key
               ├── erro → fecha modal + mensagem inline vermelha
               └── 200 → fecha modal + atualiza campo api_key (revelada) + "Nova key gerada!"
```

---

## Tratamento de Erros

| Situação | Comportamento |
|---|---|
| 401 em qualquer chamada | Limpa localStorage → redireciona para login |
| Erro ao gerar nova key | Mensagem inline vermelha abaixo do botão; modal fecha |
| Nenhum diagnóstico nos 30d | Texto no lugar do gráfico: "Nenhuma chamada nos últimos 30 dias" |
| Erro de rede no analytics | Texto discreto: "Não foi possível carregar o gráfico" |

---

## Mapa de Arquivos

| Arquivo | Ação |
|---|---|
| `public/dashboard/configuracoes.html` | Criar |
| `src/routes/analytics.js` | Criar |
| `src/routes/auth.js` | Modificar — adicionar rota `POST /regenerate-key` |
| `src/app.js` | Modificar — registrar `/v1/analytics` |
| `public/dashboard/index.html` | Modificar — adicionar link Configurações na sidebar |
| `public/dashboard/historico.html` | Modificar — adicionar link Configurações na sidebar |
| `public/dashboard/alertas.html` | Modificar — adicionar link Configurações na sidebar |
| `public/dashboard/pricing.html` | Modificar — adicionar link Configurações na sidebar |

---

## Fora do Escopo

- Troca de senha inline
- Breakdown do gráfico por categoria (frontend/backend/sql)
- Campo nome do usuário
- Histórico de rotações de API Key

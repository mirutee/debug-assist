# DEBUG_Assist

> Diagnóstico inteligente de erros para APIs — detecta, explica e sugere correções em tempo real.

**[debugassist.com.br](https://debugassist.com.br)** · [Docs](https://debugassist.com.br/docs) · [Dashboard](https://debugassist.com.br/dashboard)

---

## O que é

O DEBUG_Assist analisa erros de APIs (requisições HTTP, queries SQL, erros de frontend) e retorna um diagnóstico legível com causa, severidade e sugestões de correção — em português.

```bash
curl -X POST https://debugassist.com.br/v1/diagnosticos \
  -H "Authorization: Bearer SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tipo": "http_500",
    "mensagem": "Cannot read properties of undefined",
    "contexto": { "url": "/users", "method": "POST" }
  }'
```

```json
{
  "problema": "Acesso a propriedade de objeto indefinido",
  "causa": "A variável está undefined antes de ser acessada — possivelmente retorno inesperado de banco de dados ou API externa",
  "nivel": "alto",
  "categoria": "backend",
  "sugestoes": [
    "Verifique se o retorno da query existe antes de acessar propriedades",
    "Adicione optional chaining: objeto?.propriedade",
    "Valide o payload de entrada antes de processar"
  ],
  "confianca": 0.91
}
```

---

## SDKs

| Linguagem | Pacote | Instalação |
|---|---|---|
| JavaScript / Node.js | [debug-assist-sdk](https://www.npmjs.com/package/debug-assist-sdk) | `npm install debug-assist-sdk` |
| Python | [debug-assist-sdk](https://pypi.org/project/debug-assist-sdk/) | `pip install debug-assist-sdk` |
| Ruby | [debug_assist](https://rubygems.org/gems/debug_assist) | `gem install debug_assist` |
| Go | [sdk/go](https://pkg.go.dev/github.com/mirutee/devinsight-api/sdk/go) | `go get github.com/mirutee/devinsight-api/sdk/go` |
| C# / .NET | [DebugAssist.SDK](https://www.nuget.org/packages/DebugAssist.SDK) | `dotnet add package DebugAssist.SDK` |
| PHP | [debug-assist/debug-assist](https://packagist.org/packages/debug-assist/debug-assist) | `composer require debug-assist/debug-assist` |

---

## Planos

| Plano | Diagnósticos/mês | Preço |
|---|---|---|
| Free | 100 | Grátis |
| Pro | 1.000 | R$ 99/mês |
| Scale | 10.000 | R$ 349/mês |
| Enterprise | Customizado | Consulta |

---

## Stack

- **Backend:** Node.js + Express
- **Banco de dados:** Supabase (PostgreSQL)
- **Pagamentos:** Stripe
- **E-mail:** Resend
- **Deploy:** Render
- **CI/CD:** GitHub Actions

---

## Estrutura do projeto

```
src/
  engines/      # Motores de diagnóstico (frontend, backend, sql)
  routes/       # Endpoints da API
  middleware/   # Auth, rate limiting, validação
  db/           # Cliente Supabase
  email/        # Templates e envio via Resend
sdk/            # SDKs por linguagem
public/         # Landing page e dashboard
tests/          # Testes automatizados
```

---

## Desenvolvimento local

```bash
git clone https://github.com/mirutee/devinsight-api.git
cd devinsight-api
npm install
cp .env.example .env
# Preencha as variáveis no .env
npm run dev
```

### Testes

```bash
npm test
```

---

## API Reference

Documentação completa: [debugassist.com.br/docs](https://debugassist.com.br/docs)

Spec OpenAPI: [`swagger.yaml`](./swagger.yaml)

### Endpoint principal

```
POST /v1/diagnosticos
Authorization: Bearer <API_KEY>
```

**Categorias suportadas:** `frontend` · `backend` · `sql`

---

## Licença

Proprietário — © 2026 DEBUG_Assist. Todos os direitos reservados.

# debug-assist-sdk

SDK oficial da [Debug Assist](https://debug-assist.onrender.com) — captura e envia erros silenciosos da sua aplicação para diagnóstico inteligente.

## Instalação

```bash
npm install debug-assist-sdk
```

## Uso rápido

```js
const DebugAssist = require('debug-assist-sdk');

// Captura automática de uncaughtException e unhandledRejection
DebugAssist.init({ apiKey: 'sua-api-key', projectName: 'meu-projeto' });

// Envio manual de um erro
const client = new DebugAssist({ apiKey: 'sua-api-key' });
await client.report({
  tipo: 'backend_error',
  mensagem: 'Falha ao conectar ao banco',
  contexto: { rota: '/users', metodo: 'POST' },
});
```

## API

### `new DebugAssist({ apiKey, baseUrl? })`

Cria uma instância do cliente.

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `apiKey` | string | sim | Sua API key da Debug Assist |
| `baseUrl` | string | não | URL base da API (padrão: produção) |

### `client.report({ tipo, mensagem?, contexto?, dados? })`

Envia um diagnóstico para a API.

| Parâmetro | Tipo | Obrigatório |
|-----------|------|-------------|
| `tipo` | string | sim |
| `mensagem` | string | não |
| `contexto` | object | não |
| `dados` | object | não |

### `DebugAssist.init({ apiKey, projectName?, baseUrl? })`

Ativa captura automática de erros não tratados (`uncaughtException` / `unhandledRejection`).

## Licença

MIT

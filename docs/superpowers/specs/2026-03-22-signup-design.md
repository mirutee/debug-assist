# Signup Page — Design

**Data:** 2026-03-22
**Status:** Aprovado

## Problema

A landing page e a navbar do dashboard apontam todos os CTAs de "Criar conta" para `/dashboard/signup.html`, mas essa página não existe — o link leva a uma 404. Sem ela, o produto não tem funil de aquisição funcional.

## Solução

Página estática `public/dashboard/signup.html`, servida pelo `express.static` já configurado em `src/app.js`. Sem rota nova no Express, sem dependência nova.

O endpoint `POST /v1/auth/signup` já existe e aceita `{ email, senha }`. A página apenas consome esse endpoint e redireciona para o login com um query param de confirmação.

## Fluxo

1. Usuário acessa `/dashboard/signup.html`
2. Preenche email + senha → submit
3. Fetch `POST /v1/auth/signup` com `{ email, senha }`
4. **Sucesso (201):** redireciona para `/dashboard/login.html?msg=verifique-email`
5. **Erro (400/500):** exibe mensagem de erro na própria página
6. `login.html` lê `?msg=verifique-email` na URL e exibe banner de confirmação

## Arquitetura

O `src/app.js` já serve `public/` via `express.static`. Nenhuma mudança de servidor necessária.

```
public/dashboard/
  signup.html    ← novo
  login.html     ← modificar: ler ?msg= e exibir banner
  index.html     ← sem mudança
  style.css      ← sem mudança (compartilhado por signup e login)
```

## Arquivos

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `public/dashboard/signup.html` | Criar | Formulário email + senha, fetch POST /v1/auth/signup, redirect on success, error on fail |
| `public/dashboard/login.html` | Modificar | Ler `?msg=verifique-email` e exibir banner de confirmação |
| `tests/routes/signup.test.js` | Criar | Verifica que `GET /dashboard/signup.html` retorna 200 com HTML |

## Detalhes de implementação

### `public/dashboard/signup.html`

- Mesmo dark theme da `login.html`
- Usa `style.css` do mesmo diretório (`<link rel="stylesheet" href="style.css">`)
- Card centralizado com logo DevInsight (ponto roxo + texto)
- Campos: `email` (type="email") + `senha` (type="password", minlength="6")
- Botão "Criar conta" (id="btn-signup")
- Div de erro (id="error-msg", mesma classe `.error-msg` do login)
- Link no rodapé do card: "Já tem conta? Entrar" → `/dashboard/login.html`

**Script:**
- Se `localStorage.getItem('devinsight_token')` existir → redirecionar para `/dashboard/`
- Submit: desabilitar botão, fetch `POST /v1/auth/signup` com `{ email, senha }`
- 201 → `window.location.replace('/dashboard/login.html?msg=verifique-email')`
- 400 com `erro: "Email já cadastrado"` → exibir "Email já cadastrado"
- 400 com `erro: "Senha inválida..."` → exibir "Senha deve ter no mínimo 6 caracteres"
- 400 com `erro: "Email inválido"` → exibir "Email inválido"
- Outros erros → exibir "Erro ao criar conta. Tente novamente."
- Finally: reabilitar botão

### `public/dashboard/login.html`

Adicionar no script existente, **antes** do listener de submit:

```js
const params = new URLSearchParams(window.location.search);
if (params.get('msg') === 'verifique-email') {
  const banner = document.getElementById('success-msg');
  if (banner) {
    banner.textContent = 'Conta criada! Verifique seu email para ativar.';
    banner.classList.add('show');
  }
}
```

Adicionar elemento HTML no card, após o `<form>` ou antes do erro:

```html
<div class="success-msg" id="success-msg"></div>
```

Adicionar CSS em `style.css`:

```css
.success-msg {
  display: none;
  color: #4ade80;
  font-size: 13px;
  text-align: center;
  margin-top: 12px;
}
.success-msg.show { display: block; }
```

### `tests/routes/signup.test.js`

Mesmo padrão de `tests/routes/dashboard.test.js`:

```js
const request = require('supertest');
jest.mock('../../src/db/supabase', () => ({ ... }));
const app = require('../../src/app');

describe('Signup page', () => {
  it('GET /dashboard/signup.html retorna 200 com HTML', async () => {
    const res = await request(app).get('/dashboard/signup.html');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });

  it('GET /dashboard/signup.html contém DevInsight', async () => {
    const res = await request(app).get('/dashboard/signup.html');
    expect(res.text).toMatch(/DevInsight/i);
  });

  it('GET /dashboard/signup.html contém link para login', async () => {
    const res = await request(app).get('/dashboard/signup.html');
    expect(res.text).toContain('/dashboard/login.html');
  });
});
```

## Identidade visual

Segue o mesmo tema do dashboard e da landing page:
- Fundo: `#0d0d0d`
- Cards: `#111`
- Bordas: `#222`
- Accent: `#6366f1`
- Texto primário: `#fff`
- Texto secundário: `#555` / `#888`
- Fonte: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

`signup.html` usa `style.css` existente — sem CSS novo no HTML.

## Testes

- `GET /dashboard/signup.html` → status 200, content-type `text/html`
- Body contém `DevInsight`
- Body contém `/dashboard/login.html` (link "Já tem conta?")
- Rotas existentes não afetadas (verificadas pelos testes já existentes)

## Não está no escopo

- Validação de força de senha além de mínimo 6 caracteres (já feita no backend)
- Confirmação de senha (campo "repita sua senha")
- OAuth / login social
- Animações ou onboarding pós-cadastro
- Qualquer mudança no backend

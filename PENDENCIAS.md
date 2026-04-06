# Pendências — DEBUG_Assist (continuar na próxima conversa)

## 1. Cores antigas (indigo #6366f1) em 3 arquivos do dashboard
- `public/dashboard/login.html` linha 44 — link "Criar conta" inline style
- `public/dashboard/signup.html` linha 43 — link "Entrar" inline style
- `public/dashboard/pricing.html` linhas 14, 15, 21 — `.plan-card.destaque`, `.plan-badge`, `.btn-outline` têm estilo inline com indigo

**Fix:** trocar `#6366f1` por `#00D4FF` (ciano da marca) nesses 3 arquivos.

## 2. Toggle dark/light no dashboard ainda não validado em produção
- CSS foi corrigido (vars + transition), JS foi corrigido (updateThemeIcon imediato)
- Usuário reportou que ainda não funcionava — verificar no site ao vivo após deploy

## 3. Páginas de termos e privacidade
- `public/termos.html` e `public/privacidade.html` — não verificadas se usam
  paleta antiga ou têm estilos próprios desatualizados

## 4. Página de docs
- `public/docs/sdks.html` — não verificada se usa style.css da landing ou tem
  estilos próprios com indigo/purple

## 5. Logo no dashboard (sidebar)
- O dashboard usa texto "DEBUG_Assist" com logo-dot, não a imagem logo.png
- Considerar usar a imagem logo.png também no sidebar do dashboard

## Cores da marca (referência)
- Background:  #07101E
- Surface:     #0F1929
- Border:      #1E3554
- Accent cyan: #00D4FF  (do "</>" e "Assist" na logo)
- Green neon:  #22FF7A  (do "DEBUG"/bug na logo)
- Text:        #E8F0FF
- Muted:       #5A7A9A

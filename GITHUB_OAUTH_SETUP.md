# GitHub OAuth Setup — Debug Assist

## ✅ Credenciais Confirmadas (Atualizadas)
- **Client ID:** `Ov23lidbdcB57gwXv4Ol`
- **Client Secret:** `efba31ab634cfa59b5d1d7e71ef893275ec93ef0`

## Como Configurar no Supabase (último passo!)

1. Acesse: https://app.supabase.com
2. Selecione seu projeto
3. Vá em: **Authentication → Providers**
4. Procure por **GitHub**
5. Marque "Enable"
6. Cole as credenciais:
   - **Client ID:** `Ov23lidbdcB57gwXv4Ol`
   - **Client Secret:** `efba31ab634cfa59b5d1d7e71ef893275ec93ef0`
7. Clique **Save**

## Testar
- Abra: https://debugassist.com.br/dashboard/login.html
- Clique em "Continuar com GitHub"
- Deve redirecionar para GitHub para autorizar
- Após autorizar, volta e faz login automaticamente

## Autorização Callback (já configurado)
```
https://wlfjbylsuyjcoyqfhksq.supabase.co/auth/v1/callback
```

---
**Status:** ✅ Credenciais prontas. Falta apenas colar no Supabase.

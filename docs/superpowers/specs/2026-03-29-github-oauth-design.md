# GitHub OAuth Design

**Date:** 2026-03-29

## Goal

Add "Continuar com GitHub" button to the signup and login pages. Standard OAuth redirect flow: user clicks button → GitHub authorization screen → returns to the app already logged in.

## Architecture

Frontend-only OAuth flow using the Supabase JS client (CDN). No new backend endpoints. The JWT issued by Supabase for GitHub OAuth users is identical in structure to email/password JWTs — all existing backend routes (`/v1/auth/me`, `/v1/diagnosticos`, etc.) work without modification.

## Flow

1. User clicks "Continuar com GitHub" on `signup.html` or `login.html`
2. Frontend calls `supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: 'https://debugassist.com.br/dashboard/auth-callback.html' } })`
3. Browser redirects to GitHub authorization page
4. User clicks "Authorize" on GitHub
5. GitHub redirects to Supabase → Supabase redirects to `auth-callback.html` with session token in URL hash
6. `auth-callback.html` calls `supabase.auth.getSession()`, saves `access_token` as `debug_assist_token` in localStorage, redirects to `/dashboard/`

New users and returning users use the same flow. GitHub is the source of truth for identity.

## Problem: `usuarios` table record for OAuth users

The existing trigger fires on `UPDATE` when `confirmed_at` changes from NULL → non-NULL (email confirmation flow). OAuth users arrive already confirmed on `INSERT` — the trigger never fires, leaving no record in `public.usuarios`.

**Fix:** New migration adds a second trigger `AFTER INSERT ON auth.users` that creates the `usuarios` record when `NEW.confirmed_at IS NOT NULL` and the provider is not `email`. Uses `ON CONFLICT (auth_id) DO NOTHING` for safety.

## Files

| File | Action |
|------|--------|
| `public/dashboard/signup.html` | Add Supabase JS CDN + "Continuar com GitHub" button |
| `public/dashboard/login.html` | Add Supabase JS CDN + "Continuar com GitHub" button |
| `public/dashboard/auth-callback.html` | Create — handles OAuth redirect, saves token, redirects to dashboard |
| `supabase/migrations/20260329_oauth_trigger.sql` | Create — trigger for OAuth user record creation |

## Prerequisites (manual, outside the codebase)

1. **GitHub OAuth App** — Settings → Developer settings → OAuth Apps → New OAuth App
   - Homepage URL: `https://debugassist.com.br`
   - Authorization callback URL: `https://wlfjbylsuyjcoyqfhksq.supabase.co/auth/v1/callback`
   - Copy Client ID and Client Secret

2. **Supabase GitHub provider** — Authentication → Providers → GitHub → paste Client ID and Client Secret → Enable

## UI

Both pages get a divider ("ou") between the existing email/password form and a full-width "Continuar com GitHub" button with the GitHub mark. No other layout changes.

## Error handling

- If OAuth is cancelled or fails, Supabase redirects to `auth-callback.html` with an `error` parameter in the URL hash — the page shows a message and links back to login
- If the `usuarios` record is missing after OAuth (trigger delay), `/v1/auth/me` returns 404; `auth-callback.html` retries once after 1s before showing an error

## Out of scope

- Google, GitLab, or other OAuth providers
- Linking GitHub to an existing email/password account
- Displaying the GitHub avatar in the dashboard

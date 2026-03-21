# Auth por Usuário & Planos com Cotas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a API Key única de ambiente por autenticação por usuário com planos (Free/Pro/Scale/Enterprise) e controle de cota mensal, adicionando signup via Supabase Auth e proteção contra abuso.

**Architecture:** Supabase Auth gerencia cadastro e verificação de email. Um trigger SQL cria o registro em `usuarios` após confirmação. O middleware de auth valida a API Key diretamente na tabela `usuarios` (query rápida). Rotas `/v1/auth/*` cuidam de signup, login e consulta de dados do usuário.

**Tech Stack:** Node.js 20+, Express 4, @supabase/supabase-js, express-rate-limit (já instalado), Jest + supertest (já instalados)

**Spec:** `docs/superpowers/specs/2026-03-20-auth-planos-design.md`

---

## Mapa de Arquivos

```
migrations/
  001_usuarios_planos.sql       CRIADO — executar manualmente no Supabase SQL Editor

src/
  data/
    blocked-domains.js          CRIADO — lista de ~200 domínios descartáveis
  middleware/
    antiAbuse.js                CRIADO — rate limit de signup + bloqueio de domínios
    auth.js                     MODIFICADO — reescrito para validar api_key na tabela usuarios
  db/
    supabase.js                 MODIFICADO — adiciona getUsuarioByApiKey(), incrementarUso(), getUsuarioByAuthId()
  routes/
    auth.js                     CRIADO — POST /v1/auth/signup, POST /v1/auth/login, GET /v1/auth/me
    diagnosticos.js             MODIFICADO — adiciona incrementarUso() via res.on('finish')
  app.js                        MODIFICADO — registra /v1/auth

tests/
  middleware/
    auth.test.js                MODIFICADO — reescrito com mock de supabase
  routes/
    auth.test.js                CRIADO — testa signup, login, me
    diagnosticos.test.js        MODIFICADO — mock de supabase para auth
```

---

## Task 1: Migration SQL no Supabase

Este task é **manual** — execute o SQL no Supabase SQL Editor do seu projeto. Não há código Node.js aqui.

**Files:**
- Create: `migrations/001_usuarios_planos.sql`

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- migrations/001_usuarios_planos.sql
-- Executar no Supabase SQL Editor: https://supabase.com/dashboard/project/<seu-projeto>/sql

-- 1. Tabela de planos
CREATE TABLE IF NOT EXISTS public.planos (
  id             text PRIMARY KEY,
  nome           text NOT NULL,
  limite_mensal  integer NOT NULL,  -- -1 = ilimitado
  preco_brl      numeric(10,2)
);

INSERT INTO public.planos (id, nome, limite_mensal, preco_brl) VALUES
  ('free',       'Free',       100,    0),
  ('pro',        'Pro',        1000,   29.00),
  ('scale',      'Scale',      10000,  99.00),
  ('enterprise', 'Enterprise', -1,     NULL)
ON CONFLICT (id) DO NOTHING;

-- 2. Tabela de usuários
CREATE TABLE IF NOT EXISTS public.usuarios (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id      uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text UNIQUE NOT NULL,
  api_key      uuid UNIQUE DEFAULT gen_random_uuid(),
  plano_id     text REFERENCES public.planos(id) DEFAULT 'free',
  uso_mensal   integer NOT NULL DEFAULT 0,
  ativo        boolean NOT NULL DEFAULT true,
  criado_em    timestamptz DEFAULT now()
);

-- 3. Função RPC para incremento atômico de uso
CREATE OR REPLACE FUNCTION public.increment_uso_mensal(p_usuario_id uuid)
RETURNS void AS $$
  UPDATE public.usuarios SET uso_mensal = uso_mensal + 1 WHERE id = p_usuario_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- 4. Trigger: cria registro em usuarios APÓS confirmação de email
CREATE OR REPLACE FUNCTION public.handle_user_confirmed()
RETURNS trigger AS $$
BEGIN
  IF OLD.confirmed_at IS NULL AND NEW.confirmed_at IS NOT NULL THEN
    INSERT INTO public.usuarios (auth_id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (auth_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_confirmed();

-- 5. pg_cron: reset mensal (00:00 UTC do dia 1° = 21:00 BRT do último dia do mês)
-- ATENÇÃO: pg_cron precisa estar habilitado no projeto Supabase (Database > Extensions > pg_cron)
SELECT cron.schedule('reset-uso-mensal', '0 0 1 * *',
  'UPDATE public.usuarios SET uso_mensal = 0');
```

- [ ] **Step 2: Executar no Supabase SQL Editor**

Abra o Supabase Dashboard → seu projeto → SQL Editor → cole o conteúdo acima → Run.

Verifique que as tabelas `planos` e `usuarios` foram criadas em Table Editor.

- [ ] **Step 3: Commit do arquivo de migration**

```bash
git add migrations/001_usuarios_planos.sql
git commit -m "chore: adicionar migration SQL para tabelas planos e usuarios"
```

---

## Task 2: Lista de Domínios Descartáveis

**Files:**
- Create: `src/data/blocked-domains.js`

Este arquivo é puro dado — sem lógica, sem dependências. Não precisa de teste dedicado (será testado indiretamente pelo antiAbuse).

- [ ] **Step 1: Criar o arquivo**

```js
// src/data/blocked-domains.js
// Domínios de email descartável/temporário conhecidos
const BLOCKED_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org",
  "guerrillamail.biz", "guerrillamail.de", "guerrillamail.info",
  "temp-mail.org", "tempmail.com", "tempmail.net", "tempmail.org",
  "throwam.com", "throwaway.email", "sharklasers.com", "guerrillamailblock.com",
  "grr.la", "spam4.me", "yopmail.com", "yopmail.fr", "yopmail.net",
  "cool.fr.nf", "jetable.fr.nf", "nospam.ze.tc", "nomail.xl.cx",
  "mega.zik.dj", "speed.1s.fr", "courriel.fr.nf", "moncourrier.fr.nf",
  "monemail.fr.nf", "monmail.fr.nf", "dispostable.com", "mailnull.com",
  "spamgourmet.com", "spamgourmet.net", "spamgourmet.org",
  "trashmail.at", "trashmail.com", "trashmail.io", "trashmail.me",
  "trashmail.net", "trashmail.org", "trashmail.xyz",
  "discard.email", "discardmail.com", "discardmail.de",
  "spamfree24.org", "spamfree24.de", "spamfree24.eu",
  "spamfree24.info", "spamfree24.net", "spamfree24.com",
  "maildrop.cc", "anonbox.net", "mailnesia.com", "mailnull.com",
  "spambox.us", "spambox.info", "spambox.me",
  "filzmail.com", "fakeinbox.com", "fakeinbox.net",
  "mailexpire.com", "mail-temporaire.fr",
  "crazymailing.com", "tempemail.net", "tempemail.com",
  "10minutemail.com", "10minutemail.net", "10minutemail.org",
  "10minutemail.co.za", "10minutemail.de", "10minutemail.eu",
  "10minutemail.info", "10minutemail.ru",
  "20minutemail.com", "20minutemail.it",
  "0-mail.com", "0815.ru", "0815.su", "0815.ry",
  "0clickemail.com", "0wnd.net", "0wnd.org",
  "1chuan.com", "1pad.de", "20mm.eu",
  "2fdgdfgdfgdf.tk", "2prong.com",
  "3d-painting.com", "4warding.com", "4warding.net", "4warding.org",
  "9ox.net", "a-bc.net", "adbet.co", "agedmail.com",
  "agger.ro", "ahk.jp", "aionda.com", "alefandmeme.com",
  "alienvisitor.com", "allrmail.com", "ama-trade.de",
  "amilegit.com", "amiri.net", "amiriindustries.com",
  "anonmail.de", "anonymbox.com", "antichef.com",
  "antichef.net", "antireg.com", "antispam.de",
  "antispammail.de", "armyspy.com", "aron.us",
  "baxomale.ht.cx", "beefmilk.com", "big1.us",
  "bigstring.com", "binkmail.com", "bio-muesli.net",
  "bobmail.info", "bodhi.lawlita.com", "bofthew.com",
  "bootybay.de", "boun.cr", "bouncr.com",
  "breakthru.com", "brefmail.com", "broadbandninja.com",
  "bsnow.net", "bugmenot.com", "bumpymail.com",
  "casualdx.com", "cek.pm", "centermail.com",
  "centermail.net", "chammy.info", "cheatmail.de",
  "chogmail.com", "choicemail1.com", "clixser.com",
  "cmail.club", "cmail.com", "cmail.net",
  "cnew.ir", "cool.fr.nf", "correo.blogos.net",
  "cosmorph.com", "courriel.fr.nf", "courrieltemporaire.com",
  "crapmail.org", "crazymailing.com", "cubiclink.com",
  "curryworld.de", "cust.in", "dacoolest.com",
  "dandikmail.com", "dayrep.com", "dcemail.com",
  "deadaddress.com", "deadletter.ga", "delikkt.de",
  "dingbone.com", "disposableaddress.com", "disposableemailaddresses.com",
  "dispostable.com", "dodgeit.com", "dodgit.com",
  "donemail.ru", "dontreg.com", "dontsendmespam.de",
  "drdrb.com", "drdrb.net", "dump-email.info",
  "dumpandforfeit.com", "dumpmail.de", "dumpyemail.com",
  "e4ward.com", "easytrashmail.com", "einmalmail.de",
  "einrot.com", "eintagsmail.de", "email60.com",
  "emaildienst.de", "emailigo.com", "emailinfive.com",
  "emailisvalid.com", "emailmiser.com", "emailsensei.com",
  "emailtemporario.com.br", "emailtemporar.ro", "emailto.de",
  "emailwarden.com", "emailx.at.hm", "emailxfer.com",
  "emkei.cz", "emkei.ga", "emkei.gq",
  "emkei.ml", "emkei.tk", "enterto.com",
  "ephemail.net", "etranquil.com", "etranquil.net",
  "etranquil.org", "evopo.com", "example.com",
  "explodemail.com", "express.net.ua", "extremail.ru",
  "eyepaste.com", "fake-email.pp.ua", "fake-mail.cf",
  "fake-mail.ga", "fake-mail.ml", "fake-mail.tk",
  "fakemailgenerator.com", "fakemailz.com",
  "fakedemail.com", "fammix.com", "fantasymail.de",
  "fightallspam.com", "filzmail.com", "fizmail.com",
  "fleckens.hu", "försterschule.de", "fr33mail.info",
  "frapmail.com", "free-email.cf", "free-email.ga",
  "freemail.ms", "freeplumbing.com", "frontflipflops.com",
  "fuckingduh.com", "fudgerub.com", "fugitiveemail.com",
  "fux0ringduh.com", "fyii.de", "garbagemail.org",
  "getonemail.com", "getonemail.net", "ghosttexter.de",
  "gishpuppy.com", "givmail.com", "gowikibooks.com",
  "gowikicampus.com", "gowikicars.com", "gowikifilms.com",
  "gowikigames.com", "gowikimusic.com", "gowikinetwork.com",
  "gowikitravel.com", "gowikitv.com", "grandmamail.com",
  "grandmasmail.com", "green2go.org", "greensloth.com",
  "grr.la", "gsrv.co.uk", "guerillamail.biz",
  "guerillamail.com", "guerillamail.de", "guerillamail.info",
  "guerillamail.net", "guerillamail.org", "guerillamail.sf",
  "h8s.org", "haltospam.com", "hmamail.com",
  "hochsitze.com", "hotpop.com", "hulapla.de",
  "ieatspam.eu", "ieatspam.info", "ieh-mail.de",
  "ihateyoualot.info", "iheartspam.org", "imails.info",
  "inbax.tk", "inbox.si", "inboxalias.com",
  "inboxclean.com", "inboxclean.org", "infocom.zp.ua",
  "internet-e-mail.de", "internet-mail.de", "internetemails.net",
  "intertrash.com", "ipoo.org", "irish2me.com",
  "iwi.net", "jetable.com", "jetable.fr.nf",
  "jetable.net", "jetable.org", "jnxjn.com",
  "jourrapide.com", "jsrsolutions.com", "junk1.tk",
  "kasmail.com", "kaspop.com", "killmail.com",
  "killmail.net", "klassmaster.com", "klassmaster.net",
  "klzlk.com", "koszmail.pl", "kurzepost.de",
  "lovemeleaveme.com", "lr78.com", "lroid.com",
  "lukop.dk", "m21.cc", "mail-filter.com",
  "mail-temporaire.fr", "mail.by", "mail2rss.org",
  "mailbidon.com", "mailbiz.biz", "mailblocks.com",
  "mailbucket.org", "mailcat.biz", "mailcatch.com",
  "mailde.de", "mailde.info", "maildu.de",
  "maileater.com", "mailed.ro", "mailegw.com",
  "mailexcite.com", "mailfreeonline.com", "mailguard.me",
  "mailhz.me", "mailimate.com", "mailin8r.com",
  "mailinater.com", "mailinator.net", "mailinator.org",
  "mailinator.us", "mailinator2.com", "mailincubator.com",
  "mailismagic.com", "mailme.ir", "mailme24.com",
  "mailmetrash.com", "mailmoat.com", "mailnew.com",
  "mailnull.com", "mailpick.biz", "mailproxsy.com",
  "mailquack.com", "mailrock.biz", "mailscrap.com",
  "mailseal.de", "mailshell.com", "mailsiphon.com",
  "mailslapping.com", "mailslite.com", "mailsponge.com",
  "mailtemp.info", "mailtome.de", "mailtothis.com",
  "mailzilla.com", "mailzilla.org", "makemetheking.com",
  "manybrain.com", "mbx.cc", "mega.zik.dj",
  "meinspamschutz.de", "meltmail.com", "messagebeamer.de",
  "mezmail.com", "mierdamail.com", "mintemail.com",
  "moburl.com", "moncourrier.fr.nf", "monemail.fr.nf",
  "monmail.fr.nf", "morriesworld.ml", "mt2009.com",
  "mt2014.com", "mx0.wwwnew.eu", "myspaceinc.com",
  "myspaceinc.net", "myspaceinc.org", "myspacepimpp.com",
  "myspamless.com", "mytrashmail.com", "mytrashmail.net",
  "mytrashmail.org", "neomailbox.com", "nepwk.com",
  "nervmich.net", "nervtmich.net", "netmails.com",
  "netmails.net", "netzidiot.de", "neverbox.com",
  "nice-4u.com", "nincsmail.hu", "no-spam.ws",
  "noblepioneer.com", "nomail.pw", "nomail.xl.cx",
  "nomail2me.com", "nomorespamemails.com", "nonspam.eu",
  "nonspammer.de", "noref.in", "nospam.ze.tc",
  "nospamfor.us", "nospammail.net", "nospamthanks.info",
  "notmailinator.com", "nowmymail.com", "nowmymail.net",
  "nubesmail.com", "nwldx.com", "objectmail.com",
  "obobbo.com", "odaymail.com", "odnorazovoe.ru",
  "one-time.email", "oneoffmail.com", "onewaymail.com",
  "onlatedotcom.info", "online.ms", "oopi.org",
  "opayq.com", "ordinaryamerican.net", "otherinbox.com",
  "ourklips.com", "outlawspam.com", "ovpn.to",
  "owlpic.com", "pancakemail.com", "paplease.com",
  "pcusers.otherinbox.com", "pepbot.com", "pfui.ru",
  "pimpedupmyspace.com", "pingir.com", "plexolan.de",
  "poczta.onet.pl", "politikerclub.de", "poofy.org",
  "pookmail.com", "privacy.net", "privatdemail.net",
  "proxymail.eu", "prtnx.com", "prtz.eu",
  "punkass.com", "putthisinyourspamdatabase.com",
  "putthisinyourspamdatabase.net", "qq.com", "quickinbox.com",
  "rcpt.at", "reallymymail.com", "recursor.net",
  "reddcoin.eu", "regbypass.com", "regbypass.comsafe-mail.net",
  "rejectmail.com", "rklips.com", "rmqkr.net",
  "royal.net", "rppkn.com", "rtrtr.com",
  "s0ny.net", "safe-mail.net", "safersignup.de",
  "safetymail.info", "safetypost.de", "sandelf.de",
  "saynotospams.com", "schrott-email.de", "secretemail.de",
  "secure-mail.biz", "selfdestructingmail.com", "SendSpamHere.com",
  "senseless-entertainment.com", "sharklasers.com", "shieldedmail.com",
  "shiftmail.com", "shitmail.de", "shitmail.me",
  "shortmail.net", "sibmail.com", "sinnlos-mail.de",
  "slapsfromlastnight.com", "slaskpost.se", "slopsbox.com",
  "smashmail.de", "smellfear.com", "snakemail.com",
  "sneakemail.com", "snkmail.com", "sofimail.com",
  "sofort-mail.de", "sogetthis.com", "soodonims.com",
  "spam.la", "spam.mn", "spam.org.tr",
  "spam.su", "spam4.me", "spamavert.com",
  "spambob.com", "spambob.net", "spambob.org",
  "spambog.com", "spambog.de", "spambog.ru",
  "spambox.info", "spambox.irishspringrealty.com", "spambox.us",
  "spamcannon.com", "spamcannon.net", "spamcero.com",
  "spamcon.org", "spamcorptastic.com", "spamcowboy.com",
  "spamcowboy.net", "spamcowboy.org", "spamday.com",
  "spamex.com", "spamfree.eu", "spamfree24.com",
  "spamgoes.in", "spamgourmet.com", "spamgourmet.net",
  "spamgourmet.org", "spamherelots.com", "spamhereplease.com",
  "spamhole.com", "spamify.com", "spaminator.de",
  "spamkill.info", "spaml.com", "spaml.de",
  "spammotel.com", "spamobox.com", "spamoff.de",
  "spamsalad.in", "spamslicer.com", "spamspot.com",
  "spamstack.net", "spamthis.co.uk", "spamthisplease.com",
  "spamtroll.net", "speed.1s.fr", "spikio.com",
  "spoofmail.de", "spamgoes.in", "stuffmail.de",
  "super-auswahl.de", "supergreatmail.com", "supermailer.jp",
  "superrito.com", "superstachel.de", "suremail.info",
  "svk.jp", "sweetxxx.de", "tafmail.com",
  "tagyourself.com", "teewars.org", "teleworm.com",
  "teleworm.us", "tempalias.com", "tempe-mail.com",
  "tempemail.biz", "tempemail.com", "tempemail.net",
  "tempemail.org", "tempinbox.co.uk", "tempinbox.com",
  "tempmail2.com", "tempmailer.com", "tempmailer.de",
  "tempomail.fr", "temporarily.de", "temporarioemail.com.br",
  "temporaryemail.net", "temporaryemail.us", "temporaryforwarding.com",
  "temporaryinbox.com", "temporarymail.org", "tempthe.net",
  "thankyou2010.com", "thecloudindex.com", "thisisnotmyrealemail.com",
  "throam.com", "throwam.com", "throwaway.email",
  "throwam.com", "tilien.com", "tittbit.in",
  "tizi.com", "tm.in-ulm.de", "tmailinator.com",
  "toiea.com", "tomtrash.com", "tradermail.info",
  "trash-amil.com", "trash-mail.at", "trash-mail.cf",
  "trash-mail.com", "trash-mail.ga", "trash-mail.gq",
  "trash-mail.io", "trash-mail.me", "trash-mail.ml",
  "trash-mail.tk", "trash2009.com", "trash2010.com",
  "trash2011.com", "trashemail.de", "trashimail.de",
  "trashinator.com", "trashmail.at", "trashmail.com",
  "trashmail.io", "trashmail.me", "trashmail.net",
  "trashmail.org", "trashmail.xyz", "trashmailer.com",
  "trashmailer.de", "trashymail.com", "trashymail.net",
  "trbvm.com", "turual.com", "twinmail.de",
  "twoweirdtricks.com", "tyldd.com", "uggsrock.com",
  "umail.net", "uroid.com", "us.af",
  "veryrealemail.com", "viditag.com", "viewcastmedia.com",
  "viewcastmedia.net", "viewcastmedia.org", "vomoto.com",
  "vubby.com", "wasteland.rfc822.org", "webemail.me",
  "weg-werf-email.de", "wegwerfadresse.de", "wegwerfemail.com",
  "wegwerfemail.de", "wegwerfemail.net", "wegwerfemail.org",
  "wegwerfmail.de", "wegwerfmail.info", "wegwerfmail.net",
  "wegwerfmail.org", "wetrainbayarea.com", "wetrainbayarea.org",
  "wh4f.org", "whyspam.me", "wilemail.com",
  "willhackforfood.biz", "willselfdestruct.com", "winemaven.info",
  "wronghead.com", "wuzupmail.net", "www.e4ward.com",
  "wwwnew.eu", "x.ip6.li", "xagloo.co",
  "xagloo.com", "xemaps.com", "xents.com",
  "xmaily.com", "xoxy.net", "xyzfree.net",
  "yapped.net", "yeah.net", "yep.it",
  "yogamaven.com", "yopmail.com", "yopmail.fr",
  "yopmail.net", "yourdomain.com", "yuurok.com",
  "z1p.biz", "za.com", "zehnminuten.de",
  "zehnminutenmail.de", "zippymail.info", "zoemail.com",
  "zoemail.net", "zoemail.org", "zomg.info",
]);

module.exports = BLOCKED_DOMAINS;
```

- [ ] **Step 2: Commit**

```bash
git add src/data/blocked-domains.js
git commit -m "feat: adicionar lista de domínios de email descartáveis"
```

---

## Task 3: Middleware antiAbuse

**Files:**
- Create: `src/middleware/antiAbuse.js`
- Create: `tests/middleware/antiAbuse.test.js`

- [ ] **Step 1: Escrever o teste com falha esperada**

```js
// tests/middleware/antiAbuse.test.js
const { validarDominio, signupLimiter } = require("../../src/middleware/antiAbuse");

// Helper: simula req/res/next do Express
function makeReqRes(email, ip = "1.2.3.4") {
  const req = { body: { email }, ip };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

describe("validarDominio", () => {
  it("chama next() para email válido", () => {
    const { req, res, next } = makeReqRes("user@gmail.com");
    validarDominio(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("retorna 400 para domínio descartável", () => {
    const { req, res, next } = makeReqRes("user@mailinator.com");
    validarDominio(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ erro: "Email não permitido" });
    expect(next).not.toHaveBeenCalled();
  });

  it("retorna 400 para email sem @", () => {
    const { req, res, next } = makeReqRes("invalido");
    validarDominio(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ erro: "Email inválido" });
    expect(next).not.toHaveBeenCalled();
  });

  it("retorna 400 se email não enviado", () => {
    const { req, res, next } = makeReqRes(undefined);
    validarDominio(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ erro: "Email inválido" });
    expect(next).not.toHaveBeenCalled();
  });

  it("retorna 400 para yopmail.com", () => {
    const { req, res, next } = makeReqRes("user@yopmail.com");
    validarDominio(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

```bash
npx jest tests/middleware/antiAbuse.test.js --no-coverage
```

Esperado: FAIL — `Cannot find module '../../src/middleware/antiAbuse'`

- [ ] **Step 3: Implementar o middleware**

```js
// src/middleware/antiAbuse.js
const rateLimit = require("express-rate-limit");
const BLOCKED_DOMAINS = require("../data/blocked-domains");

function validarDominio(req, res, next) {
  const { email } = req.body;

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ erro: "Email inválido" });
  }

  const domain = email.split("@")[1].toLowerCase();

  if (BLOCKED_DOMAINS.has(domain)) {
    return res.status(400).json({ erro: "Email não permitido" });
  }

  next();
}

const signupLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 horas
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  message: { erro: "Limite de cadastros atingido. Tente novamente em 24h." },
  skip: () => process.env.NODE_ENV === "test", // não aplica rate limit nos testes
});

module.exports = { validarDominio, signupLimiter };
```

- [ ] **Step 4: Rodar e confirmar aprovação**

```bash
npx jest tests/middleware/antiAbuse.test.js --no-coverage
```

Esperado: PASS (5 testes)

- [ ] **Step 5: Commit**

```bash
git add src/middleware/antiAbuse.js tests/middleware/antiAbuse.test.js
git commit -m "feat: adicionar middleware de anti-abuso no signup"
```

---

## Task 4: Novas funções no supabase.js

**Files:**
- Modify: `src/db/supabase.js`
- Create: `tests/db/supabase.test.js`

- [ ] **Step 1: Escrever os testes com falha esperada**

```js
// tests/db/supabase.test.js
// Mock do @supabase/supabase-js ANTES de require supabase.js
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

const mockSupabaseClient = {
  from: jest.fn(),
  auth: { getUser: jest.fn() },
  rpc: jest.fn(),
};

// Limpa mocks antes de cada teste
beforeEach(() => jest.clearAllMocks());

const { getUsuarioByApiKey, incrementarUso, getUsuarioByAuthId } =
  require("../../src/db/supabase");

describe("getUsuarioByApiKey", () => {
  it("retorna usuário com dados do plano quando key válida", async () => {
    const fakeUser = {
      id: "user-uuid",
      api_key: "key-uuid",
      plano_id: "free",
      uso_mensal: 10,
      ativo: true,
      planos: { limite_mensal: 100 },
    };

    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: fakeUser, error: null }),
          }),
        }),
      }),
    });

    const result = await getUsuarioByApiKey("key-uuid");
    expect(result).toEqual(fakeUser);
  });

  it("retorna null quando key não encontrada", async () => {
    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
          }),
        }),
      }),
    });

    const result = await getUsuarioByApiKey("key-invalida");
    expect(result).toBeNull();
  });
});

describe("incrementarUso", () => {
  it("chama rpc increment_uso_mensal com id correto", async () => {
    mockSupabaseClient.rpc.mockResolvedValue({ error: null });

    await incrementarUso("user-uuid");

    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
      "increment_uso_mensal",
      { p_usuario_id: "user-uuid" }
    );
  });
});

describe("getUsuarioByAuthId", () => {
  it("retorna usuário pelo auth_id", async () => {
    const fakeUser = {
      id: "user-uuid",
      email: "u@e.com",
      api_key: "key-uuid",
      plano_id: "free",
      uso_mensal: 5,
      planos: { limite_mensal: 100 },
    };

    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: fakeUser, error: null }),
        }),
      }),
    });

    const result = await getUsuarioByAuthId("auth-uuid");
    expect(result).toEqual(fakeUser);
  });

  it("retorna null quando auth_id não encontrado", async () => {
    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
        }),
      }),
    });

    const result = await getUsuarioByAuthId("auth-uuid-invalido");
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

```bash
npx jest tests/db/supabase.test.js --no-coverage
```

Esperado: FAIL — `getUsuarioByApiKey is not a function` (funções não existem ainda)

- [ ] **Step 3: Adicionar as funções ao supabase.js**

```js
// src/db/supabase.js
const { createClient } = require("@supabase/supabase-js");

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.warn("[DevInsight] AVISO: SUPABASE_URL ou SUPABASE_KEY não configurados — diagnósticos não serão persistidos.");
}

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_KEY || ""
);

async function saveDiagnostico({ tipo, mensagem, contexto, resposta }) {
  const { error } = await supabase
    .from("diagnosticos")
    .insert({ tipo, mensagem, contexto, resposta });

  if (error) {
    console.error("Erro ao salvar diagnóstico no Supabase:", error.message);
  }
}

async function getUsuarioByApiKey(apiKey) {
  const { data, error } = await supabase
    .from("usuarios")
    .select("*, planos(limite_mensal)")
    .eq("api_key", apiKey)
    .eq("ativo", true)
    .single();

  if (error || !data) return null;
  return data;
}

async function incrementarUso(usuarioId) {
  const { error } = await supabase.rpc("increment_uso_mensal", {
    p_usuario_id: usuarioId,
  });
  if (error) {
    console.error("Erro ao incrementar uso:", error.message);
  }
}

async function getUsuarioByAuthId(authId) {
  const { data, error } = await supabase
    .from("usuarios")
    .select("*, planos(limite_mensal)")
    .eq("auth_id", authId)
    .single();

  if (error || !data) return null;
  return data;
}

module.exports = { saveDiagnostico, getUsuarioByApiKey, incrementarUso, getUsuarioByAuthId };
```

- [ ] **Step 4: Rodar e confirmar aprovação**

```bash
npx jest tests/db/supabase.test.js --no-coverage
```

Esperado: PASS (5 testes)

- [ ] **Step 5: Commit**

```bash
git add src/db/supabase.js tests/db/supabase.test.js
git commit -m "feat: adicionar getUsuarioByApiKey, incrementarUso e getUsuarioByAuthId ao supabase client"
```

---

## Task 5: Reescrever middleware auth.js

**Files:**
- Modify: `src/middleware/auth.js`
- Modify: `tests/middleware/auth.test.js`

- [ ] **Step 1: Reescrever o teste**

```js
// tests/middleware/auth.test.js
jest.mock("../../src/db/supabase", () => ({
  getUsuarioByApiKey: jest.fn(),
  incrementarUso: jest.fn(),
  getUsuarioByAuthId: jest.fn(),
  saveDiagnostico: jest.fn(),
}));

const { getUsuarioByApiKey } = require("../../src/db/supabase");
const auth = require("../../src/middleware/auth");

function makeReqRes(apiKey) {
  const req = {
    headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

beforeEach(() => jest.clearAllMocks());

describe("auth middleware", () => {
  it("retorna 401 quando Authorization não enviado", async () => {
    const { req, res, next } = makeReqRes(null);
    await auth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ erro: "API Key obrigatória" });
    expect(next).not.toHaveBeenCalled();
  });

  it("retorna 401 quando API Key inválida", async () => {
    getUsuarioByApiKey.mockResolvedValue(null);
    const { req, res, next } = makeReqRes("key-inexistente");
    await auth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ erro: "API Key inválida" });
    expect(next).not.toHaveBeenCalled();
  });

  it("retorna 429 quando cota mensal esgotada", async () => {
    getUsuarioByApiKey.mockResolvedValue({
      id: "u1",
      plano_id: "free",
      uso_mensal: 100,
      planos: { limite_mensal: 100 },
    });
    const { req, res, next } = makeReqRes("key-valida");
    await auth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      erro: "Cota mensal esgotada. Faça upgrade do seu plano.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("chama next() para key válida dentro da cota", async () => {
    getUsuarioByApiKey.mockResolvedValue({
      id: "u1",
      plano_id: "free",
      uso_mensal: 50,
      planos: { limite_mensal: 100 },
    });
    const { req, res, next } = makeReqRes("key-valida");
    await auth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.usuario).toEqual({
      id: "u1",
      plano_id: "free",
      uso_mensal: 50,
      limite_mensal: 100,
    });
  });

  it("chama next() para plano enterprise (limite -1 = ilimitado)", async () => {
    getUsuarioByApiKey.mockResolvedValue({
      id: "u2",
      plano_id: "enterprise",
      uso_mensal: 99999,
      planos: { limite_mensal: -1 },
    });
    const { req, res, next } = makeReqRes("key-enterprise");
    await auth(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

```bash
npx jest tests/middleware/auth.test.js --no-coverage
```

Esperado: FAIL — testes esperam comportamento novo que o auth.js atual não implementa

- [ ] **Step 3: Reescrever auth.js**

```js
// src/middleware/auth.js
const { getUsuarioByApiKey } = require("../db/supabase");

async function auth(req, res, next) {
  const header = req.headers["authorization"];

  if (!header) {
    return res.status(401).json({ erro: "API Key obrigatória" });
  }

  const apiKey = header.replace("Bearer ", "").trim();
  const usuario = await getUsuarioByApiKey(apiKey);

  if (!usuario) {
    return res.status(401).json({ erro: "API Key inválida" });
  }

  const limiteMensal = usuario.planos.limite_mensal;
  if (limiteMensal !== -1 && usuario.uso_mensal >= limiteMensal) {
    return res.status(429).json({
      erro: "Cota mensal esgotada. Faça upgrade do seu plano.",
    });
  }

  req.usuario = {
    id: usuario.id,
    plano_id: usuario.plano_id,
    uso_mensal: usuario.uso_mensal,
    limite_mensal: limiteMensal,
  };

  next();
}

module.exports = auth;
```

- [ ] **Step 4: Rodar e confirmar aprovação**

```bash
npx jest tests/middleware/auth.test.js --no-coverage
```

Esperado: PASS (5 testes)

- [ ] **Step 5: Commit**

```bash
git add src/middleware/auth.js tests/middleware/auth.test.js
git commit -m "feat: reescrever auth middleware para validar api_key por usuário com controle de cota"
```

---

## Task 6: Rotas de autenticação

**Files:**
- Create: `src/routes/auth.js`
- Create: `tests/routes/auth.test.js`

- [ ] **Step 1: Instalar dependência de validação de email**

O Supabase Auth cuida da senha, mas precisamos validar formato do email localmente. Usaremos uma regex simples — sem dependência externa.

- [ ] **Step 2: Escrever os testes**

```js
// tests/routes/auth.test.js
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => mockSupabase),
}));

const mockSupabase = {
  from: jest.fn(),
  auth: {
    signUp: jest.fn(),
    signInWithPassword: jest.fn(),
    getUser: jest.fn(),
  },
  rpc: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

const request = require("supertest");
const app = require("../../src/app");

describe("POST /v1/auth/signup", () => {
  it("retorna 201 para signup válido", async () => {
    mockSupabase.auth.signUp.mockResolvedValue({ data: {}, error: null });

    const res = await request(app)
      .post("/v1/auth/signup")
      .send({ email: "user@gmail.com", senha: "senha123" });

    expect(res.status).toBe(201);
    expect(res.body.mensagem).toMatch(/verifique/i);
  });

  it("retorna 400 para email descartável", async () => {
    const res = await request(app)
      .post("/v1/auth/signup")
      .send({ email: "user@mailinator.com", senha: "senha123" });

    expect(res.status).toBe(400);
    expect(res.body.erro).toBe("Email não permitido");
  });

  it("retorna 400 para senha curta (< 6 caracteres)", async () => {
    const res = await request(app)
      .post("/v1/auth/signup")
      .send({ email: "user@gmail.com", senha: "abc" });

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/senha/i);
  });

  it("retorna 400 para email já cadastrado", async () => {
    mockSupabase.auth.signUp.mockResolvedValue({
      data: {},
      error: { message: "User already registered" },
    });

    const res = await request(app)
      .post("/v1/auth/signup")
      .send({ email: "existing@gmail.com", senha: "senha123" });

    expect(res.status).toBe(400);
    expect(res.body.erro).toBe("Email já cadastrado");
  });

  it("retorna 400 para email inválido (sem @)", async () => {
    const res = await request(app)
      .post("/v1/auth/signup")
      .send({ email: "invalido", senha: "senha123" });

    expect(res.status).toBe(400);
  });
});

describe("POST /v1/auth/login", () => {
  it("retorna 200 com token para login válido", async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "jwt-token-aqui" } },
      error: null,
    });

    const res = await request(app)
      .post("/v1/auth/login")
      .send({ email: "user@gmail.com", senha: "senha123" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBe("jwt-token-aqui");
    expect(res.body.token_type).toBe("Bearer");
  });

  it("retorna 401 para credenciais inválidas", async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: "Invalid login credentials" },
    });

    const res = await request(app)
      .post("/v1/auth/login")
      .send({ email: "user@gmail.com", senha: "errada" });

    expect(res.status).toBe(401);
    expect(res.body.erro).toBe("Email ou senha incorretos");
  });

  it("retorna 403 para email não confirmado", async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: "Email not confirmed" },
    });

    const res = await request(app)
      .post("/v1/auth/login")
      .send({ email: "user@gmail.com", senha: "senha123" });

    expect(res.status).toBe(403);
    expect(res.body.erro).toMatch(/confirme/i);
  });
});

describe("GET /v1/auth/me", () => {
  it("retorna dados do usuário com token válido", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "auth-uuid" } },
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              email: "user@gmail.com",
              api_key: "key-uuid",
              plano_id: "free",
              uso_mensal: 10,
              planos: { limite_mensal: 100 },
            },
            error: null,
          }),
        }),
      }),
    });

    const res = await request(app)
      .get("/v1/auth/me")
      .set("Authorization", "Bearer jwt-valido");

    expect(res.status).toBe(200);
    expect(res.body.email).toBe("user@gmail.com");
    expect(res.body.api_key).toBe("key-uuid");
    expect(res.body.plano).toBe("free");
    expect(res.body.uso_mensal).toBe(10);
    expect(res.body.limite_mensal).toBe(100);
  });

  it("retorna 401 sem Authorization header", async () => {
    const res = await request(app).get("/v1/auth/me");
    expect(res.status).toBe(401);
  });

  it("retorna 401 para JWT inválido", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid token" },
    });

    const res = await request(app)
      .get("/v1/auth/me")
      .set("Authorization", "Bearer jwt-invalido");

    expect(res.status).toBe(401);
  });

  it("retorna 404 quando usuário não confirmou email", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "auth-uuid" } },
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    const res = await request(app)
      .get("/v1/auth/me")
      .set("Authorization", "Bearer jwt-valido");

    expect(res.status).toBe(404);
    expect(res.body.erro).toMatch(/confirme/i);
  });
});
```

- [ ] **Step 3: Rodar e confirmar falha**

```bash
npx jest tests/routes/auth.test.js --no-coverage
```

Esperado: FAIL — rotas `/v1/auth/*` não existem ainda

- [ ] **Step 4: Criar src/routes/auth.js**

```js
// src/routes/auth.js
const express = require("express");
const router = express.Router();
const { createClient } = require("@supabase/supabase-js");
const { validarDominio, signupLimiter } = require("../middleware/antiAbuse");

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_KEY || ""
);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /v1/auth/signup
router.post("/signup", signupLimiter, validarDominio, async (req, res) => {
  const { email, senha } = req.body;

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ erro: "Email inválido" });
  }

  if (!senha || senha.length < 6) {
    return res.status(400).json({ erro: "Senha inválida. Mínimo 6 caracteres." });
  }

  const { error } = await supabase.auth.signUp({ email, password: senha });

  if (error) {
    if (error.message.includes("already registered")) {
      return res.status(400).json({ erro: "Email já cadastrado" });
    }
    return res.status(500).json({ erro: "Erro interno. Tente novamente." });
  }

  return res.status(201).json({ mensagem: "Verifique seu email para ativar a conta" });
});

// POST /v1/auth/login
router.post("/login", async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: "Email e senha obrigatórios" });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) {
    if (error.message.includes("Email not confirmed")) {
      return res.status(403).json({ erro: "Confirme seu email antes de fazer login" });
    }
    return res.status(401).json({ erro: "Email ou senha incorretos" });
  }

  return res.json({
    token: data.session.access_token,
    token_type: "Bearer",
  });
});

// GET /v1/auth/me
router.get("/me", async (req, res) => {
  const header = req.headers["authorization"];

  if (!header) {
    return res.status(401).json({ erro: "Token obrigatório" });
  }

  const token = header.replace("Bearer ", "").trim();

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ erro: "Token inválido" });
  }

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("*, planos(limite_mensal)")
    .eq("auth_id", user.id)
    .single();

  if (!usuario) {
    return res.status(404).json({
      erro: "Usuário não encontrado. Confirme seu email.",
    });
  }

  return res.json({
    email: usuario.email,
    plano: usuario.plano_id,
    uso_mensal: usuario.uso_mensal,
    limite_mensal: usuario.planos.limite_mensal,
    api_key: usuario.api_key,
  });
});

module.exports = router;
```

- [ ] **Step 5: Rodar e confirmar aprovação**

```bash
npx jest tests/routes/auth.test.js --no-coverage
```

Esperado: PASS (11 testes). Se algum teste falhar por conta do `app.js` não ter a rota registrada ainda, pule para o próximo step e volte.

- [ ] **Step 6: Commit**

```bash
git add src/routes/auth.js tests/routes/auth.test.js
git commit -m "feat: adicionar rotas POST /v1/auth/signup, POST /v1/auth/login, GET /v1/auth/me"
```

---

## Task 7: Registrar rota auth no app.js

**Files:**
- Modify: `src/app.js`

- [ ] **Step 1: Adicionar rota /v1/auth**

```js
// src/app.js
require("dotenv").config();
const express = require("express");
const rateLimit = require("express-rate-limit");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const path = require("path");

const app = express();
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas requisições. Tente novamente em 1 minuto." },
});

const swaggerDocument = YAML.load(path.join(__dirname, "../swagger.yaml"));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use("/health", require("./routes/health"));
app.use("/v1/auth", require("./routes/auth"));
app.use("/v1/diagnosticos", limiter, require("./routes/diagnosticos"));

module.exports = app;
```

- [ ] **Step 2: Rodar todos os testes de auth para confirmar integração**

```bash
npx jest tests/routes/auth.test.js --no-coverage
```

Esperado: PASS (11 testes)

- [ ] **Step 3: Commit**

```bash
git add src/app.js
git commit -m "feat: registrar rotas /v1/auth no app"
```

---

## Task 8: Incremento de uso em diagnosticos.js

**Files:**
- Modify: `src/routes/diagnosticos.js`
- Modify: `tests/routes/diagnosticos.test.js`

- [ ] **Step 1: Atualizar os testes de diagnosticos para mockar supabase**

O auth middleware agora chama `getUsuarioByApiKey`. Os testes precisam mockar o módulo supabase.

```js
// tests/routes/diagnosticos.test.js
jest.mock("../../src/db/supabase", () => ({
  saveDiagnostico: jest.fn().mockResolvedValue(undefined),
  getUsuarioByApiKey: jest.fn().mockResolvedValue({
    id: "user-test-uuid",
    plano_id: "free",
    uso_mensal: 10,
    planos: { limite_mensal: 100 },
  }),
  incrementarUso: jest.fn().mockResolvedValue(undefined),
  getUsuarioByAuthId: jest.fn(),
}));

const request = require("supertest");
const app = require("../../src/app");

const HEADERS = {
  "Content-Type": "application/json",
  Authorization: "Bearer qualquer-api-key-valida",
};

describe("POST /v1/diagnosticos", () => {
  it("retorna diagnóstico para hydration_error", async () => {
    const res = await request(app)
      .post("/v1/diagnosticos")
      .set(HEADERS)
      .send({ tipo: "hydration_error", mensagem: "Hydration failed" });

    expect(res.status).toBe(200);
    expect(res.body.problema).toBeDefined();
    expect(res.body.causa).toBeDefined();
    expect(res.body.nivel).toMatch(/baixo|médio|alto/);
    expect(res.body.categoria).toBe("frontend");
    expect(Array.isArray(res.body.sugestoes)).toBe(true);
  });

  it("retorna diagnóstico para sql_analysis", async () => {
    const res = await request(app)
      .post("/v1/diagnosticos")
      .set(HEADERS)
      .send({
        tipo: "sql_analysis",
        mensagem: "",
        dados: { query: "SELECT * FROM users", tempo_execucao: 900 },
      });

    expect(res.status).toBe(200);
    expect(res.body.categoria).toBe("sql");
  });

  it("retorna 400 sem campo tipo", async () => {
    const res = await request(app)
      .post("/v1/diagnosticos")
      .set(HEADERS)
      .send({ mensagem: "erro" });
    expect(res.status).toBe(400);
  });

  it("retorna 401 sem API Key", async () => {
    const res = await request(app)
      .post("/v1/diagnosticos")
      .send({ tipo: "hydration_error", mensagem: "x" });
    expect(res.status).toBe(401);
  });

  it("retorna 429 quando cota esgotada", async () => {
    const { getUsuarioByApiKey } = require("../../src/db/supabase");
    getUsuarioByApiKey.mockResolvedValueOnce({
      id: "user-test-uuid",
      plano_id: "free",
      uso_mensal: 100,
      planos: { limite_mensal: 100 },
    });

    const res = await request(app)
      .post("/v1/diagnosticos")
      .set(HEADERS)
      .send({ tipo: "hydration_error", mensagem: "x" });

    expect(res.status).toBe(429);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que os testes existentes passam**

```bash
npx jest tests/routes/diagnosticos.test.js --no-coverage
```

Esperado: PASS (5 testes, incluindo o novo de 429)

- [ ] **Step 3: Adicionar incrementarUso em diagnosticos.js**

```js
// src/routes/diagnosticos.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const diagnosticar = require("../engines/index");
const { saveDiagnostico, incrementarUso } = require("../db/supabase");

router.post("/", auth, validate, async (req, res) => {
  try {
    const resultado = diagnosticar(req.body);

    // Persiste de forma assíncrona — não bloqueia a resposta
    saveDiagnostico({
      tipo: req.body.tipo,
      mensagem: req.body.mensagem,
      contexto: req.body.contexto,
      resposta: resultado,
    }).catch(() => {});

    // Incrementa cota após resposta bem-sucedida
    res.on("finish", () => {
      if (res.statusCode === 200) {
        incrementarUso(req.usuario.id).catch(() => {});
      }
    });

    return res.json(resultado);
  } catch (err) {
    return res.status(500).json({ erro: "Erro interno ao processar diagnóstico" });
  }
});

module.exports = router;
```

- [ ] **Step 4: Rodar todos os testes**

```bash
npx jest --no-coverage
```

Esperado: PASS em todos os testes (engines, middleware, routes, sdk, db)

- [ ] **Step 5: Commit final**

```bash
git add src/routes/diagnosticos.js tests/routes/diagnosticos.test.js
git commit -m "feat: incrementar uso_mensal após diagnóstico bem-sucedido"
```

---

## Task 9: Verificação final

- [ ] **Step 1: Rodar toda a suite de testes**

```bash
npx jest --no-coverage
```

Esperado: PASS em todos os testes sem erros.

- [ ] **Step 2: Confirmar que o servidor sobe sem erros**

```bash
node src/server.js
```

Esperado: servidor rodando em http://localhost:3000 sem erros no console.

Testar manualmente:
```bash
# Signup (vai retornar erro do Supabase se não configurado, mas a rota deve responder)
curl -X POST http://localhost:3000/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "user@mailinator.com", "senha": "teste123"}'
# Esperado: 400 { "erro": "Email não permitido" }

# Sem API Key
curl -X POST http://localhost:3000/v1/diagnosticos \
  -H "Content-Type: application/json" \
  -d '{"tipo": "hydration_error", "mensagem": "test"}'
# Esperado: 401 { "erro": "API Key obrigatória" }
```

- [ ] **Step 3: Commit final de status**

```bash
git add .
git commit -m "feat: auth por usuário com planos e cotas — fase core completa"
```

// src/routes/billing.js
const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const authJwt = require("../middleware/authJwt");
const { updatePlanoBilling, getUsuarioByStripeCustomerId } = require("../db/supabase");

let _stripe;
function getStripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
  return _stripe;
}

const PLANOS_VALIDOS = ["pro", "scale"];

function priceIdParaPlano(plano) {
  if (plano === "pro") return process.env.STRIPE_PRICE_PRO;
  if (plano === "scale") return process.env.STRIPE_PRICE_SCALE;
  return null;
}

// POST /v1/billing/checkout
router.post("/checkout", authJwt, async (req, res) => {
  const { plano } = req.body;

  if (!PLANOS_VALIDOS.includes(plano)) {
    return res.status(400).json({ erro: "Plano inválido" });
  }

  if (req.usuario.plano_id === plano) {
    return res.status(400).json({ erro: "Você já possui este plano" });
  }

  try {
    let stripeCustomerId = req.usuario.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await getStripe().customers.create({ email: req.usuario.email });
      stripeCustomerId = customer.id;
      await updatePlanoBilling(req.usuario.id, { stripe_customer_id: stripeCustomerId });
    }

    const session = await getStripe().checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      line_items: [{ price: priceIdParaPlano(plano), quantity: 1 }],
      success_url: `${process.env.APP_BASE_URL}/dashboard/?upgrade=sucesso`,
      cancel_url: `${process.env.APP_BASE_URL}/dashboard/pricing.html`,
      metadata: { usuario_id: req.usuario.id, plano },
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error("[billing] Erro ao criar sessão Stripe:", err.message);
    return res.status(502).json({ erro: "Erro ao processar pagamento. Tente novamente." });
  }
});

// POST /v1/billing/portal
router.post("/portal", authJwt, async (req, res) => {
  if (!req.usuario.stripe_customer_id) {
    return res.status(400).json({ erro: "Nenhuma assinatura encontrada" });
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: req.usuario.stripe_customer_id,
      return_url: `${process.env.APP_BASE_URL}/dashboard/`,
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error("[billing] Erro ao abrir portal:", err.message);
    return res.status(502).json({ erro: "Erro ao abrir portal. Tente novamente." });
  }
});

// POST /v1/billing/webhook
// Body recebido como raw buffer (configurado em app.js com express.raw)
router.post("/webhook", async (req, res) => {
  // SEGURANÇA: Validar webhook secret (crítico)
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[billing] ERRO CRÍTICO: STRIPE_WEBHOOK_SECRET não configurado");
    return res.status(500).send();
  }

  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error("[billing] Assinatura webhook inválida:", err.message);
    return res.status(400).send();
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const { usuario_id, plano } = session.metadata || {};
      const stripe_customer_id = session.customer;

      if (!usuario_id || !plano) {
        console.error("[billing] checkout.session.completed: metadata ausente", session.id);
        return res.status(500).send();
      }

      // SEGURANÇA: Validar usuario_id é UUID válido (previne SQL injection/IDOR)
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(usuario_id)) {
        console.error("[billing] usuario_id inválido recebido em webhook:", usuario_id);
        return res.status(400).send();
      }

      // SEGURANÇA: Validar plano é um dos permitidos
      if (!PLANOS_VALIDOS.includes(plano)) {
        console.error("[billing] plano inválido recebido em webhook:", plano);
        return res.status(400).send();
      }

      await updatePlanoBilling(usuario_id, { plano_id: plano, stripe_customer_id });
    }

    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object;
      if (subscription.cancel_at) {
        const usuario = await getUsuarioByStripeCustomerId(subscription.customer);
        if (usuario) {
          await updatePlanoBilling(usuario.id, { plano_id: "free" });
        } else {
          console.warn("[billing] subscription.updated: usuário não encontrado para customer", subscription.customer);
        }
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const usuario = await getUsuarioByStripeCustomerId(subscription.customer);

      if (!usuario) {
        console.warn("[billing] subscription.deleted: usuário não encontrado para customer", subscription.customer);
        return res.status(200).send();
      }

      await updatePlanoBilling(usuario.id, { plano_id: "free" });
    }

    if (event.type === "invoice.payment_failed") {
      // Stripe retentará automaticamente e eventualmente dispara customer.subscription.deleted
      console.warn("[billing] Falha de pagamento para customer:", event.data.object.customer);
    }

    return res.status(200).send();
  } catch (err) {
    console.error("[billing] Erro ao processar webhook:", err.message);
    return res.status(500).send();
  }
});

module.exports = router;

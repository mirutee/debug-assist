// src/routes/billing.js
const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const authJwt = require("../middleware/authJwt");
const { updatePlanoBilling, getUsuarioByStripeCustomerId } = require("../db/supabase");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

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
      const customer = await stripe.customers.create({ email: req.usuario.email });
      stripeCustomerId = customer.id;
      await updatePlanoBilling(req.usuario.id, { stripe_customer_id: stripeCustomerId });
    }

    const session = await stripe.checkout.sessions.create({
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

// POST /v1/billing/webhook
// Body recebido como raw buffer (configurado em app.js com express.raw)
router.post("/webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ""
    );
  } catch (err) {
    console.error("[billing] Assinatura webhook inválida:", err.message);
    return res.status(400).send();
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const { usuario_id, plano } = session.metadata;
      const stripe_customer_id = session.customer;

      await updatePlanoBilling(usuario_id, { plano_id: plano, stripe_customer_id });
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

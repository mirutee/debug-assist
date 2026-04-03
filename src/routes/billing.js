// src/routes/billing.js
const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const authJwt = require("../middleware/authJwt");
const { updatePlanoBilling, getUsuarioByStripeCustomerId } = require("../db/supabase");
const { sanitizeLog } = require("../utils/sanitizeLog");

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
    console.error("[billing] Erro ao criar sessão Stripe:", sanitizeLog(err.message));
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
    // ────────────────────────────────────────────────
    // COMPRA: checkout concluído
    // ────────────────────────────────────────────────
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const { usuario_id, plano } = session.metadata || {};
      const stripe_customer_id = session.customer;

      if (!usuario_id || !plano) {
        console.error("[billing] checkout.session.completed: metadata ausente", session.id);
        return res.status(400).send();
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

      // SEGURANÇA [ALTO]: Verificar que o pagamento foi efetivamente concluído.
      // checkout.session.completed pode disparar em trials ou pagamentos pendentes.
      if (session.payment_status !== "paid") {
        console.warn(
          "[billing] checkout.session.completed ignorado: payment_status=%s session=%s",
          session.payment_status,
          session.id
        );
        return res.status(200).send();
      }

      // SEGURANÇA [CRÍTICO]: Cruzar o plano do metadata com o price_id real da Stripe.
      // Busca a sessão com line_items expandidos diretamente na API da Stripe —
      // nenhuma informação do cliente ou do caminho é confiada.
      const sessionExpandida = await getStripe().checkout.sessions.retrieve(session.id, {
        expand: ["line_items"],
      });

      const priceIdReal = sessionExpandida.line_items?.data?.[0]?.price?.id;
      const priceIdEsperado = priceIdParaPlano(plano);

      if (!priceIdReal || !priceIdEsperado || priceIdReal !== priceIdEsperado) {
        console.error(
          "[billing] ALERTA SEGURANÇA: price_id real (%s) não bate com plano no metadata (%s) session=%s",
          priceIdReal,
          plano,
          session.id
        );
        return res.status(400).send();
      }

      await updatePlanoBilling(usuario_id, { plano_id: plano, stripe_customer_id });
    }

    // ────────────────────────────────────────────────
    // ASSINATURA ATUALIZADA
    // ────────────────────────────────────────────────
    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object;

      // SEGURANÇA [CRÍTICO]: cancel_at indica data futura de cancelamento agendado,
      // NÃO que o cancelamento já ocorreu. Downgrade imediato aqui é errado —
      // o usuário perderia acesso a um período já pago.
      // O downgrade real ocorre em customer.subscription.deleted (abaixo).

      // SEGURANÇA [MÉDIO]: Pagamento falhado/inadimplente — restringir acesso.
      // past_due: fatura em atraso (Stripe ainda vai tentar novamente)
      // unpaid: Stripe esgotou retentativas — acesso deve ser suspenso imediatamente
      if (subscription.status === "unpaid" || subscription.status === "past_due") {
        const usuario = await getUsuarioByStripeCustomerId(subscription.customer);
        if (usuario) {
          await updatePlanoBilling(usuario.id, { plano_id: "free" });
          console.warn(
            "[billing] Plano revertido para free por status=%s customer=%s",
            subscription.status,
            subscription.customer
          );
        } else {
          console.warn(
            "[billing] subscription.updated (%s): usuário não encontrado para customer=%s",
            subscription.status,
            subscription.customer
          );
        }
      }
    }

    // ────────────────────────────────────────────────
    // ASSINATURA CANCELADA (fim do período pago)
    // ────────────────────────────────────────────────
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const usuario = await getUsuarioByStripeCustomerId(subscription.customer);

      if (!usuario) {
        console.warn("[billing] subscription.deleted: usuário não encontrado para customer", subscription.customer);
        return res.status(200).send();
      }

      await updatePlanoBilling(usuario.id, { plano_id: "free" });
    }

    // ────────────────────────────────────────────────
    // PAGAMENTO FALHADO (Stripe vai retentar → eventual subscription.deleted)
    // ────────────────────────────────────────────────
    if (event.type === "invoice.payment_failed") {
      console.warn("[billing] Falha de pagamento para customer:", event.data.object.customer);
    }

    // ────────────────────────────────────────────────
    // ESTORNO / CHARGEBACK — revogar acesso imediatamente
    // ────────────────────────────────────────────────
    if (event.type === "charge.refunded") {
      const charge = event.data.object;
      const usuario = await getUsuarioByStripeCustomerId(charge.customer);
      if (usuario) {
        await updatePlanoBilling(usuario.id, { plano_id: "free" });
        console.warn("[billing] Plano revertido para free após reembolso. customer=%s charge=%s", charge.customer, charge.id);
      } else {
        console.warn("[billing] charge.refunded: usuário não encontrado para customer=%s", charge.customer);
      }
    }

    if (event.type === "charge.dispute.created") {
      const dispute = event.data.object;
      const usuario = await getUsuarioByStripeCustomerId(dispute.charge);
      if (usuario) {
        await updatePlanoBilling(usuario.id, { plano_id: "free" });
        console.warn(
          "[billing] ALERTA: Chargeback aberto. Plano revertido para free. charge=%s dispute=%s",
          dispute.charge,
          dispute.id
        );
      } else {
        // dispute.charge é o charge_id, não customer_id — buscar via charge
        const charge = await getStripe().charges.retrieve(dispute.charge);
        const usuarioViaCharge = charge?.customer
          ? await getUsuarioByStripeCustomerId(charge.customer)
          : null;
        if (usuarioViaCharge) {
          await updatePlanoBilling(usuarioViaCharge.id, { plano_id: "free" });
          console.warn(
            "[billing] ALERTA: Chargeback aberto. Plano revertido para free via charge lookup. customer=%s dispute=%s",
            charge.customer,
            dispute.id
          );
        } else {
          console.warn("[billing] charge.dispute.created: usuário não encontrado para charge=%s", dispute.charge);
        }
      }
    }

    return res.status(200).send();
  } catch (err) {
    console.error("[billing] Erro ao processar webhook:", sanitizeLog(err.message));
    return res.status(500).send();
  }
});

module.exports = router;

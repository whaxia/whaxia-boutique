// Reçoit la confirmation de paiement de Stripe (pas du navigateur du client,
// donc impossible à falsifier), puis :
// 1. enregistre la commande dans Supabase
// 2. décrémente le stock des pièces uniques vendues

const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function notifyCustomer(session, items) {
  if (!process.env.RESEND_API_KEY) return;
  const email = session.customer_details?.email;
  if (!email) return;

  const itemsHtml = items
    .map((i) => `<li>${i.nom || i.id} — quantité : ${i.qty}</li>`)
    .join("");
  const total = ((session.amount_total || 0) / 100).toFixed(2).replace(".", ",");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Whax.ia Boutique <onboarding@resend.dev>",
        to: email,
        subject: "Confirmation de votre commande — Whax.ia",
        html: `
          <h2>Merci pour votre commande !</h2>
          <p>Votre paiement de <strong>${total} €</strong> a bien été confirmé.</p>
          <p><strong>Récapitulatif :</strong></p>
          <ul>${itemsHtml}</ul>
          <p>Votre création va être préparée avec soin. Vous serez prévenu(e) dès l'expédition.</p>
          <p>Merci de votre confiance,<br>Whax.ia</p>
        `,
      }),
    });
    const responseBody = await res.text();
    if (!res.ok) {
      console.error(`Resend a refusé l'email client (statut ${res.status}):`, responseBody);
    } else {
      console.log("Email client envoyé avec succès:", responseBody);
    }
  } catch (err) {
    console.error("Erreur réseau envoi email client:", err);
  }
}

async function notifySeller(session, items) {
  if (!process.env.RESEND_API_KEY || !process.env.SELLER_EMAIL) return;

  const itemsHtml = items
    .map((i) => `<li>${i.nom || i.id} — quantité : ${i.qty}</li>`)
    .join("");

  const total = ((session.amount_total || 0) / 100).toFixed(2).replace(".", ",");
  const client = session.customer_details || {};
  const addr = client.address || {};

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Whax.ia Boutique <onboarding@resend.dev>",
        to: process.env.SELLER_EMAIL,
        subject: `Nouvelle commande — ${total} €`,
        html: `
          <h2>Nouvelle commande reçue</h2>
          <p><strong>Total :</strong> ${total} €</p>
          <p><strong>Client :</strong> ${client.name || "?"} — ${client.email || "?"} — ${client.phone || "sans téléphone"}</p>
          <p><strong>Adresse :</strong> ${addr.line1 || ""} ${addr.line2 || ""}, ${addr.postal_code || ""} ${addr.city || ""}, ${addr.country || ""}</p>
          <p><strong>Articles :</strong></p>
          <ul>${itemsHtml}</ul>
          <p>Retrouvez le détail complet dans Supabase &gt; commandes_boutique.</p>
        `,
      }),
    });
    const responseBody = await res.text();
    if (!res.ok) {
      console.error(`Resend a refusé l'email vendeur (statut ${res.status}):`, responseBody);
    } else {
      console.log("Email vendeur envoyé avec succès:", responseBody);
    }
  } catch (err) {
    console.error("Erreur réseau envoi email vendeur:", err);
  }
}

exports.handler = async (event) => {
  const sig = event.headers["stripe-signature"];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Signature webhook invalide:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === "checkout.session.completed") {
    const session = stripeEvent.data.object;

    try {
      const items = JSON.parse(session.metadata?.items || "[]");
      const shipping = session.customer_details?.address || session.shipping_details?.address || {};
      const nomClient = session.customer_details?.name || session.shipping_details?.name || null;

      await supabaseAdmin.from("commandes_boutique").upsert(
        {
          stripe_session_id: session.id,
          email_client: session.customer_details?.email || null,
          nom_client: nomClient,
          telephone: session.customer_details?.phone || null,
          adresse: [shipping.line1, shipping.line2].filter(Boolean).join(", ") || null,
          ville: shipping.city || null,
          code_postal: shipping.postal_code || null,
          pays: shipping.country || null,
          items,
          total: (session.amount_total || 0) / 100,
          statut: "payee",
        },
        { onConflict: "stripe_session_id" }
      );

      for (const item of items) {
        await supabaseAdmin.rpc("decrement_stock_atomic", {
          p_id: item.id,
          p_qty: item.qty,
        });
      }

      await notifySeller(session, items);
      await notifyCustomer(session, items);
    } catch (err) {
      console.error("Erreur traitement commande:", err);
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};

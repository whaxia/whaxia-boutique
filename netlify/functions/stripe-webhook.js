// Reçoit la confirmation de paiement de Stripe (pas du navigateur du client,
// donc impossible à falsifier), puis :
// 1. enregistre la commande dans Supabase
// 2. décrémente le stock des pièces uniques vendues

const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Ici on utilise la clé "service_role" (secrète, jamais exposée au navigateur)
// car on doit pouvoir écrire dans les tables malgré les policies RLS.
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

      // Enregistre la commande (ignore si déjà enregistrée, ex: retry Stripe)
      await supabaseAdmin.from("commandes_boutique").upsert(
        {
          stripe_session_id: session.id,
          email_client: session.customer_details?.email || null,
          items,
          total: (session.amount_total || 0) / 100,
          statut: "payee",
        },
        { onConflict: "stripe_session_id" }
      );

      // Décrémente le stock des pièces uniques
      for (const item of items) {
        const { data: produit } = await supabaseAdmin
          .from("produits_boutique")
          .select("id, type, stock")
          .eq("id", item.id)
          .single();

        if (produit && produit.type === "unique" && produit.stock !== null) {
          const nouveauStock = Math.max(0, produit.stock - item.qty);
          await supabaseAdmin
            .from("produits_boutique")
            .update({
              stock: nouveauStock,
              disponible: nouveauStock > 0,
            })
            .eq("id", item.id);
        }
      }
    } catch (err) {
      console.error("Erreur traitement commande:", err);
      // On retourne quand même 200 pour éviter que Stripe ne réessaie indéfiniment
      // une commande déjà partiellement traitée ; l'erreur est loguée pour suivi manuel.
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};

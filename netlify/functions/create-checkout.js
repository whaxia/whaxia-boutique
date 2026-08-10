// Crée une session Stripe Checkout à partir du panier envoyé par le site.
// Les prix sont revérifiés ici depuis Supabase pour éviter qu'un client
// ne puisse modifier les prix côté navigateur.

const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_PUBLISHABLE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { items } = JSON.parse(event.body || "{}");
    if (!Array.isArray(items) || !items.length) {
      return { statusCode: 400, body: JSON.stringify({ error: "Panier vide." }) };
    }

    const ids = items.map((i) => i.id);
    const { data: produits, error } = await supabase
      .from("produits_boutique")
      .select("*")
      .in("id", ids)
      .eq("disponible", true);

    if (error) throw error;

    // On vérifie que chaque article demandé existe bien et a du stock si c'est une pièce unique
    const line_items = [];
    for (const item of items) {
      const p = produits.find((x) => x.id === item.id);
      if (!p) continue;
      const qty = Math.max(1, Math.min(10, parseInt(item.qty) || 1));

      if (p.type === "unique" && p.stock !== null && p.stock < qty) {
        return {
          statusCode: 409,
          body: JSON.stringify({ error: `"${p.nom}" n'est plus disponible.` }),
        };
      }

      line_items.push({
        price_data: {
          currency: "eur",
          product_data: { name: p.nom },
          unit_amount: Math.round(p.prix * 100),
        },
        quantity: qty,
      });
    }

    if (!line_items.length) {
      return { statusCode: 400, body: JSON.stringify({ error: "Aucun article valide." }) };
    }

    const origin = event.headers.origin || `https://${event.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/index.html#boutique`,
      shipping_address_collection: { allowed_countries: ["FR"] },
      phone_number_collection: { enabled: true },
      metadata: {
        items: JSON.stringify(items.map((i) => ({ id: i.id, qty: i.qty }))),
      },
    });

    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: "Erreur serveur." }) };
  }
};

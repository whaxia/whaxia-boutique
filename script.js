// ============================================
// Whax.ia Boutique — logique produits + panier + checkout
// ============================================

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

let products = [];
let cart = JSON.parse(localStorage.getItem("whaxCart") || "[]");
const euro = n => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

// --- Chargement des produits depuis Supabase ---
async function loadProducts() {
  const grid = document.querySelector("#products");
  grid.innerHTML = `<p style="color:#888">Chargement des créations...</p>`;

  const { data, error } = await supabaseClient
    .from("produits_boutique")
    .select("*")
    .eq("disponible", true)
    .order("created_at", { ascending: false });

  if (error) {
    grid.innerHTML = `<p style="color:#e08a8a">Impossible de charger la boutique pour le moment. Réessayez dans un instant.</p>`;
    console.error(error);
    return;
  }

  products = data || [];
  renderCategoryFilters();
  renderProducts();
  renderCart();
}

const CATEGORY_LABELS = {
  animaux: "Animaux",
  personnages: "Personnages",
  portraits: "Portraits",
  objets: "Objets",
  nature: "Nature",
  detourne: "Détourné",
};

function renderCategoryFilters() {
  const container = document.querySelector(".filters");
  if (!container) return;

  const categories = [...new Set(products.map(p => p.categorie))].sort();

  const buttons = ['<button class="filter active" data-filter="all">Tout</button>']
    .concat(categories.map(cat => {
      const label = CATEGORY_LABELS[cat] || cat;
      return `<button class="filter" data-filter="${cat}">${label}</button>`;
    }));

  container.innerHTML = buttons.join("");

  container.querySelectorAll(".filter").forEach(b => {
    b.onclick = () => {
      container.querySelectorAll(".filter").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      renderProducts(b.dataset.filter);
    };
  });
}

function renderProducts(filter = "all") {
  const list = filter === "all" ? products : products.filter(p => p.categorie === filter);
  const grid = document.querySelector("#products");

  if (!list.length) {
    grid.innerHTML = `<p style="color:#888">Aucune création disponible dans cette catégorie pour le moment.</p>`;
    return;
  }

  grid.innerHTML = list.map(p => {
    const img = p.photo_url
      ? `<img src="${p.photo_url}" alt="${p.nom}" loading="lazy">`
      : `PHOTO DE LA CRÉATION`;
    const stockInfo = p.type === "unique"
      ? `<small class="stock-info">Pièce unique</small>`
      : (p.delai_fabrication ? `<small class="stock-info">${p.delai_fabrication}</small>` : "");
    const epuise = p.type === "unique" && p.stock !== null && p.stock <= 0;

    return `
    <article class="product">
      <div class="product-img">${img}</div>
      <div class="product-info">
        <h3>${p.nom}</h3>
        <p>${p.description || ""}</p>
        ${stockInfo}
        <span class="price">${euro(p.prix)}</span>
        ${epuise
          ? `<button class="add" disabled>Vendu</button>`
          : `<button class="add" onclick="addToCart('${p.id}')">Ajouter</button>`}
      </div>
    </article>`;
  }).join("");
}

// --- Panier ---
function addToCart(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;
  const existing = cart.find(x => x.id === id);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ id, qty: 1 });
  }
  saveCart();
  openCart();
}

function removeFromCart(id) {
  cart = cart.filter(x => x.id !== id);
  saveCart();
}

function saveCart() {
  localStorage.setItem("whaxCart", JSON.stringify(cart));
  renderCart();
}

function renderCart() {
  const validCart = cart.filter(x => products.find(p => p.id === x.id));
  document.querySelector("#cartCount").textContent = validCart.reduce((s, x) => s + x.qty, 0);

  document.querySelector("#cartItems").innerHTML = validCart.length
    ? validCart.map(x => {
        const p = products.find(y => y.id === x.id);
        return `<div class="cart-item">
          <span>${p.nom}<br><small>${x.qty} × ${euro(p.prix)}</small></span>
          <button class="remove" onclick="removeFromCart('${p.id}')">Supprimer</button>
        </div>`;
      }).join("")
    : "<p style='color:#888'>Votre panier est vide.</p>";

  const total = validCart.reduce((s, x) => {
    const p = products.find(y => y.id === x.id);
    return s + x.qty * p.prix;
  }, 0);
  document.querySelector("#cartTotal").textContent = euro(total);
}

function openCart() {
  document.querySelector("#cart").classList.add("open");
  document.querySelector("#overlay").classList.add("show");
}
function closeCart() {
  document.querySelector("#cart").classList.remove("open");
  document.querySelector("#overlay").classList.remove("show");
}

// --- Checkout Stripe ---
async function checkout() {
  const validCart = cart.filter(x => products.find(p => p.id === x.id));
  if (!validCart.length) return;

  const btn = document.querySelector("#checkout");
  btn.disabled = true;
  btn.textContent = "Redirection vers le paiement...";

  try {
    const items = validCart.map(x => {
      const p = products.find(y => y.id === x.id);
      return { id: p.id, nom: p.nom, prix: p.prix, qty: x.qty };
    });

    const res = await fetch("/.netlify/functions/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });

    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      throw new Error(data.error || "Erreur inconnue");
    }
  } catch (err) {
    console.error(err);
    alert("Le paiement n'a pas pu démarrer. Réessayez dans un instant ou contactez-moi directement.");
    btn.disabled = false;
    btn.textContent = "Passer commande";
  }
}

// --- Init ---
document.querySelector("#cartBtn").onclick = openCart;
document.querySelector("#closeCart").onclick = closeCart;
document.querySelector("#overlay").onclick = closeCart;
document.querySelector("#checkout").onclick = checkout;

loadProducts();
renderCart();

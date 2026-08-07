# Mise en ligne de la boutique Whax.ia — Guide pas à pas

Le site et le code sont prêts. Il reste 4 étapes à faire toi-même (des comptes/clés
que je n'ai pas accès) — compte environ 30-40 min au total.

---

## Étape 1 — Créer les tables dans Supabase

1. Va sur ton dashboard Supabase > projet **whax-laserpro** > **SQL Editor** (menu de gauche)
2. Clique sur **New query**
3. Ouvre le fichier `sql/schema.sql` (dans ce dossier), copie tout son contenu, colle-le dans l'éditeur
4. Clique sur **Run**

Ça crée deux tables (`produits_boutique` et `commandes_boutique`) et ajoute 3 produits
d'exemple pour tester. Tu pourras ensuite gérer tes produits directement depuis
**Table Editor** dans Supabase (ajouter une ligne = ajouter un produit).

---

## Étape 2 — Créer un compte GitHub (si tu n'en as pas) et y déposer le code

Les fonctions de paiement (`netlify/functions`) ont besoin d'installer des
dépendances (Stripe, Supabase) au moment du déploiement. Le glisser-déposer classique
que tu utilises ne le fait pas — il faut passer par un dépôt Git connecté à Netlify.
C'est un one-time setup, après ça tout est automatique.

1. Crée un compte sur [github.com](https://github.com) si besoin
2. Crée un nouveau dépôt (bouton vert "New"), nomme-le `whaxia-boutique`, laisse-le privé ou public
3. Sur la page du dépôt vide, utilise le bouton **"uploading an existing file"** et glisse-y
   tout le contenu de ce dossier (sauf le zip lui-même)

---

## Étape 3 — Connecter le dépôt à Netlify

1. Sur [app.netlify.com](https://app.netlify.com), clique **Add new site > Import an existing project**
2. Choisis GitHub, autorise l'accès, sélectionne `whaxia-boutique`
3. Les réglages de build sont déjà dans `netlify.toml`, laisse tout par défaut
4. Avant de cliquer "Deploy", va dans **Site settings > Environment variables** et ajoute :

| Nom de la variable | Valeur | Où la trouver |
|---|---|---|
| `SUPABASE_URL` | `https://paeindvacspppfwoaiif.supabase.co` | déjà connu |
| `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` | Supabase > Settings > API Keys |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_...` (la clé secrète !) | Supabase > Settings > API Keys > Secret keys |
| `STRIPE_SECRET_KEY` | `sk_live_...` ou `sk_test_...` | Stripe > Developers > API keys |
| `STRIPE_WEBHOOK_SECRET` | (voir étape 4) | rempli après l'étape 4 |

5. Clique **Deploy**

---

## Étape 4 — Connecter le webhook Stripe (pour la mise à jour automatique du stock)

Une fois le site déployé (tu auras une URL du type `whaxia-boutique.netlify.app`) :

1. Va sur [dashboard.stripe.com](https://dashboard.stripe.com) > **Developers > Webhooks**
2. Clique **Add endpoint**
3. URL du endpoint : `https://TON-SITE.netlify.app/.netlify/functions/stripe-webhook`
4. Événement à écouter : `checkout.session.completed`
5. Une fois créé, Stripe te montre un **Signing secret** (`whsec_...`) — copie-le
6. Retourne dans Netlify > Environment variables, colle-le dans `STRIPE_WEBHOOK_SECRET`
7. Redéploie le site (Netlify > Deploys > Trigger deploy)

---

## Ensuite, au quotidien

- **Ajouter/retirer un produit** : Supabase > Table Editor > `produits_boutique`
- **Marquer une pièce unique comme vendue manuellement** : mets `disponible` à `false`
- **Voir les commandes reçues** : Supabase > Table Editor > `commandes_boutique`
- **Photos des produits** : héberge-les où tu veux (ex: Supabase Storage, ou un lien
  direct) et colle l'URL dans le champ `photo_url` du produit

---

Une fois tout ça fait, dis-le moi — je peux t'aider à vérifier que tout fonctionne
correctement avant que tu partages le lien à tes premiers clients.

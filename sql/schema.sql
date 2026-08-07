-- ============================================
-- Whax.ia Boutique — Schéma Supabase
-- À exécuter dans Supabase > SQL Editor > New query
-- ============================================

-- Table des produits
create table if not exists produits_boutique (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  description text default '',
  prix numeric(10,2) not null,
  categorie text not null default 'deco', -- 'deco' | 'boite' | 'personnalise'
  type text not null default 'reproductible', -- 'unique' | 'reproductible'
  stock integer, -- null = illimité (utile pour type 'reproductible'), 0 = épuisé
  disponible boolean not null default true,
  photo_url text,
  delai_fabrication text, -- ex: "Prêt sous 3-5 jours" (affiché si reproductible)
  created_at timestamptz not null default now()
);

-- Table des commandes (rempli automatiquement après paiement Stripe réussi)
create table if not exists commandes_boutique (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text unique not null,
  email_client text,
  items jsonb not null, -- [{id, nom, qty, prix}]
  total numeric(10,2) not null,
  statut text not null default 'payee', -- 'payee' | 'annulee'
  created_at timestamptz not null default now()
);

-- Active la sécurité au niveau des lignes (RLS)
alter table produits_boutique enable row level security;
alter table commandes_boutique enable row level security;

-- Le site public peut voir uniquement les produits disponibles
create policy "Lecture publique des produits disponibles"
  on produits_boutique for select
  using (disponible = true);

-- Toi seul (via le dashboard Supabase, authentifié) peux modifier les produits.
-- Aucune policy insert/update/delete pour le public = seul le dashboard (service role) peut écrire.

-- Personne ne peut lire/écrire les commandes depuis le site public.
-- Seule la fonction Netlify (avec la clé service_role, jamais exposée au navigateur) peut y écrire.

-- Quelques produits d'exemple pour démarrer (modifiable/supprimable ensuite)
insert into produits_boutique (nom, description, prix, categorie, type, stock, delai_fabrication) values
('Boîte gravée', 'Boîte décorative réalisée et gravée au laser.', 35, 'boite', 'reproductible', null, 'Prêt sous 3-5 jours'),
('Décoration murale', 'Création en bois découpée et gravée.', 25, 'deco', 'unique', 1, null),
('Création personnalisée', 'Une pièce réalisée selon votre texte ou votre idée.', 30, 'personnalise', 'reproductible', null, 'Prêt sous 5-7 jours');

# Mr Horeca & Mr Electro — site e-commerce

Site B2B + B2C pour la distribution de matériel HoReCa professionnel et d'électroménager grand public.
Stack Next.js 14 + Prisma + Postgres + Mollie.

## Périmètre V1 (livré)
- Landing avec deux entrées (HoReCa pro / Electro grand public)
- Catalogue navigable par catégorie (`/horeca`, `/electro`, `/c/[slug]`)
- Fiches produits (`/p/[slug]`) avec images, prix TTC/HTVA, stock, caractéristiques
- Panier cookie (sans login requis)
- Checkout invité avec coordonnées + adresse + option pro (TVA intracom)
- Paiement Mollie (Bancontact, carte, iDEAL, virement) en mode test
- Page de succès + webhook qui marque la commande payée et décrémente le stock
- Formulaire de contact
- Footer avec mentions, CGV (à compléter)

## À faire ensuite (V2)
- **Import produits** depuis flux fournisseur (collin-lucy ou autre) en CSV/JSON avec mapping
  catégories + application de la marge (`priceHT = costHT × (1 + marge%)`)
- Comptes clients (commande historique, panier persistant, factures PDF)
- Admin produits/commandes (option : réutiliser le SaaS HoReCa AI interne)
- Emails transactionnels (confirmation commande, expédition) via Resend ou SMTP
- Frais de livraison réels par zone et poids
- SEO : sitemap, robots, JSON-LD Product/Offer, Open Graph par produit
- Multilingue FR/NL via next-intl
- CGV, mentions légales, politique de confidentialité (rédaction juridique)

## Installation

### Pré-requis
- Node 20+
- PostgreSQL 14+ (sur `localhost:5432`)
- Une clé API Mollie test (gratuite : https://my.mollie.com)

### Pas à pas
```bash
# 1. Créer la DB
sudo -u postgres psql -c "CREATE DATABASE mr_horeca_electro OWNER horeca;"

# 2. Configurer
cp .env.example .env
# Éditer .env : ajouter MOLLIE_API_KEY (test_...)

# 3. Installer + migrer + seeder
npm install --legacy-peer-deps
npm run prisma:push
npm run db:seed

# 4. Lancer
npm run dev   # http://localhost:3001
```

## Flux paiement

```
[/cart] → [/checkout] formulaire
   ↓
POST /api/checkout
  ├─ crée Order (status PENDING, snapshot adresse + items)
  ├─ mollie.payments.create → URL de paiement
  ├─ enregistre molliePaymentId
  └─ redirige vers checkoutUrl Mollie
       ↓ (client paie sur Mollie)
       ↓
[Webhook Mollie] POST /api/checkout/webhook
  ├─ récupère le payment via Mollie API (re-fetch pour sécurité)
  ├─ si payé → Order.status = PAID, paidAt, decrement stock
  └─ si annulé/expiré → Order.status = CANCELLED
       ↓
[Client redirigé] /checkout/success?order=CMD-...
```

## Pipeline import produits (à brancher en V2)

Schéma déjà prêt : `Product.externalId`, `Product.supplier`, `Product.supplierSku`, `Product.costHT`.

Plan d'import :
1. Lire le CSV/JSON fournisseur (collin-lucy ou autre).
2. Mapper SKU fournisseur → SKU interne via `supplier + supplierSku`.
3. Upsert par `externalId` :
   - `costHT` = prix d'achat fournisseur
   - `priceHT` = `costHT × (1 + marge_categorie%)`
4. Marquer comme inactif les produits absents du flux (pas de suppression).
5. Logger toutes les variations de prix pour audit.

Script à créer : `scripts/import-supplier.ts`. Tournera en cron quotidien.

## Architecture

```
src/
├── app/
│   ├── page.tsx              # Landing
│   ├── horeca/               # Hub HoReCa
│   ├── electro/              # Hub Electro
│   ├── c/[slug]/             # Page catégorie
│   ├── p/[slug]/             # Fiche produit
│   ├── cart/                 # Panier
│   ├── checkout/             # Checkout + success
│   ├── contact/
│   └── api/
│       ├── cart/             # GET/POST/PATCH cookie cart
│       ├── checkout/         # POST → Mollie + webhook
│       └── contact/
├── components/
│   ├── Header.tsx            # Logo + nav + cart icon
│   ├── Footer.tsx
│   ├── ProductCard.tsx
│   ├── AddToCartButton.tsx
│   ├── CartQtyControl.tsx
│   ├── CheckoutForm.tsx
│   ├── ContactForm.tsx
│   └── ui/                   # primitives shadcn
├── lib/
│   ├── db.ts                 # Prisma singleton
│   ├── cart.ts               # cookie cart (zod-validé)
│   ├── mollie.ts             # client Mollie
│   ├── email.ts              # nodemailer
│   └── utils.ts
├── server/
│   └── cart.service.ts       # hydrate cart with product details
prisma/
├── schema.prisma
└── seed.ts                   # 15 produits démo + catégories + marques
```

## Modèle économique reseller

Le schéma supporte un fonctionnement en revente avec marge variable :
- `Product.costHT` = prix d'achat fournisseur (par ex. collin-lucy.be)
- `Product.priceHT` = prix de vente public (votre marge appliquée)
- `Product.supplier` + `supplierSku` permet de réimporter automatiquement
- L'admin peut éditer la marge par produit ou par catégorie

Aucun produit copié — vous importez les caractéristiques techniques (libres de droits)
mais utilisez vos propres photos, descriptions marketing et prix.

# Mr Horeca — site e-commerce B2B

Site e-commerce de distribution de matériel HoReCa professionnel (Belgique).
Stack Next.js 14 + Prisma + Postgres + Mollie.

## Périmètre V1 (livré)
- Landing avec hero, indicateurs de confiance, grille des catégories, sélection vedettes, CTA devis
- Catalogue navigable (`/catalogue`) avec pills de catégorie + grille produits
- Page catégorie (`/c/[slug]`) avec breadcrumb
- Fiche produit (`/p/[slug]`) avec galerie, prix TTC/HTVA, état stock, panier
- Panier cookie (sans login requis)
- Checkout invité avec coordonnées + adresse + option pro (TVA intracom)
- Paiement Mollie (Bancontact, carte, iDEAL, virement) en mode test
- Page de succès + webhook qui marque la commande payée et décrémente le stock
- Formulaire de contact

## À faire ensuite (V2)
- **Import produits** depuis flux fournisseur (collin-lucy.be) en CSV/JSON avec mapping
  catégories + application de la marge (`priceHT = costHT × (1 + marge%)`)
- Comptes clients (commande historique, panier persistant, factures PDF)
- Admin produits/commandes
- Emails transactionnels (confirmation commande, expédition)
- Frais de livraison réels par zone et poids
- SEO : sitemap, robots, JSON-LD Product/Offer, Open Graph par produit
- Multilingue FR/NL
- CGV, mentions légales, politique de confidentialité

## Installation

### Pré-requis
- Node 20+, PostgreSQL 14+, une clé API Mollie test

### Pas à pas
```bash
sudo -u postgres psql -c "CREATE DATABASE mr_horeca OWNER horeca;"
cp .env.example .env             # éditer MOLLIE_API_KEY
npm install --legacy-peer-deps
npm run prisma:push
npm run db:seed
npm run dev                      # http://localhost:3001
```

## Modèle reseller (collin-lucy ou autre fournisseur)

Le schéma supporte un fonctionnement en revente avec marge variable :
- `Product.costHT` = prix d'achat fournisseur
- `Product.priceHT` = prix de vente public (votre marge appliquée)
- `Product.supplier` + `supplierSku` + `externalId` permettent l'import régulier

À écrire en V2 : `scripts/import-supplier.ts` qui lit le flux fournisseur et upsert par
`externalId`, en recalculant `priceHT = costHT * (1 + marge_categorie)`.

## Architecture

```
src/
├── app/
│   ├── page.tsx              # Landing (hero, trust, cats, featured, CTA)
│   ├── catalogue/            # Hub catalogue
│   ├── c/[slug]/             # Page catégorie
│   ├── p/[slug]/             # Fiche produit
│   ├── cart/                 # Panier cookie
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
│   └── ui/                   # primitives (button, input, badge)
├── lib/
│   ├── db.ts                 # Prisma singleton
│   ├── cart.ts               # cookie cart (zod-validé)
│   ├── mollie.ts             # client Mollie
│   ├── email.ts              # nodemailer
│   └── utils.ts
├── server/
│   └── cart.service.ts       # hydrate cart with product details
prisma/
├── schema.prisma             # Category, Brand, Product, Order, Customer, ...
└── seed.ts                   # 12 produits démo répartis en 6 catégories
```

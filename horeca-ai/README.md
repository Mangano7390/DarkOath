# HoReCa AI — plateforme interne

Application SaaS interne pour une entreprise de distribution HoReCa.
Centralise 7 assistants IA (Claude) pour automatiser les tâches commerciales, techniques et logistiques.

> Premier module livré : **Devis IA**. Les 6 autres modules ont une page de placeholder ;
> ils sont câblés dans le dashboard et la sidebar, et leurs modèles Prisma sont déjà prêts.

## Stack

- **Frontend** : Next.js 14 (App Router) + TypeScript strict + Tailwind + shadcn/ui (composants minimalistes intégrés)
- **Backend** : API routes Next.js + Prisma ORM
- **Base de données** : PostgreSQL 16 + pgvector
- **IA** : `@anthropic-ai/sdk` (Claude) avec function calling et streaming SSE
- **Auth** : NextAuth v5 (Credentials) + RBAC (admin / commercial / technicien / logistique)
- **PDF** : `@react-pdf/renderer`
- **Email** : nodemailer (Mailhog en dev)

## Installation

### 1. Pré-requis
- Node.js 20+
- Docker + Docker Compose

### 2. Cloner et installer
```bash
cd horeca-ai
cp .env.example .env       # remplir ANTHROPIC_API_KEY
npm install
```

### 3. Lancer Postgres + Mailhog
```bash
docker compose up -d
```
Mailhog est exposé sur `http://localhost:8025` (interface web pour voir les emails envoyés en dev).

### 4. Migrer la base et seeder
```bash
npm run prisma:migrate     # crée la base et applique les migrations
npm run db:seed            # crée users démo + catalogue + clients
```

### 5. Démarrer
```bash
npm run dev
```
Ouvrir http://localhost:3000.

### Comptes de démo
- `admin@horeca.local` / `demo1234` (ADMIN)
- `commercial@horeca.local` / `demo1234` (COMMERCIAL)

## Variables d'environnement

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Postgres avec extensions vector, pg_trgm, unaccent |
| `NEXTAUTH_SECRET` | Secret cookie de session (≥32 bytes) |
| `ANTHROPIC_API_KEY` | Clé API Anthropic |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-5` par défaut. Modèles plus récents disponibles : `claude-sonnet-4-6`, `claude-opus-4-7`, `claude-haiku-4-5` |
| `ANTHROPIC_MAX_TOKENS` | Plafond de tokens de sortie par message |
| `SMTP_*` | Config SMTP (Mailhog en dev) |
| `COMPANY_*` | En-tête et pied de page du PDF de devis |
| `AI_RATE_LIMIT_PER_MIN` | Limite par utilisateur sur les routes `/api/ai/*` |

## Architecture

```
src/
├── app/
│   ├── (auth)/login/                  # NextAuth credentials
│   ├── (app)/                         # Shell + sidebar + role guard
│   │   ├── dashboard/                 # Cartes des 7 modules
│   │   ├── quotes/                    # Module 1 (live)
│   │   ├── tickets|inbox|catalog|...  # Modules 2-7 (placeholders)
│   └── api/
│       ├── auth/[...nextauth]
│       ├── ai/quote/                  # SSE streaming agent
│       ├── quotes/                    # CRUD + PDF + send
│       ├── customers/                 # lookup
│       └── catalog/search/            # lookup pour UI
├── lib/
│   ├── ai/
│   │   ├── client.ts                  # Anthropic singleton
│   │   ├── stream.ts                  # runAgent + SSE helper
│   │   ├── types.ts                   # ToolDef, StreamEvent
│   │   ├── tools/                     # JSON schemas Claude tool_use
│   │   │   ├── catalog.ts             # search_products, get_products_by_ids
│   │   │   ├── customer.ts            # search_customers
│   │   │   └── quote.ts               # propose_quote_lines (mutate)
│   │   └── agents/
│   │       └── quoteAgent.ts          # system prompt + tools du module Devis
│   ├── db.ts                          # PrismaClient singleton
│   ├── auth.ts                        # NextAuth + requireUser/requireRole
│   ├── audit.ts                       # logAudit + withAudit
│   ├── ratelimit.ts                   # token bucket en mémoire
│   ├── sanitize.ts                    # nettoyage des inputs
│   ├── i18n.ts                        # FR / NL / EN (dictionnaire minimal)
│   ├── pdf.tsx                        # rendu PDF react-pdf
│   ├── email.ts                       # nodemailer
│   └── utils.ts
├── components/
│   ├── ui/                            # primitives shadcn (button, card, input, table…)
│   ├── app/Sidebar.tsx                # nav principale
│   └── quote/                         # NewQuoteForm, QuoteWorkspace
├── server/
│   └── quote.service.ts               # nextQuoteNumber, totals, CRUD
├── types/
├── middleware.ts                      # protection des routes
prisma/
├── schema.prisma                      # 7 modules de données + audit
├── seed.ts                            # users + catalogue + clients démo
└── init.sql                           # extensions Postgres
```

## Module 1 — Devis IA

### Flux

```
[Page /quotes/new]
  ├─ Choix client (Select) + Brief (Textarea)
  ├─ POST /api/quotes  → crée Quote DRAFT
  └─ Redirige vers /quotes/<id>?autorun=1
[Page /quotes/<id>]
  ├─ QuoteWorkspace (Client Component)
  ├─ POST /api/ai/quote → SSE stream
  │    └─ runAgent boucle Claude ↔ tools jusqu'à stop
  │         tools: search_products, get_products_by_ids, propose_quote_lines
  ├─ propose_quote_lines persiste les lignes (aiSuggested=true)
  ├─ Éditeur ligne par ligne (PATCH /api/quotes/<id>)
  ├─ /api/quotes/<id>/pdf → @react-pdf/renderer
  └─ /api/quotes/<id>/send → SMTP + PDF en pièce jointe
```

### Prompt système (extrait)

Voir `src/lib/ai/agents/quoteAgent.ts`. Points clés :
- L'agent **ne propose que des produits retournés par `search_products`**.
- Il appelle `propose_quote_lines` **une seule fois** à la fin, avec toutes les lignes.
- Aucun prix inventé : il laisse le système reprendre le prix catalogue.
- Réponse en français, ton concis, sans promesse commerciale.

### Sécurité

- Toutes les routes `/api/*` exigent une session.
- `runAgent` valide `quote.authorId === user.id` avant chaque mutation.
- Rate-limit token-bucket en mémoire (30 req/min/user par défaut, configurable).
- `sanitizeText` sur tous les prompts persistés ou envoyés en PDF/email.
- `zod` sur tous les bodies entrants ; les outils Claude revalident côté handler.
- L'envoi email exige une confirmation côté client (mode HITL configurable dans `ModuleSetting`).

### Audit log

Chaque mutation IA (création devis, prompt envoyé, génération PDF, envoi email) est tracée dans
`AuditLog` avec `userId`, `action`, `entity`, `entityId`, `meta`. Utile pour la conformité et le debug.

### Boucle de feedback (à activer pour les modules suivants)

Le modèle `AICorrection` permet de stocker `originalOutput / correctedOutput / comment` quand
l'utilisateur édite manuellement une proposition de l'IA. Cette table sera utilisée :
- en few-shot par les agents (top-N corrections récentes par module/utilisateur) ;
- ou comme dataset de fine-tuning si vous passez à un modèle privé.

## Roadmap modules suivants

L'architecture est prête pour les 6 autres modules : chaque module aura
1. un fichier `src/lib/ai/agents/<module>Agent.ts` (system prompt + tools),
2. ses tools dans `src/lib/ai/tools/`,
3. une route `app/api/ai/<module>/route.ts` (SSE),
4. ses pages `app/(app)/<module>/`,
5. ses composants `components/<module>/`.

Modèles Prisma déjà prêts pour : Tickets/SAV, KnowledgeDoc, InboxItem, ProductTranslation,
SalesOrder, RoutePlan, StockAlert.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Next.js en dev |
| `npm run build` | `prisma generate` + Next build |
| `npm run typecheck` | TypeScript noEmit |
| `npm run prisma:migrate` | Crée/applique les migrations |
| `npm run db:seed` | Seed démo |
| `npm run db:reset` | Reset complet + seed |
| `npm run prisma:studio` | Prisma Studio |

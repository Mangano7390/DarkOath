import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Mr Horeca…");

  // ─── Categories ──────────────────────────────────────────
  const categories = [
    { slug: "cuisson", name: "Cuisson", order: 1 },
    { slug: "froid", name: "Froid professionnel", order: 2 },
    { slug: "lavage", name: "Lavage", order: 3 },
    { slug: "bar", name: "Bar & boissons", order: 4 },
    { slug: "mobilier", name: "Mobilier inox", order: 5 },
    { slug: "pieces", name: "Pièces détachées", order: 6 },
  ];
  for (const c of categories) {
    await prisma.category.upsert({ where: { slug: c.slug }, update: {}, create: c });
  }

  // ─── Brands ──────────────────────────────────────────────
  const brands = [
    { slug: "rational", name: "Rational" },
    { slug: "liebherr", name: "Liebherr" },
    { slug: "winterhalter", name: "Winterhalter" },
    { slug: "electrolux", name: "Electrolux" },
    { slug: "fagor", name: "Fagor" },
    { slug: "tefcold", name: "Tefcold" },
  ];
  for (const b of brands) {
    await prisma.brand.upsert({ where: { slug: b.slug }, update: {}, create: b });
  }

  const byCat = async (slug: string) => (await prisma.category.findUnique({ where: { slug } }))?.id;
  const byBrand = async (slug: string) => (await prisma.brand.findUnique({ where: { slug } }))?.id;

  const products = [
    {
      slug: "four-pizza-gaz-9p",
      sku: "PIZ-GAS-9",
      name: "Four à pizza gaz double chambre, 9 pizzas",
      shortDesc: "Four à pizza professionnel à gaz, double chambre, 9 pizzas Ø30cm",
      longDesc: "Four à pizza professionnel à gaz, double chambre, capacité 9 pizzas Ø30cm, sole pierre, thermostat indépendant par chambre. Idéal pour pizzeria 60-100 couverts.",
      priceHT: 3450, costHT: 2200,
      categorySlug: "cuisson", brandSlug: "rational",
      stockQty: 5, featured: true,
      images: [{ url: "/img/four-pizza.jpg", alt: "Four à pizza gaz" }],
      attrs: { puissance: "gaz", capacite: "9 pizzas", chambres: 2 },
    },
    {
      slug: "four-bois-pizza-90",
      sku: "FRB-90-WOOD",
      name: "Four à bois pizza Ø90cm",
      shortDesc: "Four à bois traditionnel, capacité 6 pizzas",
      longDesc: "Four à bois pour pizzeria, sole en pierre réfractaire Ø90cm, isolation céramique, voûte basse. Conforme HACCP.",
      priceHT: 4890, costHT: 3100,
      categorySlug: "cuisson",
      stockQty: 3, featured: true,
      images: [{ url: "/img/four-bois.jpg", alt: "Four à bois" }],
    },
    {
      slug: "fourneau-gaz-6-feux",
      sku: "FRN-GAZ-6",
      name: "Fourneau gaz 6 feux + four",
      shortDesc: "Cuisinière professionnelle 6 feux gaz avec four électrique",
      longDesc: "Fourneau professionnel 6 feux gaz haute puissance (5,5 kW chacun), avec four électrique GN2/1, sole grille acier émaillé.",
      priceHT: 2390, costHT: 1500,
      categorySlug: "cuisson", brandSlug: "electrolux",
      stockQty: 4,
      images: [{ url: "/img/fourneau.jpg", alt: "Fourneau 6 feux" }],
    },
    {
      slug: "chambre-froide-300",
      sku: "CRP-MID-300",
      name: "Chambre froide positive 300×220×220",
      shortDesc: "Chambre froide positive démontable +2/+8°C, 14m³",
      longDesc: "Chambre froide positive panneaux 60mm, dimensions 3000×2200×2200mm, groupe monobloc, plage +2/+8°C, sol isolé.",
      priceHT: 5290, costHT: 3500,
      categorySlug: "froid", brandSlug: "liebherr",
      stockQty: 2, featured: true,
      images: [{ url: "/img/chambre-froide.jpg", alt: "Chambre froide" }],
    },
    {
      slug: "armoire-positive-600l",
      sku: "FRT-COL-600",
      name: "Armoire réfrigérée positive 600L",
      shortDesc: "Armoire 1 porte 600L +2/+8°C",
      longDesc: "Armoire réfrigérée GN2/1, 1 porte pleine, 600L, +2/+8°C, ventilée, intérieur inox.",
      priceHT: 1390, costHT: 880,
      categorySlug: "froid", brandSlug: "liebherr",
      stockQty: 8,
      images: [{ url: "/img/armoire-positive.jpg", alt: "Armoire réfrigérée" }],
    },
    {
      slug: "armoire-negative-600l",
      sku: "FRT-NEG-600",
      name: "Armoire négative 600L -18/-22°C",
      shortDesc: "Armoire congélation 600L 1 porte",
      longDesc: "Armoire réfrigérée négative -18/-22°C, capacité 600L, 1 porte pleine, ventilée, dégivrage automatique.",
      priceHT: 1690, costHT: 1100,
      categorySlug: "froid", brandSlug: "tefcold",
      stockQty: 5,
      images: [{ url: "/img/armoire-negative.jpg", alt: "Armoire négative" }],
    },
    {
      slug: "lave-vaisselle-capot",
      sku: "LV-CAP-50",
      name: "Lave-vaisselle capot Winterhalter, 60 paniers/h",
      shortDesc: "Lave-vaisselle capot 500×500, double paroi inox",
      longDesc: "Lave-vaisselle à capot Winterhalter, panier 500×500mm, 60 paniers/heure, double paroi inox, adoucisseur intégré.",
      priceHT: 4690, costHT: 3200,
      categorySlug: "lavage", brandSlug: "winterhalter",
      stockQty: 4, featured: true,
      images: [{ url: "/img/lave-vaisselle.jpg", alt: "Lave-vaisselle" }],
    },
    {
      slug: "plonge-1-bac",
      sku: "PLN-CAP-50",
      name: "Plonge inox 1 bac + égouttoir",
      shortDesc: "Plonge inox 1200×700, bac 500×500",
      longDesc: "Plonge professionnelle inox 304, dimensions 1200×700×900mm, bac 500×500×300mm, égouttoir gauche, bonde Ø60mm.",
      priceHT: 420, costHT: 240,
      categorySlug: "lavage",
      stockQty: 18,
      images: [{ url: "/img/plonge.jpg", alt: "Plonge inox" }],
    },
    {
      slug: "tireuse-3-voies",
      sku: "BAR-TIR-3",
      name: "Tireuse à bière 3 voies",
      shortDesc: "Tireuse 3 voies refroidie + colonne",
      longDesc: "Groupe tireuse 3 voies, refroidissement direct, colonne 3 robinets, débit 80L/h, raccord 7mm.",
      priceHT: 1290, costHT: 780,
      categorySlug: "bar",
      stockQty: 6, featured: true,
      images: [{ url: "/img/tireuse.jpg", alt: "Tireuse à bière" }],
    },
    {
      slug: "machine-glacons",
      sku: "BAR-ICE-50",
      name: "Machine à glaçons 50 kg/24h",
      shortDesc: "Production 50 kg/24h, glaçons creux",
      longDesc: "Machine à glaçons professionnelle, production 50 kg/24h, glaçons creux, réservoir 25 kg, condensation air.",
      priceHT: 1490, costHT: 950,
      categorySlug: "bar",
      stockQty: 7,
      images: [{ url: "/img/machine-glacons.jpg", alt: "Machine à glaçons" }],
    },
    {
      slug: "table-prep-inox-2m",
      sku: "TBL-PRP-200",
      name: "Table de préparation inox 2000×700",
      shortDesc: "Table inox avec dosseret 2m",
      longDesc: "Table de préparation inox 304, 2000×700×900mm, avec dosseret 100mm et étagère basse.",
      priceHT: 290, costHT: 160,
      categorySlug: "mobilier",
      stockQty: 22,
      images: [{ url: "/img/table-inox.jpg", alt: "Table inox" }],
    },
    {
      slug: "etagere-inox-4-niveaux",
      sku: "ETG-INX-4N",
      name: "Étagère inox 4 niveaux 1500×500",
      shortDesc: "Rayonnage inox démontable 4 niveaux",
      longDesc: "Étagère de rangement inox 304 démontable, 4 niveaux, dimensions 1500×500×1800mm, charge 120 kg par niveau.",
      priceHT: 320, costHT: 190,
      categorySlug: "mobilier",
      stockQty: 14,
      images: [{ url: "/img/etagere.jpg", alt: "Étagère inox" }],
    },
  ];

  for (const p of products) {
    const categoryId = await byCat(p.categorySlug);
    const brandId = p.brandSlug ? await byBrand(p.brandSlug) : null;
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: {
        slug: p.slug,
        sku: p.sku,
        name: p.name,
        shortDesc: p.shortDesc,
        longDesc: p.longDesc,
        priceHT: p.priceHT,
        costHT: p.costHT,
        stockQty: p.stockQty,
        featured: p.featured ?? false,
        categoryId: categoryId ?? null,
        brandId: brandId ?? null,
        attrs: (p as { attrs?: object }).attrs ?? undefined,
      },
    });
    for (const [i, img] of p.images.entries()) {
      await prisma.productImage.upsert({
        where: { id: `${product.id}-img-${i}` },
        update: {},
        create: { id: `${product.id}-img-${i}`, productId: product.id, url: img.url, alt: img.alt, position: i },
      });
    }
  }

  await prisma.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS order_seq START 10000`);

  const count = await prisma.product.count();
  console.log(`Seed terminé : ${count} produits`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

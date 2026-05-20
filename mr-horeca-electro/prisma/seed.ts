import { PrismaClient, Channel } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Mr Horeca & Mr Electro…");

  // ─── Categories ──────────────────────────────────────────
  const catsHoreca = [
    { slug: "cuisson", name: "Cuisson", channel: Channel.HORECA, order: 1 },
    { slug: "froid-pro", name: "Froid professionnel", channel: Channel.HORECA, order: 2 },
    { slug: "lavage-pro", name: "Lavage professionnel", channel: Channel.HORECA, order: 3 },
    { slug: "bar", name: "Bar & boissons", channel: Channel.HORECA, order: 4 },
    { slug: "mobilier-pro", name: "Mobilier inox", channel: Channel.HORECA, order: 5 },
    { slug: "pieces", name: "Pièces détachées", channel: Channel.HORECA, order: 6 },
  ];
  const catsElectro = [
    { slug: "gros-electromenager", name: "Gros électroménager", channel: Channel.ELECTRO, order: 1 },
    { slug: "petit-electromenager", name: "Petit électroménager", channel: Channel.ELECTRO, order: 2 },
    { slug: "tv-audio", name: "TV & Audio", channel: Channel.ELECTRO, order: 3 },
    { slug: "informatique", name: "Informatique", channel: Channel.ELECTRO, order: 4 },
    { slug: "climatisation", name: "Climatisation", channel: Channel.ELECTRO, order: 5 },
  ];
  for (const c of [...catsHoreca, ...catsElectro]) {
    await prisma.category.upsert({ where: { slug: c.slug }, update: {}, create: c });
  }

  // ─── Brands ──────────────────────────────────────────────
  const brands = [
    { slug: "rational", name: "Rational" },
    { slug: "liebherr", name: "Liebherr" },
    { slug: "winterhalter", name: "Winterhalter" },
    { slug: "electrolux", name: "Electrolux" },
    { slug: "fagor", name: "Fagor" },
    { slug: "samsung", name: "Samsung" },
    { slug: "lg", name: "LG" },
    { slug: "bosch", name: "Bosch" },
    { slug: "sony", name: "Sony" },
    { slug: "dyson", name: "Dyson" },
  ];
  for (const b of brands) {
    await prisma.brand.upsert({ where: { slug: b.slug }, update: {}, create: b });
  }

  const byCat = async (slug: string) => (await prisma.category.findUnique({ where: { slug } }))?.id;
  const byBrand = async (slug: string) => (await prisma.brand.findUnique({ where: { slug } }))?.id;

  // ─── Products HoReCa ─────────────────────────────────────
  const horecaProducts = [
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
      slug: "chambre-froide-300",
      sku: "CRP-MID-300",
      name: "Chambre froide positive 300×220×220",
      shortDesc: "Chambre froide positive démontable +2/+8°C, 14m³",
      longDesc: "Chambre froide positive panneaux 60mm, dimensions 3000×2200×2200mm, groupe monobloc, plage +2/+8°C, sol isolé.",
      priceHT: 5290, costHT: 3500,
      categorySlug: "froid-pro", brandSlug: "liebherr",
      stockQty: 2, featured: true,
      images: [{ url: "/img/chambre-froide.jpg", alt: "Chambre froide" }],
    },
    {
      slug: "lave-vaisselle-capot",
      sku: "LV-CAP-50",
      name: "Lave-vaisselle capot Winterhalter, 60 paniers/h",
      shortDesc: "Lave-vaisselle capot 500×500, double paroi inox",
      longDesc: "Lave-vaisselle à capot Winterhalter, panier 500×500mm, 60 paniers/heure, double paroi inox, adoucisseur intégré.",
      priceHT: 4690, costHT: 3200,
      categorySlug: "lavage-pro", brandSlug: "winterhalter",
      stockQty: 4,
      images: [{ url: "/img/lave-vaisselle.jpg", alt: "Lave-vaisselle" }],
    },
    {
      slug: "tireuse-3-voies",
      sku: "BAR-TIR-3",
      name: "Tireuse à bière 3 voies",
      shortDesc: "Tireuse 3 voies refroidie + colonne",
      longDesc: "Groupe tireuse 3 voies, refroidissement direct, colonne 3 robinets, débit 80L/h, raccord 7mm.",
      priceHT: 1290, costHT: 780,
      categorySlug: "bar",
      stockQty: 6,
      images: [{ url: "/img/tireuse.jpg", alt: "Tireuse à bière" }],
    },
    {
      slug: "table-prep-inox-2m",
      sku: "TBL-PRP-200",
      name: "Table de préparation inox 2000×700",
      shortDesc: "Table inox avec dosseret 2m",
      longDesc: "Table de préparation inox 304, 2000×700×900mm, avec dosseret 100mm et étagère basse.",
      priceHT: 290, costHT: 160,
      categorySlug: "mobilier-pro",
      stockQty: 22,
      images: [{ url: "/img/table-inox.jpg", alt: "Table inox" }],
    },
    {
      slug: "armoire-positive-600l",
      sku: "FRT-COL-600",
      name: "Armoire réfrigérée positive 600L",
      shortDesc: "Armoire 1 porte 600L +2/+8°C",
      longDesc: "Armoire réfrigérée GN2/1, 1 porte pleine, 600L, +2/+8°C, ventilée, intérieur inox.",
      priceHT: 1390, costHT: 880,
      categorySlug: "froid-pro", brandSlug: "liebherr",
      stockQty: 8,
      images: [{ url: "/img/armoire-positive.jpg", alt: "Armoire réfrigérée" }],
    },
    {
      slug: "plonge-1-bac",
      sku: "PLN-CAP-50",
      name: "Plonge inox 1 bac + égouttoir",
      shortDesc: "Plonge inox 1200×700, bac 500×500",
      longDesc: "Plonge professionnelle inox 304, dimensions 1200×700×900mm, bac 500×500×300mm, égouttoir gauche, bonde Ø60mm.",
      priceHT: 420, costHT: 240,
      categorySlug: "lavage-pro",
      stockQty: 18,
      images: [{ url: "/img/plonge.jpg", alt: "Plonge inox" }],
    },
  ];

  // ─── Products Electro ────────────────────────────────────
  const electroProducts = [
    {
      slug: "tv-oled-55",
      sku: "TV-OLED-55",
      name: 'TV OLED 55" 4K HDR',
      shortDesc: "Téléviseur OLED 55 pouces 4K UHD, HDR10+, Dolby Vision",
      longDesc: "Téléviseur OLED 55 pouces résolution 4K UHD, HDR10+, Dolby Vision IQ, Dolby Atmos, processeur IA, 4 ports HDMI 2.1.",
      priceHT: 1239.67, costHT: 950,
      vatRate: 21,
      categorySlug: "tv-audio", brandSlug: "lg",
      stockQty: 12, featured: true,
      images: [{ url: "/img/tv-oled.jpg", alt: "TV OLED 55 pouces" }],
    },
    {
      slug: "lave-linge-9kg",
      sku: "LL-A-9KG",
      name: "Lave-linge 9 kg classe A",
      shortDesc: "Lave-linge frontal 9 kg, classe énergie A, 1400 tr/min",
      longDesc: "Lave-linge frontal grande capacité 9 kg, classe énergétique A, essorage 1400 tr/min, programme rapide, traitement vapeur.",
      priceHT: 619.83, costHT: 450,
      categorySlug: "gros-electromenager", brandSlug: "bosch",
      stockQty: 15, featured: true,
      images: [{ url: "/img/lave-linge.jpg", alt: "Lave-linge" }],
    },
    {
      slug: "aspirateur-balai",
      sku: "ASP-BAL-V15",
      name: "Aspirateur balai sans fil V15",
      shortDesc: "Aspirateur balai sans fil, 60 min d'autonomie, filtration HEPA",
      longDesc: "Aspirateur balai sans fil, autonomie 60 min, batterie amovible, filtration HEPA, écran LCD, plusieurs accessoires.",
      priceHT: 537.19, costHT: 380,
      categorySlug: "petit-electromenager", brandSlug: "dyson",
      stockQty: 8, featured: true,
      images: [{ url: "/img/aspirateur.jpg", alt: "Aspirateur balai" }],
    },
    {
      slug: "frigo-combine-380l",
      sku: "FRG-COMB-380",
      name: "Réfrigérateur combiné 380L No Frost",
      shortDesc: "Réfrigérateur combiné 380L, No Frost, classe E",
      longDesc: "Réfrigérateur combiné capacité 380L (270L frigo + 110L congélateur), No Frost, classe énergétique E, distributeur d'eau.",
      priceHT: 826.45, costHT: 580,
      categorySlug: "gros-electromenager", brandSlug: "samsung",
      stockQty: 6,
      images: [{ url: "/img/frigo.jpg", alt: "Réfrigérateur combiné" }],
    },
    {
      slug: "casque-sans-fil",
      sku: "AUD-WH-1000",
      name: "Casque audio sans fil ANC",
      shortDesc: "Casque circum-auriculaire sans fil, réduction de bruit active",
      longDesc: "Casque audio sans fil Bluetooth 5.3, réduction de bruit active, autonomie 30h, micro intégré, codec LDAC.",
      priceHT: 330.58, costHT: 240,
      categorySlug: "tv-audio", brandSlug: "sony",
      stockQty: 20,
      images: [{ url: "/img/casque.jpg", alt: "Casque audio" }],
    },
    {
      slug: "ordi-portable-15",
      sku: "PC-LAP-15-I7",
      name: 'Ordinateur portable 15.6" i7 16Go 512Go SSD',
      shortDesc: "PC portable 15.6 pouces, Intel i7, 16Go RAM, SSD 512Go",
      longDesc: "Ordinateur portable 15.6 pouces FHD IPS, Intel Core i7 13e gen, 16Go DDR5, SSD NVMe 512Go, Windows 11.",
      priceHT: 826.45, costHT: 620,
      categorySlug: "informatique",
      stockQty: 10,
      images: [{ url: "/img/laptop.jpg", alt: "Ordinateur portable" }],
    },
    {
      slug: "clim-split-9000",
      sku: "CLM-SPL-9K",
      name: "Climatiseur split 9000 BTU réversible",
      shortDesc: "Climatiseur split mural 9000 BTU, réversible chaud/froid, classe A++",
      longDesc: "Climatiseur split mural 9000 BTU, réversible chaud/froid, classe énergétique A++, Wi-Fi, gaz R32.",
      priceHT: 619.83, costHT: 430,
      categorySlug: "climatisation",
      stockQty: 5,
      images: [{ url: "/img/clim.jpg", alt: "Climatiseur" }],
    },
  ];

  for (const p of [...horecaProducts, ...electroProducts]) {
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
        vatRate: p.vatRate ?? 21,
        channel: catsHoreca.find((c) => c.slug === p.categorySlug) ? Channel.HORECA : Channel.ELECTRO,
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

  // ─── Order number sequence ────────────────────────────────
  await prisma.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS order_seq START 10000`);

  const counts = {
    products: await prisma.product.count(),
    horeca: await prisma.product.count({ where: { channel: Channel.HORECA } }),
    electro: await prisma.product.count({ where: { channel: Channel.ELECTRO } }),
  };
  console.log(`Seed terminé : ${counts.products} produits (${counts.horeca} HoReCa, ${counts.electro} Electro)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

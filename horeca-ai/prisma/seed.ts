import { PrismaClient, Role, CustomerSegment, Locale } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding…");

  // ─── Users ───────────────────────────────
  const password = await bcrypt.hash("demo1234", 10);
  await prisma.user.upsert({
    where: { email: "admin@horeca.local" },
    update: {},
    create: {
      email: "admin@horeca.local",
      name: "Admin Démo",
      hashedPassword: password,
      role: Role.ADMIN,
    },
  });
  await prisma.user.upsert({
    where: { email: "commercial@horeca.local" },
    update: {},
    create: {
      email: "commercial@horeca.local",
      name: "Commercial Démo",
      hashedPassword: password,
      role: Role.COMMERCIAL,
    },
  });
  await prisma.user.upsert({
    where: { email: "tech@horeca.local" },
    update: {},
    create: {
      email: "tech@horeca.local",
      name: "Technicien Démo",
      hashedPassword: password,
      role: Role.TECHNICIAN,
    },
  });
  await prisma.user.upsert({
    where: { email: "logistics@horeca.local" },
    update: {},
    create: {
      email: "logistics@horeca.local",
      name: "Logistique Démo",
      hashedPassword: password,
      role: Role.LOGISTICS,
    },
  });

  // ─── Categories ──────────────────────────
  const categories = [
    { slug: "cuisson", name: "Cuisson" },
    { slug: "froid", name: "Froid" },
    { slug: "lavage", name: "Lavage" },
    { slug: "mobilier", name: "Mobilier" },
    { slug: "bar", name: "Bar" },
    { slug: "buffet", name: "Buffet" },
    { slug: "pieces", name: "Pièces détachées" },
  ];
  for (const c of categories) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: c,
    });
  }
  const cuisson = await prisma.category.findUnique({ where: { slug: "cuisson" } });
  const froid = await prisma.category.findUnique({ where: { slug: "froid" } });
  const lavage = await prisma.category.findUnique({ where: { slug: "lavage" } });
  const bar = await prisma.category.findUnique({ where: { slug: "bar" } });

  // ─── Brands ──────────────────────────────
  for (const name of ["Rational", "Electrolux", "Fagor", "Liebherr", "Winterhalter", "Tefcold"]) {
    await prisma.brand.upsert({ where: { name }, update: {}, create: { name } });
  }
  const rational = await prisma.brand.findUnique({ where: { name: "Rational" } });
  const liebherr = await prisma.brand.findUnique({ where: { name: "Liebherr" } });
  const winterhalter = await prisma.brand.findUnique({ where: { name: "Winterhalter" } });

  // ─── Products ────────────────────────────
  const products = [
    {
      sku: "FRB-90-WOOD",
      name: "Four à bois pizza Ø90cm",
      shortDesc: "Four à bois traditionnel, capacité 6 pizzas",
      longDesc: "Four à bois pour pizzeria, sole en pierre réfractaire Ø90cm, isolation céramique, voûte basse, capacité 6 pizzas simultanées. Conforme HACCP.",
      priceHT: 4890,
      costHT: 3100,
      stockQty: 3,
      reorderPoint: 1,
      categoryId: cuisson?.id,
      attrs: { puissance: "bois", diametre: 90, capacite: "6 pizzas" },
    },
    {
      sku: "PIZ-GAS-9",
      name: "Four à pizza gaz 9 pizzas",
      shortDesc: "Four à pizza gaz double chambre, 9 pizzas Ø30",
      longDesc: "Four à pizza professionnel à gaz, double chambre, capacité 9 pizzas Ø30cm, sole pierre, thermostat indépendant par chambre.",
      priceHT: 3450,
      costHT: 2200,
      stockQty: 5,
      reorderPoint: 2,
      categoryId: cuisson?.id,
      brandId: rational?.id,
    },
    {
      sku: "CRP-MID-300",
      name: "Chambre froide positive 300×220×220",
      shortDesc: "Chambre froide positive démontable +2/+8°C, 14m³",
      longDesc: "Chambre froide positive panneaux 60mm, dimensions 3000×2200×2200mm, groupe monobloc, plage +2/+8°C, sol isolé.",
      priceHT: 5290,
      costHT: 3500,
      stockQty: 2,
      reorderPoint: 1,
      categoryId: froid?.id,
      brandId: liebherr?.id,
    },
    {
      sku: "PLN-CAP-50",
      name: "Plonge inox 1 bac + égouttoir",
      shortDesc: "Plonge inox 1200×700, bac 500×500, égouttoir gauche",
      longDesc: "Plonge professionnelle inox 304, dimensions 1200×700×900mm, bac 500×500×300mm, égouttoir gauche, bonde Ø60mm.",
      priceHT: 420,
      costHT: 240,
      stockQty: 18,
      reorderPoint: 5,
      categoryId: lavage?.id,
    },
    {
      sku: "LV-CAP-50",
      name: "Lave-vaisselle capot Winterhalter",
      shortDesc: "Lave-vaisselle capot, panier 500×500, 60 paniers/h",
      longDesc: "Lave-vaisselle à capot Winterhalter, panier 500×500mm, 60 paniers/heure, double paroi inox, adoucisseur intégré.",
      priceHT: 4690,
      costHT: 3200,
      stockQty: 4,
      reorderPoint: 1,
      categoryId: lavage?.id,
      brandId: winterhalter?.id,
    },
    {
      sku: "TBL-PRP-200",
      name: "Table de préparation inox 2000×700",
      shortDesc: "Table inox avec dosseret 2m",
      longDesc: "Table de préparation inox 304, 2000×700×900mm, avec dosseret 100mm et étagère basse.",
      priceHT: 290,
      costHT: 160,
      stockQty: 22,
      reorderPoint: 6,
      categoryId: lavage?.id,
    },
    {
      sku: "BAR-TIR-3",
      name: "Tireuse à bière 3 voies",
      shortDesc: "Tireuse 3 voies refroidie + colonne",
      longDesc: "Groupe tireuse 3 voies, refroidissement direct, colonne 3 robinets, débit 80L/h, raccord 7mm.",
      priceHT: 1290,
      costHT: 780,
      stockQty: 6,
      reorderPoint: 2,
      categoryId: bar?.id,
    },
    {
      sku: "FRT-COL-600",
      name: "Armoire réfrigérée positive 600L",
      shortDesc: "Armoire 1 porte 600L +2/+8°C",
      longDesc: "Armoire réfrigérée GN2/1, 1 porte pleine, 600L, +2/+8°C, ventilée, intérieur inox.",
      priceHT: 1390,
      costHT: 880,
      stockQty: 8,
      reorderPoint: 3,
      categoryId: froid?.id,
      brandId: liebherr?.id,
    },
  ];
  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: p,
    });
  }

  // ─── Customers ───────────────────────────
  await prisma.customer.upsert({
    where: { code: "CUST-0001" },
    update: {},
    create: {
      code: "CUST-0001",
      companyName: "Pizzeria Bellissima",
      contactName: "Marco Rossi",
      email: "marco@bellissima.be",
      phone: "+32 2 555 12 34",
      segment: CustomerSegment.RESTAURANT,
      addrLine1: "Rue de la Pizza 12",
      zip: "1000",
      city: "Bruxelles",
      locale: Locale.FR,
    },
  });
  await prisma.customer.upsert({
    where: { code: "CUST-0002" },
    update: {},
    create: {
      code: "CUST-0002",
      companyName: "Hôtel des Étoiles",
      contactName: "Sophie Laurent",
      email: "achats@etoiles.be",
      phone: "+32 9 555 22 11",
      segment: CustomerSegment.HOTEL,
      addrLine1: "Avenue des Arts 45",
      zip: "9000",
      city: "Gand",
      locale: Locale.NL,
    },
  });

  // ─── Module settings ─────────────────────
  const modules = ["QUOTE", "SAV", "TRIAGE", "INSIGHTS", "PRODUCT_SHEET", "ROUTING", "STOCK"] as const;
  for (const m of modules) {
    await prisma.moduleSetting.upsert({
      where: { module: m },
      update: {},
      create: {
        module: m,
        enabled: true,
        requiresApproval: m === "TRIAGE" || m === "QUOTE",
      },
    });
  }

  // ─── Quote number sequence ───────────────
  await prisma.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS quote_seq START 1000`);
  await prisma.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS ticket_seq START 1000`);

  // ─── Demo inbox items ────────────────────
  const inboxSamples = [
    {
      externalId: "demo-msg-001",
      channel: "EMAIL" as const,
      fromName: "Marco Rossi",
      fromEmail: "marco@bellissima.be",
      subject: "Demande devis pour pizzeria 80 couverts",
      bodyText:
        "Bonjour,\n\nNous ouvrons une nouvelle pizzeria de 80 couverts à Bruxelles et nous cherchons à équiper la cuisine. Il nous faudrait un four à pizza professionnel (gaz de préférence), une chambre froide positive, une plonge avec égouttoir, et deux tables de préparation inox.\n\nPouvez-vous me faire parvenir un devis ? Idéalement avant la fin du mois.\n\nMerci d'avance,\nMarco Rossi",
    },
    {
      externalId: "demo-msg-002",
      channel: "EMAIL" as const,
      fromName: "Sophie Laurent",
      fromEmail: "achats@etoiles.be",
      subject: "URGENT - lave-vaisselle ne fonctionne plus",
      bodyText:
        "Bonjour,\n\nNotre lave-vaisselle Winterhalter installé l'année dernière refuse de démarrer ce matin. Voyant rouge clignotant, le cycle ne se lance pas. Service au déjeuner dans 2h, c'est très problématique.\n\nMerci d'envoyer un technicien dès que possible.\n\nSophie",
    },
    {
      externalId: "demo-msg-003",
      channel: "WEB_FORM" as const,
      fromName: "Jan De Vries",
      fromEmail: "jan@hetcafe.be",
      subject: "Beschikbaarheid biertap 3 wegen",
      bodyText:
        "Beste,\n\nIk wil graag weten of jullie de biertap met 3 wegen op voorraad hebben, en wat de levertijd is naar Gent.\n\nMet vriendelijke groeten,\nJan",
    },
  ];
  for (const s of inboxSamples) {
    await prisma.inboxItem.upsert({
      where: { externalId: s.externalId },
      update: {},
      create: s,
    });
  }

  console.log("Seed terminé. Login: admin@horeca.local / demo1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

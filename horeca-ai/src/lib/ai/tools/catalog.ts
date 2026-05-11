import { prisma } from "@/lib/db";
import { toDecimal } from "@/lib/utils";
import type { ToolDef } from "@/lib/ai/types";

interface SearchInput {
  query: string;
  category?: string;
  limit?: number;
}

interface SearchResultItem {
  id: string;
  sku: string;
  name: string;
  shortDesc: string | null;
  brand: string | null;
  category: string | null;
  priceHT: number;
  vatRate: number;
  stockQty: number;
  unit: string;
  attrs?: Record<string, unknown> | null;
}

export const searchProductsTool: ToolDef<SearchInput, SearchResultItem[]> = {
  name: "search_products",
  description:
    "Recherche dans le catalogue produits HoReCa. Utilise des mots-clés en français (ex: 'four à pizza gaz', 'chambre froide positive', 'plonge inox'). Retourne au maximum `limit` produits actifs avec prix HT, stock et marque.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Termes de recherche en français (catégorie, marque, caractéristiques)",
      },
      category: {
        type: "string",
        description: "Slug optionnel de catégorie: cuisson, froid, lavage, mobilier, bar, buffet, pieces",
      },
      limit: { type: "number", description: "Nombre max de résultats (défaut 8, max 20)" },
    },
    required: ["query"],
  },
  handler: async (input) => {
    const limit = Math.min(Math.max(input.limit ?? 8, 1), 20);
    const terms = input.query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 1);

    const products = await prisma.product.findMany({
      where: {
        active: true,
        ...(input.category ? { category: { slug: input.category } } : {}),
        AND: terms.map((term) => ({
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { shortDesc: { contains: term, mode: "insensitive" } },
            { longDesc: { contains: term, mode: "insensitive" } },
            { sku: { contains: term, mode: "insensitive" } },
            { brand: { name: { contains: term, mode: "insensitive" } } },
            { category: { name: { contains: term, mode: "insensitive" } } },
          ],
        })),
      },
      include: { brand: true, category: true },
      take: limit,
      orderBy: [{ stockQty: "desc" }, { name: "asc" }],
    });

    return products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      shortDesc: p.shortDesc,
      brand: p.brand?.name ?? null,
      category: p.category?.name ?? null,
      priceHT: toDecimal(p.priceHT),
      vatRate: toDecimal(p.vatRate),
      stockQty: p.stockQty,
      unit: p.unit,
      attrs: (p.attrs as Record<string, unknown> | null) ?? null,
    }));
  },
};

interface GetByIdsInput {
  ids: string[];
}

export const getProductsByIdsTool: ToolDef<GetByIdsInput, SearchResultItem[]> = {
  name: "get_products_by_ids",
  description: "Récupère plusieurs produits par leur id pour vérification avant ajout au devis.",
  input_schema: {
    type: "object",
    properties: {
      ids: { type: "array", items: { type: "string" } },
    },
    required: ["ids"],
  },
  handler: async (input) => {
    const products = await prisma.product.findMany({
      where: { id: { in: input.ids }, active: true },
      include: { brand: true, category: true },
    });
    return products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      shortDesc: p.shortDesc,
      brand: p.brand?.name ?? null,
      category: p.category?.name ?? null,
      priceHT: toDecimal(p.priceHT),
      vatRate: toDecimal(p.vatRate),
      stockQty: p.stockQty,
      unit: p.unit,
      attrs: (p.attrs as Record<string, unknown> | null) ?? null,
    }));
  },
};

import { prisma } from "@/lib/db";
import { fromDecimal } from "@/lib/utils";
import type { Cart } from "@/lib/cart";

export interface HydratedItem {
  sku: string;
  qty: number;
  slug: string;
  name: string;
  imageUrl: string | null;
  unitPriceHT: number;
  unitPriceTTC: number;
  vatRate: number;
  stockQty: number;
}

export interface HydratedCart {
  items: HydratedItem[];
  subtotalHT: number;
  totalVAT: number;
  totalTTC: number;
}

export async function hydrateCart(cart: Cart): Promise<HydratedCart> {
  if (cart.items.length === 0) {
    return { items: [], subtotalHT: 0, totalVAT: 0, totalTTC: 0 };
  }
  const products = await prisma.product.findMany({
    where: { sku: { in: cart.items.map((i) => i.sku) }, active: true },
    include: { images: { orderBy: { position: "asc" }, take: 1 } },
  });
  const bySku = new Map(products.map((p) => [p.sku, p]));

  let subtotalHT = 0;
  let totalVAT = 0;
  const items: HydratedItem[] = [];
  for (const ci of cart.items) {
    const p = bySku.get(ci.sku);
    if (!p) continue;
    const ht = fromDecimal(p.priceHT);
    const vat = fromDecimal(p.vatRate);
    const lineHT = ht * ci.qty;
    const lineVAT = lineHT * (vat / 100);
    subtotalHT += lineHT;
    totalVAT += lineVAT;
    items.push({
      sku: p.sku,
      qty: ci.qty,
      slug: p.slug,
      name: p.name,
      imageUrl: p.images[0]?.url ?? null,
      unitPriceHT: ht,
      unitPriceTTC: ht * (1 + vat / 100),
      vatRate: vat,
      stockQty: p.stockQty,
    });
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    items,
    subtotalHT: r2(subtotalHT),
    totalVAT: r2(totalVAT),
    totalTTC: r2(subtotalHT + totalVAT),
  };
}

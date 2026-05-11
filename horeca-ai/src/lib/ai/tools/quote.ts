import { z } from "zod";
import { prisma } from "@/lib/db";
import { recomputeQuoteTotals } from "@/server/quote.service";
import type { ToolDef } from "@/lib/ai/types";

/**
 * The quote agent uses a single tool to commit a draft of suggested lines into a Quote.
 * Customer rattachment can be left null: the user finalises that in the UI.
 */

const proposalSchema = z.object({
  quoteId: z.string(),
  notes: z.string().optional(),
  lines: z
    .array(
      z.object({
        productId: z.string().optional(),
        customLabel: z.string().optional(),
        description: z.string().optional(),
        qty: z.number().positive(),
        unitPriceHT: z.number().nonnegative().optional(),
        discountPct: z.number().min(0).max(100).optional(),
        vatRate: z.number().nonnegative().optional(),
      }),
    )
    .min(1)
    .max(50),
});

type Proposal = z.infer<typeof proposalSchema>;

interface ProposalResult {
  quoteId: string;
  totalHT: number;
  totalTTC: number;
  lineCount: number;
}

export const proposeQuoteLinesTool: ToolDef<Proposal, ProposalResult> = {
  name: "propose_quote_lines",
  description:
    "Inscrit une proposition complète de lignes de devis. Toutes les lignes précédentes marquées aiSuggested sont remplacées. Utilise toujours `productId` si tu as récupéré le produit via search_products. Tu peux ajouter une ligne personnalisée (sans productId) en fournissant `customLabel` (ex: 'Installation et mise en service'). Les prix unitaires HT sont automatiquement repris du catalogue si productId est fourni et `unitPriceHT` est omis.",
  mutates: true,
  input_schema: {
    type: "object",
    properties: {
      quoteId: { type: "string", description: "Id du devis en cours de rédaction" },
      notes: { type: "string", description: "Note interne facultative pour le commercial" },
      lines: {
        type: "array",
        items: {
          type: "object",
          properties: {
            productId: { type: "string", description: "Id du produit catalogue" },
            customLabel: { type: "string", description: "Libellé pour ligne sans produit (service, frais)" },
            description: { type: "string", description: "Description longue optionnelle" },
            qty: { type: "number", description: "Quantité (positive)" },
            unitPriceHT: { type: "number", description: "Prix unitaire HT (sinon repris du catalogue)" },
            discountPct: { type: "number", description: "Remise en %, 0-100" },
            vatRate: { type: "number", description: "Taux de TVA (sinon 21 ou taux produit)" },
          },
          required: ["qty"],
        },
      },
    },
    required: ["quoteId", "lines"],
  },
  handler: async (rawInput, ctx) => {
    const input = proposalSchema.parse(rawInput);

    const quote = await prisma.quote.findUnique({
      where: { id: input.quoteId },
      include: { author: true },
    });
    if (!quote) throw new Error("Devis introuvable");
    if (quote.authorId !== ctx.userId) {
      throw new Error("Vous n'avez pas accès à ce devis");
    }

    // Pull all referenced products in one query
    const productIds = input.lines
      .map((l) => l.productId)
      .filter((id): id is string => Boolean(id));
    const products = productIds.length
      ? await prisma.product.findMany({
          where: { id: { in: productIds }, active: true },
        })
      : [];
    const byId = new Map(products.map((p) => [p.id, p]));

    await prisma.$transaction(async (tx) => {
      await tx.quoteLine.deleteMany({
        where: { quoteId: input.quoteId, aiSuggested: true },
      });

      const lineCount = await tx.quoteLine.count({ where: { quoteId: input.quoteId } });
      let position = lineCount;

      for (const line of input.lines) {
        const product = line.productId ? byId.get(line.productId) : undefined;
        if (line.productId && !product) continue; // skip unknown product
        const unitPriceHT =
          line.unitPriceHT ??
          (product ? Number(product.priceHT.toString()) : undefined);
        if (unitPriceHT === undefined) continue;
        const vatRate =
          line.vatRate ?? (product ? Number(product.vatRate.toString()) : 21);
        await tx.quoteLine.create({
          data: {
            quoteId: input.quoteId,
            productId: line.productId,
            customLabel: line.customLabel,
            description: line.description,
            qty: line.qty,
            unitPriceHT,
            discountPct: line.discountPct ?? 0,
            vatRate,
            position: position++,
            aiSuggested: true,
          },
        });
      }

      if (input.notes !== undefined) {
        await tx.quote.update({
          where: { id: input.quoteId },
          data: { notes: input.notes },
        });
      }
    });

    const totals = await recomputeQuoteTotals(input.quoteId);
    const count = await prisma.quoteLine.count({ where: { quoteId: input.quoteId } });
    return {
      quoteId: input.quoteId,
      totalHT: totals.totalHT,
      totalTTC: totals.totalTTC,
      lineCount: count,
    };
  },
};

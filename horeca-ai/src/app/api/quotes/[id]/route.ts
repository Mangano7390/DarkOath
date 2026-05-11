import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getQuote, recomputeQuoteTotals } from "@/server/quote.service";
import { logAudit } from "@/lib/audit";

const lineUpdateSchema = z.object({
  id: z.string().optional(),
  productId: z.string().nullable().optional(),
  customLabel: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  qty: z.number().positive(),
  unitPriceHT: z.number().nonnegative(),
  discountPct: z.number().min(0).max(100).default(0),
  vatRate: z.number().nonnegative().default(21),
  position: z.number().int().nonnegative().default(0),
});

const updateSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"]).optional(),
  notes: z.string().nullable().optional(),
  validUntil: z.string().datetime().nullable().optional(),
  lines: z.array(lineUpdateSchema).optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const quote = await getQuote(id, session.user.id);
  if (!quote) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ quote });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const existing = await prisma.quote.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (existing.authorId !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", details: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    if (parsed.data.lines) {
      await tx.quoteLine.deleteMany({ where: { quoteId: id } });
      for (const [i, line] of parsed.data.lines.entries()) {
        await tx.quoteLine.create({
          data: {
            quoteId: id,
            productId: line.productId ?? undefined,
            customLabel: line.customLabel ?? undefined,
            description: line.description ?? undefined,
            qty: line.qty,
            unitPriceHT: line.unitPriceHT,
            discountPct: line.discountPct,
            vatRate: line.vatRate,
            position: line.position ?? i,
            aiSuggested: false,
          },
        });
      }
    }
    await tx.quote.update({
      where: { id },
      data: {
        status: parsed.data.status,
        notes: parsed.data.notes ?? undefined,
        validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : undefined,
      },
    });
  });
  await recomputeQuoteTotals(id);

  await logAudit({
    userId: session.user.id,
    action: "quote.update",
    entity: "Quote",
    entityId: id,
    meta: { fields: Object.keys(parsed.data) },
  });

  const quote = await getQuote(id, session.user.id);
  return NextResponse.json({ quote });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const q = await prisma.quote.findUnique({ where: { id } });
  if (!q) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (q.authorId !== session.user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await prisma.quote.delete({ where: { id } });
  await logAudit({
    userId: session.user.id,
    action: "quote.delete",
    entity: "Quote",
    entityId: id,
  });
  return NextResponse.json({ ok: true });
}

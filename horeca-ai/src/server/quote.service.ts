import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { toDecimal } from "@/lib/utils";

export async function nextQuoteNumber(): Promise<string> {
  const rows = await prisma.$queryRaw<{ nextval: bigint }[]>(
    Prisma.sql`SELECT nextval('quote_seq')`,
  );
  const n = rows[0]?.nextval ?? BigInt(1000);
  const year = new Date().getFullYear();
  return `DEV-${year}-${n.toString().padStart(5, "0")}`;
}

export async function createDraftQuote(args: {
  customerId: string;
  authorId: string;
  prompt?: string;
}) {
  const number = await nextQuoteNumber();
  return prisma.quote.create({
    data: {
      number,
      customerId: args.customerId,
      authorId: args.authorId,
      prompt: args.prompt,
      status: "DRAFT",
      validUntil: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    },
    include: { lines: { include: { product: true } }, customer: true },
  });
}

export async function recomputeQuoteTotals(quoteId: string) {
  const lines = await prisma.quoteLine.findMany({ where: { quoteId } });
  let totalHT = 0;
  let totalTTC = 0;
  for (const l of lines) {
    const qty = toDecimal(l.qty);
    const unit = toDecimal(l.unitPriceHT);
    const discount = toDecimal(l.discountPct) / 100;
    const lineHT = qty * unit * (1 - discount);
    const lineTTC = lineHT * (1 + toDecimal(l.vatRate) / 100);
    totalHT += lineHT;
    totalTTC += lineTTC;
  }
  const round2 = (n: number) => Math.round(n * 100) / 100;
  await prisma.quote.update({
    where: { id: quoteId },
    data: {
      totalHT: round2(totalHT),
      totalTTC: round2(totalTTC),
    },
  });
  return { totalHT: round2(totalHT), totalTTC: round2(totalTTC) };
}

export async function getQuote(id: string, authorId?: string) {
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { position: "asc" }, include: { product: true } },
      customer: true,
      author: { select: { id: true, name: true, email: true } },
    },
  });
  if (!quote) return null;
  if (authorId && quote.authorId !== authorId) return null;
  return quote;
}

export async function listQuotes(authorId: string) {
  return prisma.quote.findMany({
    where: { authorId },
    include: { customer: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

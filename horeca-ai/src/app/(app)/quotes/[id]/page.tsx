import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getQuote } from "@/server/quote.service";
import { QuoteWorkspace } from "@/components/quote/QuoteWorkspace";
import { toDecimal } from "@/lib/utils";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ autorun?: string }>;
}

export default async function QuoteDetailPage({ params, searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) return null;
  const { id } = await params;
  const sp = await searchParams;
  const quote = await getQuote(id, session.user.id);
  if (!quote) notFound();

  const initial = {
    id: quote.id,
    number: quote.number,
    status: quote.status,
    notes: quote.notes,
    prompt: quote.prompt,
    totalHT: toDecimal(quote.totalHT),
    totalTTC: toDecimal(quote.totalTTC),
    validUntil: quote.validUntil?.toISOString() ?? null,
    customer: {
      id: quote.customer.id,
      companyName: quote.customer.companyName,
      email: quote.customer.email,
      city: quote.customer.city,
    },
    lines: quote.lines.map((l) => ({
      id: l.id,
      productId: l.productId,
      productSku: l.product?.sku ?? null,
      productName: l.product?.name ?? null,
      customLabel: l.customLabel,
      description: l.description,
      qty: toDecimal(l.qty),
      unitPriceHT: toDecimal(l.unitPriceHT),
      discountPct: toDecimal(l.discountPct),
      vatRate: toDecimal(l.vatRate),
      position: l.position,
      aiSuggested: l.aiSuggested,
    })),
  };

  return <QuoteWorkspace initial={initial} autorun={sp.autorun === "1"} />;
}

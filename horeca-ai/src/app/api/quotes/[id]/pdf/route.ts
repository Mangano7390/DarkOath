import { auth } from "@/lib/auth";
import { getQuote } from "@/server/quote.service";
import { renderQuotePdf } from "@/lib/pdf";
import { logAudit } from "@/lib/audit";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const quote = await getQuote(id, session.user.id);
  if (!quote) return new Response("Not found", { status: 404 });

  const buffer = await renderQuotePdf(quote);
  await logAudit({
    userId: session.user.id,
    action: "quote.pdf",
    entity: "Quote",
    entityId: id,
  });

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quote.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

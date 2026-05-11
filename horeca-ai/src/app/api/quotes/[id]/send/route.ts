import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getQuote } from "@/server/quote.service";
import { renderQuotePdf } from "@/lib/pdf";
import { sendMail } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { sanitizeText } from "@/lib/sanitize";

const sendSchema = z.object({
  to: z.string().email().optional(),
  subject: z.string().max(200).optional(),
  message: z.string().max(8000).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const quote = await getQuote(id, session.user.id);
  if (!quote) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (quote.lines.length === 0) {
    return NextResponse.json({ error: "empty_quote" }, { status: 400 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // empty body acceptable
  }
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", details: parsed.error.flatten() }, { status: 400 });
  }

  const to = parsed.data.to ?? quote.customer.email;
  if (!to) return NextResponse.json({ error: "no_recipient" }, { status: 400 });

  const subject = parsed.data.subject ?? `Votre devis ${quote.number}`;
  const message =
    parsed.data.message ??
    `Bonjour ${quote.customer.contactName ?? quote.customer.companyName},\n\nVeuillez trouver ci-joint le devis ${quote.number} suite à votre demande.\nNous restons à votre disposition pour toute question.\n\nCordialement,\n${session.user.name}`;

  const pdf = await renderQuotePdf(quote);

  await sendMail({
    to,
    subject: sanitizeText(subject, 200),
    text: sanitizeText(message, 8000),
    attachments: [{ filename: `${quote.number}.pdf`, content: pdf, contentType: "application/pdf" }],
  });

  await prisma.quote.update({
    where: { id },
    data: { status: "SENT", sentAt: new Date() },
  });
  await logAudit({
    userId: session.user.id,
    action: "quote.send",
    entity: "Quote",
    entityId: id,
    meta: { to },
  });

  return NextResponse.json({ ok: true, to });
}

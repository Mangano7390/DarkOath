import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/email";
import { sanitizeText } from "@/lib/sanitize";
import { logAudit } from "@/lib/audit";

const sendSchema = z.object({
  to: z.string().email().optional(),
  subject: z.string().max(200).optional(),
  body: z.string().min(1).max(20000).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const item = await prisma.inboxItem.findUnique({
    where: { id },
    include: { customer: true },
  });
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    /* empty body acceptable */
  }
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", details: parsed.error.flatten() }, { status: 400 });
  }

  const to = parsed.data.to ?? item.fromEmail ?? item.customer?.email;
  if (!to) return NextResponse.json({ error: "no_recipient" }, { status: 400 });

  const subject = sanitizeText(parsed.data.subject ?? (item.subject ? `Re: ${item.subject}` : "Votre demande"), 200);
  const text = sanitizeText(parsed.data.body ?? item.draftReply ?? "", 20000);
  if (!text || text.length < 5) {
    return NextResponse.json({ error: "empty_body" }, { status: 400 });
  }

  await sendMail({ to, subject, text });
  await prisma.inboxItem.update({
    where: { id },
    data: { status: "SENT", sentAt: new Date() },
  });
  await logAudit({
    userId: session.user.id,
    action: "inbox.send",
    entity: "InboxItem",
    entityId: id,
    meta: { to },
  });
  return NextResponse.json({ ok: true, to });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getInbox } from "@/server/inbox.service";
import { sanitizeText } from "@/lib/sanitize";
import { logAudit } from "@/lib/audit";

const patchSchema = z.object({
  status: z.enum(["NEW", "DRAFTED", "SENT", "CLOSED"]).optional(),
  category: z.enum(["QUOTE_REQUEST", "SAV", "AVAILABILITY", "PRODUCT_INFO", "OTHER"]).nullable().optional(),
  draftReply: z.string().max(20000).nullable().optional(),
  subject: z.string().max(300).nullable().optional(),
  customerId: z.string().nullable().optional(),
  assignedToId: z.string().nullable().optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const item = await getInbox(id);
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ item });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const existing = await prisma.inboxItem.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", details: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.inboxItem.update({
    where: { id },
    data: {
      status: parsed.data.status,
      category: parsed.data.category === null ? null : parsed.data.category,
      draftReply:
        parsed.data.draftReply === null
          ? null
          : parsed.data.draftReply !== undefined
            ? sanitizeText(parsed.data.draftReply, 20000)
            : undefined,
      subject:
        parsed.data.subject === null
          ? null
          : parsed.data.subject !== undefined
            ? sanitizeText(parsed.data.subject, 300)
            : undefined,
      customerId: parsed.data.customerId === null ? null : parsed.data.customerId,
      assignedToId: parsed.data.assignedToId === null ? null : parsed.data.assignedToId,
    },
  });
  await logAudit({
    userId: session.user.id,
    action: "inbox.update",
    entity: "InboxItem",
    entityId: id,
    meta: { fields: Object.keys(parsed.data) },
  });
  return NextResponse.json({ item: updated });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  await prisma.inboxItem.delete({ where: { id } });
  await logAudit({
    userId: session.user.id,
    action: "inbox.delete",
    entity: "InboxItem",
    entityId: id,
  });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sanitizeText } from "@/lib/sanitize";
import { logAudit } from "@/lib/audit";
import { listInbox } from "@/server/inbox.service";

const createSchema = z.object({
  channel: z.enum(["EMAIL", "WEB_FORM", "PHONE_NOTE"]).default("EMAIL"),
  fromEmail: z.string().email().optional(),
  fromName: z.string().max(200).optional(),
  subject: z.string().max(300).optional(),
  bodyText: z.string().min(5).max(20000),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const items = await listInbox({
    status: (status as "NEW" | "DRAFTED" | "SENT" | "CLOSED" | null) ?? undefined,
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", details: parsed.error.flatten() }, { status: 400 });
  }
  const item = await prisma.inboxItem.create({
    data: {
      channel: parsed.data.channel,
      fromEmail: parsed.data.fromEmail ?? null,
      fromName: parsed.data.fromName ? sanitizeText(parsed.data.fromName, 200) : null,
      subject: parsed.data.subject ? sanitizeText(parsed.data.subject, 300) : null,
      bodyText: sanitizeText(parsed.data.bodyText, 20000),
      status: "NEW",
    },
  });
  await logAudit({
    userId: session.user.id,
    action: "inbox.create",
    entity: "InboxItem",
    entityId: item.id,
    meta: { channel: item.channel },
  });
  return NextResponse.json({ item });
}

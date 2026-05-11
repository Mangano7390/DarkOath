import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createDraftQuote, listQuotes } from "@/server/quote.service";
import { logAudit } from "@/lib/audit";
import { sanitizeText } from "@/lib/sanitize";

const createSchema = z.object({
  customerId: z.string().min(1),
  prompt: z.string().max(4000).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const quotes = await listQuotes(session.user.id);
  return NextResponse.json({ quotes });
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

  const customer = await prisma.customer.findUnique({ where: { id: parsed.data.customerId } });
  if (!customer) return NextResponse.json({ error: "customer_not_found" }, { status: 404 });

  const quote = await createDraftQuote({
    customerId: parsed.data.customerId,
    authorId: session.user.id,
    prompt: parsed.data.prompt ? sanitizeText(parsed.data.prompt) : undefined,
  });

  await logAudit({
    userId: session.user.id,
    action: "quote.create",
    entity: "Quote",
    entityId: quote.id,
    meta: { customerId: parsed.data.customerId },
  });

  return NextResponse.json({ quote });
}

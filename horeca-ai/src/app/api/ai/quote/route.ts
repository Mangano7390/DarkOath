import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { logAudit } from "@/lib/audit";
import { sanitizeText } from "@/lib/sanitize";
import { runAgent, streamAgentToSSE } from "@/lib/ai/stream";
import { QUOTE_AGENT_SYSTEM_PROMPT, quoteAgentTools } from "@/lib/ai/agents/quoteAgent";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  quoteId: z.string().min(1),
  prompt: z.string().min(3).max(4000),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const rl = rateLimit(`ai:${session.user.id}`);
  if (!rl.ok) {
    return new Response("Too Many Requests", {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) },
    });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return new Response("Validation error", { status: 400 });
  }
  const prompt = sanitizeText(parsed.data.prompt, 4000);

  const quote = await prisma.quote.findUnique({
    where: { id: parsed.data.quoteId },
    include: { customer: true },
  });
  if (!quote) return new Response("Not found", { status: 404 });
  if (quote.authorId !== session.user.id) return new Response("Forbidden", { status: 403 });

  // Find or create conversation tied to this quote
  let conversationId = quote.conversationId;
  if (!conversationId) {
    const conv = await prisma.conversation.create({
      data: { kind: "QUOTE", userId: session.user.id, title: `Devis ${quote.number}` },
    });
    conversationId = conv.id;
    await prisma.quote.update({ where: { id: quote.id }, data: { conversationId } });
  }

  const moduleSetting = await prisma.moduleSetting.findUnique({ where: { module: "QUOTE" } });
  // Approval is enforced on send/PDF, not on the proposal step itself.
  const approvalRequired: string[] = [];

  await prisma.message.create({
    data: {
      conversationId,
      role: "USER",
      content: [{ type: "text", text: prompt }] as object,
    },
  });

  await logAudit({
    userId: session.user.id,
    action: "ai.quote.prompt",
    entity: "Quote",
    entityId: quote.id,
    meta: { promptLength: prompt.length, hitlEnabled: moduleSetting?.requiresApproval ?? false },
  });

  const customerSummary = [
    `Client: ${quote.customer.companyName}`,
    quote.customer.segment ? `Segment: ${quote.customer.segment}` : "",
    quote.customer.city ? `Ville: ${quote.customer.city}` : "",
  ]
    .filter(Boolean)
    .join(" — ");

  const userMessage = [
    customerSummary,
    `Devis en cours: ${quote.number} (id=${quote.id})`,
    "",
    "Brief commercial:",
    prompt,
  ].join("\n");

  return streamAgentToSSE(async (emit) => {
    const assistantText: string[] = [];

    await runAgent({
      systemPrompt: QUOTE_AGENT_SYSTEM_PROMPT,
      tools: quoteAgentTools,
      approvalRequired,
      context: {
        userId: session.user!.id,
        conversationId,
        locale: session.user!.locale ?? "fr",
      },
      initialMessages: [{ role: "user", content: userMessage }],
      onEvent: (e) => {
        if (e.type === "text") assistantText.push(e.delta);
        emit(e);
      },
    });

    await prisma.message.create({
      data: {
        conversationId: conversationId!,
        role: "ASSISTANT",
        content: [{ type: "text", text: assistantText.join("") }] as object,
      },
    });
  });
}

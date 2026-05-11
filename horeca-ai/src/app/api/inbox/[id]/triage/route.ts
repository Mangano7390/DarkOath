import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { logAudit } from "@/lib/audit";
import { runAgent, streamAgentToSSE } from "@/lib/ai/stream";
import { TRIAGE_AGENT_SYSTEM_PROMPT, triageAgentTools } from "@/lib/ai/agents/triageAgent";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const rl = rateLimit(`ai:${session.user.id}`);
  if (!rl.ok) {
    return new Response("Too Many Requests", {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) },
    });
  }
  const { id } = await ctx.params;
  const item = await prisma.inboxItem.findUnique({
    where: { id },
    include: { customer: true },
  });
  if (!item) return new Response("Not found", { status: 404 });

  let conversationId = item.conversationId;
  if (!conversationId) {
    const conv = await prisma.conversation.create({
      data: {
        kind: "TRIAGE",
        userId: session.user.id,
        title: item.subject ?? `Email de ${item.fromEmail ?? "inconnu"}`,
      },
    });
    conversationId = conv.id;
    await prisma.inboxItem.update({ where: { id }, data: { conversationId } });
  }

  await logAudit({
    userId: session.user.id,
    action: "ai.inbox.triage",
    entity: "InboxItem",
    entityId: id,
  });

  const promptParts = [
    `Email entrant à trier (id=${item.id})`,
    `Canal: ${item.channel}`,
    item.fromName ? `Expéditeur: ${item.fromName}${item.fromEmail ? ` <${item.fromEmail}>` : ""}` : item.fromEmail ? `Expéditeur: ${item.fromEmail}` : "",
    item.subject ? `Sujet: ${item.subject}` : "Sujet: (aucun)",
    "",
    "Contenu :",
    item.bodyText,
  ].filter(Boolean);

  return streamAgentToSSE(async (emit) => {
    const assistantText: string[] = [];
    await runAgent({
      systemPrompt: TRIAGE_AGENT_SYSTEM_PROMPT,
      tools: triageAgentTools,
      context: {
        userId: session.user!.id,
        conversationId,
        locale: session.user!.locale ?? "fr",
      },
      initialMessages: [{ role: "user", content: promptParts.join("\n") }],
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

import { z } from "zod";
import { prisma } from "@/lib/db";
import { sanitizeText } from "@/lib/sanitize";
import type { ToolDef } from "@/lib/ai/types";

const CATEGORIES = ["QUOTE_REQUEST", "SAV", "AVAILABILITY", "PRODUCT_INFO", "OTHER"] as const;
const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

const classificationSchema = z.object({
  itemId: z.string(),
  category: z.enum(CATEGORIES),
  customerId: z.string().nullable().optional(),
  priority: z.enum(PRIORITIES).default("NORMAL"),
  summary: z.string().min(3).max(600),
});

type ClassificationInput = z.infer<typeof classificationSchema>;
type ClassificationResult = { itemId: string; category: string; customerId: string | null };

export const setClassificationTool: ToolDef<ClassificationInput, ClassificationResult> = {
  name: "set_classification",
  description:
    "Classe l'email entrant dans la bonne catégorie et le rattache à un client si pertinent. Catégories valides : QUOTE_REQUEST (demande de devis), SAV (panne ou intervention), AVAILABILITY (dispo produit/délai), PRODUCT_INFO (renseignement caractéristiques), OTHER. Le `summary` est un résumé interne de 1-2 phrases en français destiné à l'équipe.",
  mutates: true,
  input_schema: {
    type: "object",
    properties: {
      itemId: { type: "string" },
      category: { type: "string", enum: [...CATEGORIES] },
      customerId: { type: "string", description: "Id de client trouvé via search_customers, sinon omettre" },
      priority: { type: "string", enum: [...PRIORITIES] },
      summary: { type: "string", description: "Résumé interne 1-2 phrases en français" },
    },
    required: ["itemId", "category", "summary"],
  },
  handler: async (raw, ctx) => {
    const input = classificationSchema.parse(raw);
    const item = await prisma.inboxItem.findUnique({ where: { id: input.itemId } });
    if (!item) throw new Error("InboxItem introuvable");
    if (item.assignedToId && item.assignedToId !== ctx.userId) {
      // Allow re-classification only if unassigned or assigned to current user
      throw new Error("Email assigné à un autre utilisateur");
    }
    if (input.customerId) {
      const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
      if (!customer) throw new Error("Client introuvable");
    }
    const updated = await prisma.inboxItem.update({
      where: { id: input.itemId },
      data: {
        category: input.category,
        customerId: input.customerId ?? null,
      },
    });
    // Store summary as the start of draftReply prefix is wrong — keep summary in a system note.
    // We'll surface it via the conversation message instead. Return for the agent to display.
    return { itemId: updated.id, category: updated.category ?? input.category, customerId: updated.customerId };
  },
};

const draftSchema = z.object({
  itemId: z.string(),
  subject: z.string().min(2).max(200),
  body: z.string().min(20).max(8000),
});

type DraftInput = z.infer<typeof draftSchema>;
type DraftResult = { itemId: string; preview: string };

export const writeDraftTool: ToolDef<DraftInput, DraftResult> = {
  name: "write_draft_reply",
  description:
    "Rédige le brouillon de réponse au client. Doit être écrit dans la langue du message entrant. Ton commercial, courtois, concis. Termine par une signature simple (le commercial ajoutera la sienne). N'invente AUCUN prix, délai, ou disponibilité précise — propose plutôt de revenir vers le client avec ces informations. Le `body` est en texte brut (les retours à la ligne sont conservés).",
  mutates: true,
  input_schema: {
    type: "object",
    properties: {
      itemId: { type: "string" },
      subject: { type: "string" },
      body: { type: "string", description: "Corps de la réponse en texte brut" },
    },
    required: ["itemId", "subject", "body"],
  },
  handler: async (raw, ctx) => {
    const input = draftSchema.parse(raw);
    const subject = sanitizeText(input.subject, 200);
    const body = sanitizeText(input.body, 8000);
    const item = await prisma.inboxItem.findUnique({ where: { id: input.itemId } });
    if (!item) throw new Error("InboxItem introuvable");
    if (item.assignedToId && item.assignedToId !== ctx.userId) {
      throw new Error("Email assigné à un autre utilisateur");
    }
    await prisma.inboxItem.update({
      where: { id: input.itemId },
      data: {
        subject: item.subject ?? subject,
        draftReply: body,
        status: "DRAFTED",
      },
    });
    return { itemId: input.itemId, preview: body.slice(0, 200) };
  },
};

const ROLE_TARGETS = ["COMMERCIAL", "TECHNICIAN", "LOGISTICS", "ADMIN"] as const;

const escalateSchema = z.object({
  itemId: z.string(),
  targetRole: z.enum(ROLE_TARGETS),
  reason: z.string().min(3).max(500),
});

type EscalateInput = z.infer<typeof escalateSchema>;
type EscalateResult = { itemId: string; assignedToId: string | null; assignedToName: string | null };

export const escalateTool: ToolDef<EscalateInput, EscalateResult> = {
  name: "escalate_to",
  description:
    "Assigne l'email à un collaborateur en fonction de la catégorie. Règles : SAV -> TECHNICIAN, livraison/délai -> LOGISTICS, demande devis ou info produit -> COMMERCIAL, hors-sujet -> ADMIN. Choisit automatiquement un utilisateur actif de ce rôle. La `reason` doit justifier brièvement le choix.",
  mutates: true,
  input_schema: {
    type: "object",
    properties: {
      itemId: { type: "string" },
      targetRole: { type: "string", enum: [...ROLE_TARGETS] },
      reason: { type: "string" },
    },
    required: ["itemId", "targetRole", "reason"],
  },
  handler: async (raw) => {
    const input = escalateSchema.parse(raw);
    const user = await prisma.user.findFirst({
      where: { role: input.targetRole, active: true },
      orderBy: { createdAt: "asc" },
    });
    const updated = await prisma.inboxItem.update({
      where: { id: input.itemId },
      data: { assignedToId: user?.id ?? null },
      include: { assignedTo: true },
    });
    return {
      itemId: updated.id,
      assignedToId: updated.assignedToId,
      assignedToName: updated.assignedTo?.name ?? null,
    };
  },
};

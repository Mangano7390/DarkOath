import { prisma } from "@/lib/db";
import type { ToolDef } from "@/lib/ai/types";

interface SearchCustomerInput {
  query: string;
  limit?: number;
}

interface CustomerLite {
  id: string;
  code: string;
  companyName: string;
  contactName: string | null;
  email: string | null;
  city: string | null;
  segment: string;
}

export const searchCustomersTool: ToolDef<SearchCustomerInput, CustomerLite[]> = {
  name: "search_customers",
  description:
    "Recherche un client existant par nom d'entreprise, code, ville ou email. Utile pour rattacher un devis à un client connu.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string" },
      limit: { type: "number" },
    },
    required: ["query"],
  },
  handler: async (input) => {
    const limit = Math.min(Math.max(input.limit ?? 5, 1), 20);
    const q = input.query.trim();
    if (!q) return [];
    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { companyName: { contains: q, mode: "insensitive" } },
          { code: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { city: { contains: q, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { companyName: "asc" },
    });
    return customers.map((c) => ({
      id: c.id,
      code: c.code,
      companyName: c.companyName,
      contactName: c.contactName,
      email: c.email,
      city: c.city,
      segment: c.segment,
    }));
  },
};

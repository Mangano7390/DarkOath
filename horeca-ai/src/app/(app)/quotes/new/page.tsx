import { prisma } from "@/lib/db";
import { NewQuoteForm } from "@/components/quote/NewQuoteForm";

export default async function NewQuotePage() {
  const customers = await prisma.customer.findMany({
    orderBy: { companyName: "asc" },
    take: 100,
  });
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nouveau devis</h1>
        <p className="text-sm text-muted-foreground">
          Sélectionnez le client puis décrivez le besoin en quelques phrases. L&apos;IA propose les références
          adéquates.
        </p>
      </div>
      <NewQuoteForm
        customers={customers.map((c) => ({
          id: c.id,
          companyName: c.companyName,
          city: c.city,
          segment: c.segment,
        }))}
      />
    </div>
  );
}

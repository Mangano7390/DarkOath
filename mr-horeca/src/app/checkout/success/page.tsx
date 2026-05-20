import Link from "next/link";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

interface PageProps {
  searchParams: Promise<{ order?: string; stub?: string }>;
}

function fmt(n: number) {
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(n);
}

export default async function SuccessPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const order = sp.order
    ? await prisma.order.findUnique({
        where: { number: sp.order },
        include: { items: true },
      })
    : null;

  return (
    <div className="container py-16 max-w-xl text-center">
      <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto mb-4" />
      <h1 className="text-3xl font-bold">Merci pour votre commande !</h1>
      {order ? (
        <>
          <p className="text-muted-foreground mt-2">
            Votre commande <span className="font-mono font-semibold">{order.number}</span> a bien été
            enregistrée pour un total de <strong>{fmt(Number(order.totalTTC))}</strong>.
          </p>
          {sp.stub === "1" ? (
            <p className="mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 text-left">
              Mode démo : Mollie n&apos;est pas configuré (MOLLIE_API_KEY manquant). En production,
              vous auriez été redirigé vers la page de paiement Bancontact / carte.
            </p>
          ) : (
            <p className="text-muted-foreground mt-2">
              Une confirmation par email vous a été envoyée. Nous préparons votre commande sous 24h.
            </p>
          )}
        </>
      ) : (
        <p className="text-muted-foreground mt-2">Commande introuvable.</p>
      )}
      <div className="mt-8">
        <Button asChild>
          <Link href="/">Retour à l&apos;accueil</Link>
        </Button>
      </div>
    </div>
  );
}

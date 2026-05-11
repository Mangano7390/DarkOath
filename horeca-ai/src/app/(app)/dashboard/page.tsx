import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Wrench,
  Inbox,
  BookOpen,
  BarChart3,
  Truck,
  PackageSearch,
  ArrowRight,
  Sparkles,
} from "lucide-react";

const modules = [
  {
    href: "/quotes",
    title: "Devis IA",
    description: "Générer un devis depuis un brief en langage naturel",
    icon: FileText,
    status: "live" as const,
  },
  {
    href: "/tickets",
    title: "SAV & diagnostic",
    description: "Chat de diagnostic technique avec RAG manuels",
    icon: Wrench,
    status: "soon" as const,
  },
  {
    href: "/inbox",
    title: "Boîte de réception",
    description: "Classification et brouillon de réponse automatique",
    icon: Inbox,
    status: "soon" as const,
  },
  {
    href: "/catalog",
    title: "Fiches produits",
    description: "Générateur de fiches multilingues FR/NL/EN",
    icon: BookOpen,
    status: "soon" as const,
  },
  {
    href: "/insights",
    title: "Analyses conversationnelles",
    description: "Questions en langage naturel sur les ventes",
    icon: BarChart3,
    status: "soon" as const,
  },
  {
    href: "/routes",
    title: "Tournées",
    description: "Optimisation des livraisons du jour",
    icon: Truck,
    status: "soon" as const,
  },
  {
    href: "/stock",
    title: "Alertes stock",
    description: "Réassort proactif et déstockage",
    icon: PackageSearch,
    status: "soon" as const,
  },
];

export default async function DashboardPage() {
  const session = await auth();
  const [quoteCount, ticketCount, productCount, customerCount] = await Promise.all([
    prisma.quote.count(),
    prisma.ticket.count(),
    prisma.product.count({ where: { active: true } }),
    prisma.customer.count(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bonjour {session?.user?.name?.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">
          7 assistants IA à votre disposition pour automatiser les tâches du quotidien.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Devis" value={quoteCount} />
        <StatTile label="Tickets SAV" value={ticketCount} />
        <StatTile label="Produits actifs" value={productCount} />
        <StatTile label="Clients" value={customerCount} />
      </div>

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Modules</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((m) => (
            <Card key={m.href} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-secondary p-2">
                      <m.icon className="h-4 w-4" />
                    </div>
                    <CardTitle>{m.title}</CardTitle>
                  </div>
                  {m.status === "live" ? (
                    <Badge variant="default" className="gap-1">
                      <Sparkles className="h-3 w-3" /> Actif
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Bientôt</Badge>
                  )}
                </div>
                <CardDescription className="pt-1">{m.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button asChild variant={m.status === "live" ? "default" : "outline"} size="sm" disabled={m.status !== "live"}>
                  <Link href={m.href} className={m.status !== "live" ? "pointer-events-none opacity-60" : ""}>
                    Ouvrir <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-2xl font-semibold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

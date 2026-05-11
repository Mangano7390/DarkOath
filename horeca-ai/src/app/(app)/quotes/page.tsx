import Link from "next/link";
import { auth } from "@/lib/auth";
import { listQuotes } from "@/server/quote.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, ExternalLink } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const statusVariant = {
  DRAFT: "secondary",
  SENT: "default",
  ACCEPTED: "default",
  REJECTED: "destructive",
  EXPIRED: "secondary",
} as const;

export default async function QuotesPage() {
  const session = await auth();
  if (!session?.user) return null;
  const quotes = await listQuotes(session.user.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Devis</h1>
          <p className="text-sm text-muted-foreground">Générez et gérez vos devis avec l&apos;assistant IA.</p>
        </div>
        <Button asChild>
          <Link href="/quotes/new">
            <Plus className="h-4 w-4" /> Nouveau devis
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mes devis récents</CardTitle>
          <CardDescription>{quotes.length} devis</CardDescription>
        </CardHeader>
        <CardContent>
          {quotes.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Aucun devis pour l&apos;instant. Cliquez sur « Nouveau devis » pour commencer.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Total HT</TableHead>
                  <TableHead>Créé le</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-xs">{q.number}</TableCell>
                    <TableCell>{q.customer.companyName}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[q.status]}>{q.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(q.totalHT.toString())}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{formatDate(q.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/quotes/${q.id}`}>
                          Ouvrir <ExternalLink className="h-3 w-3" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

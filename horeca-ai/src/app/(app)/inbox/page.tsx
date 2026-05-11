import Link from "next/link";
import { listInbox } from "@/server/inbox.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Sparkles } from "lucide-react";
import { formatDate } from "@/lib/utils";

const statusBadge: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  NEW: "destructive",
  DRAFTED: "secondary",
  SENT: "default",
  CLOSED: "outline",
};

const categoryLabel: Record<string, string> = {
  QUOTE_REQUEST: "Devis",
  SAV: "SAV",
  AVAILABILITY: "Dispo",
  PRODUCT_INFO: "Info produit",
  OTHER: "Autre",
};

export default async function InboxPage() {
  const items = await listInbox();
  const counts = items.reduce<Record<string, number>>((acc, it) => {
    acc[it.status] = (acc[it.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Boîte de réception</h1>
          <p className="text-sm text-muted-foreground">
            Triage automatique des demandes entrantes. Validation humaine avant envoi.
          </p>
        </div>
        <Button asChild>
          <Link href="/inbox/new">
            <Plus className="h-4 w-4" /> Nouvel email
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["NEW", "DRAFTED", "SENT", "CLOSED"] as const).map((s) => (
          <Card key={s}>
            <CardContent className="pt-6">
              <div className="text-2xl font-semibold">{counts[s] ?? 0}</div>
              <div className="text-xs text-muted-foreground">{s}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Demandes</CardTitle>
          <CardDescription>{items.length} email{items.length > 1 ? "s" : ""}</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Aucun email pour l&apos;instant. Cliquez sur « Nouvel email » pour en simuler un.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reçu</TableHead>
                  <TableHead>Expéditeur</TableHead>
                  <TableHead>Sujet</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Assigné</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="text-muted-foreground text-xs">{formatDate(it.receivedAt)}</TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{it.fromName ?? it.fromEmail ?? "—"}</div>
                      {it.customer ? (
                        <div className="text-xs text-muted-foreground">{it.customer.companyName}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate">{it.subject ?? "(sans sujet)"}</TableCell>
                    <TableCell>
                      {it.category ? (
                        <Badge variant="outline">{categoryLabel[it.category] ?? it.category}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadge[it.status] ?? "secondary"}>{it.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {it.assignedTo ? (
                        <span>{it.assignedTo.name}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/inbox/${it.id}`}>
                          {it.status === "NEW" ? (
                            <>
                              Trier <Sparkles className="h-3 w-3" />
                            </>
                          ) : (
                            "Ouvrir"
                          )}
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

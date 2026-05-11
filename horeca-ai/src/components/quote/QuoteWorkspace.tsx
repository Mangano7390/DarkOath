"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Sparkles,
  Loader2,
  Send,
  Plus,
  Trash2,
  FileDown,
  Mail,
  ArrowLeft,
  Wrench,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

export interface QuoteLineUI {
  id?: string;
  productId: string | null;
  productSku: string | null;
  productName: string | null;
  customLabel: string | null;
  description: string | null;
  qty: number;
  unitPriceHT: number;
  discountPct: number;
  vatRate: number;
  position: number;
  aiSuggested: boolean;
}

export interface QuoteUI {
  id: string;
  number: string;
  status: string;
  notes: string | null;
  prompt: string | null;
  totalHT: number;
  totalTTC: number;
  validUntil: string | null;
  customer: { id: string; companyName: string; email: string | null; city: string | null };
  lines: QuoteLineUI[];
}

interface ToolCallView {
  id: string;
  name: string;
  input?: unknown;
  result?: unknown;
  isError?: boolean;
}

export function QuoteWorkspace({ initial, autorun }: { initial: QuoteUI; autorun: boolean }) {
  const router = useRouter();
  const [quote, setQuote] = useState<QuoteUI>(initial);
  const [prompt, setPrompt] = useState(initial.prompt ?? "");
  const [running, setRunning] = useState(false);
  const [assistantText, setAssistantText] = useState("");
  const [toolCalls, setToolCalls] = useState<ToolCallView[]>([]);
  const [savePending, setSavePending] = useState(false);
  const [emailTo, setEmailTo] = useState(initial.customer.email ?? "");
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const autoRunDone = useRef(false);

  useEffect(() => {
    if (autorun && !autoRunDone.current && prompt.trim().length > 0) {
      autoRunDone.current = true;
      void runAgent(prompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autorun]);

  async function runAgent(p: string) {
    setRunning(true);
    setAssistantText("");
    setToolCalls([]);
    try {
      const res = await fetch("/api/ai/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: quote.id, prompt: p }),
      });
      if (!res.ok || !res.body) {
        setAssistantText(`Erreur: ${res.status} ${res.statusText}`);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            handleEvent(evt);
          } catch {
            /* ignore malformed */
          }
        }
      }
      // refresh quote from server
      const fresh = await fetch(`/api/quotes/${quote.id}`).then((r) => r.json());
      if (fresh?.quote) hydrateFromServer(fresh.quote);
    } finally {
      setRunning(false);
    }
  }

  function handleEvent(evt: { type: string; [k: string]: unknown }) {
    if (evt.type === "text") {
      setAssistantText((t) => t + (evt.delta as string));
    } else if (evt.type === "tool_use_start") {
      setToolCalls((c) => [...c, { id: evt.id as string, name: evt.name as string }]);
    } else if (evt.type === "tool_use_input") {
      setToolCalls((c) =>
        c.map((t) => (t.id === (evt.id as string) ? { ...t, input: evt.input } : t)),
      );
    } else if (evt.type === "tool_result") {
      setToolCalls((c) =>
        c.map((t) =>
          t.id === (evt.id as string)
            ? { ...t, result: evt.result, isError: Boolean(evt.isError) }
            : t,
        ),
      );
    } else if (evt.type === "error") {
      setAssistantText((t) => `${t}\n\n[erreur] ${String(evt.message)}`);
    }
  }

  function hydrateFromServer(q: {
    id: string;
    number: string;
    status: string;
    notes: string | null;
    prompt: string | null;
    totalHT: string | number;
    totalTTC: string | number;
    validUntil: string | null;
    customer: { id: string; companyName: string; email: string | null; city: string | null };
    lines: Array<{
      id: string;
      productId: string | null;
      product: { sku: string; name: string } | null;
      customLabel: string | null;
      description: string | null;
      qty: string | number;
      unitPriceHT: string | number;
      discountPct: string | number;
      vatRate: string | number;
      position: number;
      aiSuggested: boolean;
    }>;
  }) {
    setQuote({
      id: q.id,
      number: q.number,
      status: q.status,
      notes: q.notes,
      prompt: q.prompt,
      totalHT: Number(q.totalHT),
      totalTTC: Number(q.totalTTC),
      validUntil: q.validUntil,
      customer: q.customer,
      lines: q.lines.map((l) => ({
        id: l.id,
        productId: l.productId,
        productSku: l.product?.sku ?? null,
        productName: l.product?.name ?? null,
        customLabel: l.customLabel,
        description: l.description,
        qty: Number(l.qty),
        unitPriceHT: Number(l.unitPriceHT),
        discountPct: Number(l.discountPct),
        vatRate: Number(l.vatRate),
        position: l.position,
        aiSuggested: l.aiSuggested,
      })),
    });
  }

  function updateLine(idx: number, patch: Partial<QuoteLineUI>) {
    setQuote((q) => {
      const lines = q.lines.slice();
      const current = lines[idx];
      if (!current) return q;
      lines[idx] = { ...current, ...patch };
      return { ...q, lines };
    });
  }

  function addEmptyLine() {
    setQuote((q) => ({
      ...q,
      lines: [
        ...q.lines,
        {
          productId: null,
          productSku: null,
          productName: null,
          customLabel: "",
          description: null,
          qty: 1,
          unitPriceHT: 0,
          discountPct: 0,
          vatRate: 21,
          position: q.lines.length,
          aiSuggested: false,
        },
      ],
    }));
  }

  function removeLine(idx: number) {
    setQuote((q) => ({ ...q, lines: q.lines.filter((_, i) => i !== idx) }));
  }

  const totals = useMemo(() => {
    let ht = 0;
    let ttc = 0;
    for (const l of quote.lines) {
      const lineHT = l.qty * l.unitPriceHT * (1 - l.discountPct / 100);
      ht += lineHT;
      ttc += lineHT * (1 + l.vatRate / 100);
    }
    return { ht: Math.round(ht * 100) / 100, ttc: Math.round(ttc * 100) / 100 };
  }, [quote.lines]);

  async function save() {
    setSavePending(true);
    try {
      const res = await fetch(`/api/quotes/${quote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: quote.notes,
          lines: quote.lines.map((l, i) => ({
            id: l.id,
            productId: l.productId,
            customLabel: l.customLabel,
            description: l.description,
            qty: l.qty,
            unitPriceHT: l.unitPriceHT,
            discountPct: l.discountPct,
            vatRate: l.vatRate,
            position: i,
          })),
        }),
      });
      if (!res.ok) {
        alert("Erreur enregistrement");
        return;
      }
      const { quote: fresh } = await res.json();
      hydrateFromServer(fresh);
    } finally {
      setSavePending(false);
    }
  }

  async function sendEmail() {
    setSendStatus(null);
    if (!emailTo) {
      setSendStatus("Aucune adresse destinataire.");
      return;
    }
    const ok = window.confirm(
      `Envoyer le devis ${quote.number} à ${emailTo} ? Le PDF sera attaché.`,
    );
    if (!ok) return;
    const res = await fetch(`/api/quotes/${quote.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: emailTo }),
    });
    if (res.ok) {
      setSendStatus("Devis envoyé.");
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setSendStatus(`Erreur: ${body?.error ?? res.statusText}`);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/quotes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{quote.number}</h1>
            <p className="text-sm text-muted-foreground">
              {quote.customer.companyName}
              {quote.customer.city ? ` — ${quote.customer.city}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={quote.status === "SENT" ? "default" : "secondary"}>{quote.status}</Badge>
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/quotes/${quote.id}/pdf`} target="_blank" rel="noreferrer">
              <FileDown className="h-4 w-4" /> PDF
            </a>
          </Button>
          <Button size="sm" onClick={save} disabled={savePending}>
            {savePending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Enregistrer
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Lignes du devis</CardTitle>
              <CardDescription>
                Les lignes proposées par l&apos;IA sont marquées. Vous pouvez tout éditer librement.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Désignation</TableHead>
                    <TableHead>Qté</TableHead>
                    <TableHead>P.U. HT</TableHead>
                    <TableHead>Rem.%</TableHead>
                    <TableHead>TVA%</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quote.lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Aucune ligne. Lancez l&apos;assistant ou ajoutez une ligne manuelle.
                      </TableCell>
                    </TableRow>
                  ) : (
                    quote.lines.map((l, idx) => {
                      const lineHT = l.qty * l.unitPriceHT * (1 - l.discountPct / 100);
                      return (
                        <TableRow key={l.id ?? idx}>
                          <TableCell>
                            <div className="flex items-start gap-2">
                              {l.aiSuggested ? (
                                <Sparkles className="h-3.5 w-3.5 mt-1 text-muted-foreground" />
                              ) : null}
                              <div className="flex-1">
                                {l.productSku ? (
                                  <div className="text-xs font-mono text-muted-foreground">{l.productSku}</div>
                                ) : null}
                                <Input
                                  className="font-medium"
                                  value={l.productName ?? l.customLabel ?? ""}
                                  onChange={(e) =>
                                    updateLine(
                                      idx,
                                      l.productId
                                        ? { productName: e.target.value }
                                        : { customLabel: e.target.value },
                                    )
                                  }
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              className="w-20"
                              value={l.qty}
                              onChange={(e) => updateLine(idx, { qty: Number(e.target.value) })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              className="w-24"
                              value={l.unitPriceHT}
                              onChange={(e) => updateLine(idx, { unitPriceHT: Number(e.target.value) })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.5"
                              className="w-16"
                              value={l.discountPct}
                              onChange={(e) => updateLine(idx, { discountPct: Number(e.target.value) })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.5"
                              className="w-16"
                              value={l.vatRate}
                              onChange={(e) => updateLine(idx, { vatRate: Number(e.target.value) })}
                            />
                          </TableCell>
                          <TableCell className="text-right text-sm">{formatCurrency(lineHT)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => removeLine(idx)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              <div className="flex justify-between items-center mt-4">
                <Button variant="outline" size="sm" onClick={addEmptyLine}>
                  <Plus className="h-4 w-4" /> Ligne manuelle
                </Button>
                <div className="text-right space-y-0.5">
                  <div className="text-sm text-muted-foreground">
                    Total HT: <span className="text-foreground font-medium">{formatCurrency(totals.ht)}</span>
                  </div>
                  <div className="text-base">
                    Total TTC: <span className="font-semibold">{formatCurrency(totals.ttc)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes internes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={4}
                value={quote.notes ?? ""}
                onChange={(e) => setQuote((q) => ({ ...q, notes: e.target.value }))}
                placeholder="Notes pour vous-même ou collègue. Non affichées sur le PDF par défaut."
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Assistant
              </CardTitle>
              <CardDescription>Affinez le besoin ; l&apos;IA met à jour les lignes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex: ajoute un bar avec tireuse 3 voies et change le four pour un modèle gaz."
              />
              <Button
                className="w-full"
                onClick={() => runAgent(prompt)}
                disabled={running || prompt.trim().length < 3}
              >
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {running ? "Génération…" : "Demander à l'IA"}
              </Button>

              {assistantText || toolCalls.length > 0 ? (
                <div className="space-y-2 pt-3 border-t">
                  {toolCalls.map((t) => (
                    <div key={t.id} className="text-xs rounded border bg-muted/40 p-2">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Wrench className="h-3 w-3" /> {t.name}
                        {t.result === undefined ? (
                          <Loader2 className="h-3 w-3 animate-spin ml-auto" />
                        ) : t.isError ? (
                          <span className="ml-auto text-destructive">erreur</span>
                        ) : (
                          <span className="ml-auto">ok</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {assistantText ? (
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">{assistantText}</div>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> Envoi
              </CardTitle>
              <CardDescription>Envoie le PDF par email au client.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="emailTo">Destinataire</Label>
                <Input
                  id="emailTo"
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="client@exemple.be"
                />
              </div>
              <Button className="w-full" variant="default" onClick={sendEmail} disabled={!emailTo}>
                <Send className="h-4 w-4" /> Envoyer
              </Button>
              {sendStatus ? <p className="text-xs text-muted-foreground">{sendStatus}</p> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

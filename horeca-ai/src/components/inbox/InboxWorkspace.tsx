"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Send,
  Wrench,
  Mail,
  CheckCircle2,
  UserCheck,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

export interface InboxUI {
  id: string;
  channel: string;
  fromName: string | null;
  fromEmail: string | null;
  subject: string | null;
  bodyText: string;
  receivedAt: string;
  status: string;
  category: string | null;
  draftReply: string | null;
  customer: { id: string; companyName: string; email: string | null } | null;
  assignedTo: { id: string; name: string; role: string } | null;
}

interface ToolCallView {
  id: string;
  name: string;
  input?: unknown;
  result?: unknown;
  isError?: boolean;
}

const categoryLabel: Record<string, string> = {
  QUOTE_REQUEST: "Demande de devis",
  SAV: "SAV",
  AVAILABILITY: "Disponibilité",
  PRODUCT_INFO: "Info produit",
  OTHER: "Autre",
};

export function InboxWorkspace({ initial, autorun }: { initial: InboxUI; autorun: boolean }) {
  const router = useRouter();
  const [item, setItem] = useState<InboxUI>(initial);
  const [running, setRunning] = useState(false);
  const [assistantText, setAssistantText] = useState("");
  const [toolCalls, setToolCalls] = useState<ToolCallView[]>([]);
  const [sendPending, setSendPending] = useState(false);
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const [emailTo, setEmailTo] = useState(initial.fromEmail ?? initial.customer?.email ?? "");
  const [editSubject, setEditSubject] = useState(initial.subject ? `Re: ${initial.subject}` : "");
  const [editBody, setEditBody] = useState(initial.draftReply ?? "");
  const autoRunDone = useRef(false);

  useEffect(() => {
    if (autorun && !autoRunDone.current && item.status === "NEW") {
      autoRunDone.current = true;
      void runTriage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autorun]);

  async function runTriage() {
    setRunning(true);
    setAssistantText("");
    setToolCalls([]);
    try {
      const res = await fetch(`/api/inbox/${item.id}/triage`, { method: "POST" });
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
            /* ignore */
          }
        }
      }
      // Refresh
      const r = await fetch(`/api/inbox/${item.id}`);
      if (r.ok) {
        const { item: fresh } = await r.json();
        setItem({
          ...item,
          status: fresh.status,
          category: fresh.category,
          draftReply: fresh.draftReply,
          subject: fresh.subject ?? item.subject,
          customer: fresh.customer
            ? { id: fresh.customer.id, companyName: fresh.customer.companyName, email: fresh.customer.email }
            : item.customer,
          assignedTo: fresh.assignedTo
            ? { id: fresh.assignedTo.id, name: fresh.assignedTo.name, role: fresh.assignedTo.role }
            : null,
        });
        if (fresh.draftReply) setEditBody(fresh.draftReply);
        if (fresh.subject && !editSubject) setEditSubject(`Re: ${fresh.subject}`);
      }
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
      setToolCalls((c) => c.map((t) => (t.id === (evt.id as string) ? { ...t, input: evt.input } : t)));
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

  async function saveDraft() {
    const res = await fetch(`/api/inbox/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftReply: editBody, subject: editSubject.replace(/^Re:\s*/i, "") }),
    });
    if (res.ok) router.refresh();
  }

  async function sendReply() {
    if (!emailTo) {
      setSendStatus("Adresse destinataire manquante.");
      return;
    }
    if (editBody.trim().length < 5) {
      setSendStatus("Brouillon vide.");
      return;
    }
    const ok = window.confirm(`Envoyer cette réponse à ${emailTo} ?`);
    if (!ok) return;
    setSendPending(true);
    setSendStatus(null);
    try {
      const res = await fetch(`/api/inbox/${item.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: emailTo, subject: editSubject, body: editBody }),
      });
      if (res.ok) {
        setSendStatus("Réponse envoyée.");
        setItem((i) => ({ ...i, status: "SENT" }));
      } else {
        const body = await res.json().catch(() => ({}));
        setSendStatus(`Erreur: ${body?.error ?? res.statusText}`);
      }
    } finally {
      setSendPending(false);
    }
  }

  async function close() {
    const res = await fetch(`/api/inbox/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CLOSED" }),
    });
    if (res.ok) {
      setItem((i) => ({ ...i, status: "CLOSED" }));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/inbox">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {item.subject ?? "(sans sujet)"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {item.fromName ?? ""} {item.fromEmail ? `<${item.fromEmail}>` : ""} · {formatDate(item.receivedAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {item.category ? (
            <Badge variant="outline">{categoryLabel[item.category] ?? item.category}</Badge>
          ) : null}
          <Badge variant={item.status === "NEW" ? "destructive" : item.status === "SENT" ? "default" : "secondary"}>
            {item.status}
          </Badge>
          {item.status !== "CLOSED" ? (
            <Button variant="outline" size="sm" onClick={close}>
              <CheckCircle2 className="h-4 w-4" /> Clôturer
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Message original</CardTitle>
              <CardDescription>{item.channel}</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{item.bodyText}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> Brouillon de réponse
              </CardTitle>
              <CardDescription>
                Vérifiez et adaptez avant envoi. Tout envoi est tracé dans l&apos;audit log.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="emailTo">Destinataire</Label>
                <Input
                  id="emailTo"
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="editSubject">Sujet</Label>
                <Input
                  id="editSubject"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="editBody">Corps</Label>
                <Textarea
                  id="editBody"
                  rows={12}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  placeholder="Le brouillon apparaît ici après le triage IA. Vous pouvez l'éditer librement."
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={saveDraft}>
                  Enregistrer
                </Button>
                <Button onClick={sendReply} disabled={sendPending || item.status === "SENT"}>
                  {sendPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Envoyer
                </Button>
              </div>
              {sendStatus ? <p className="text-xs text-muted-foreground">{sendStatus}</p> : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Triage IA
              </CardTitle>
              <CardDescription>
                Classification + rédaction + assignation. Activez à la création ou relancez ici.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" onClick={runTriage} disabled={running}>
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {running ? "Triage en cours…" : "Lancer le triage"}
              </Button>
              {toolCalls.length > 0 ? (
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
                </div>
              ) : null}
              {assistantText ? (
                <div className="text-sm whitespace-pre-wrap leading-relaxed pt-2 border-t">
                  {assistantText}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-4 w-4" /> Assignation
              </CardTitle>
            </CardHeader>
            <CardContent>
              {item.assignedTo ? (
                <div className="text-sm">
                  <div className="font-medium">{item.assignedTo.name}</div>
                  <div className="text-xs text-muted-foreground">{item.assignedTo.role}</div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Non assigné.</p>
              )}
              {item.customer ? (
                <div className="text-sm mt-3 pt-3 border-t">
                  <div className="text-xs text-muted-foreground">Client rattaché</div>
                  <div className="font-medium">{item.customer.companyName}</div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

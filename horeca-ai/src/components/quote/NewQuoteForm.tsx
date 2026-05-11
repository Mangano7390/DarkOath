"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

interface CustomerLite {
  id: string;
  companyName: string;
  city: string | null;
  segment: string;
}

export function NewQuoteForm({ customers }: { customers: CustomerLite[] }) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [prompt, setPrompt] = useState(
    "Équiper une pizzeria de 80 couverts : four à pizza professionnel, chambre froide positive, plonge, plan de préparation, armoire réfrigérée.",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function submit() {
    setError(null);
    if (!customerId) {
      setError("Sélectionnez un client.");
      return;
    }
    if (prompt.trim().length < 10) {
      setError("Décrivez le besoin (10 caractères min).");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, prompt }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? "Erreur création");
        return;
      }
      const { quote } = await res.json();
      const url = new URL(`/quotes/${quote.id}`, window.location.origin);
      url.searchParams.set("autorun", "1");
      router.push(url.pathname + url.search);
    });
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="customer">Client</Label>
          <Select
            id="customer"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName} {c.city ? `— ${c.city}` : ""} ({c.segment})
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prompt">Brief du besoin</Label>
          <Textarea
            id="prompt"
            rows={5}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ex: équiper un café-brasserie 60 couverts avec tireuse 3 voies, lave-vaisselle capot, deux armoires positives, plonge avec égouttoir."
          />
          <p className="text-xs text-muted-foreground">
            Mentionnez le type d&apos;établissement, le volume (couverts/chambres) et les contraintes éventuelles.
          </p>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end">
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Générer la proposition
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

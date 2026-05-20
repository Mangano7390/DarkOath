"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Loader2, Lock } from "lucide-react";

export function CheckoutForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    const payload = Object.fromEntries(data.entries());
    startTransition(async () => {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? "Erreur lors de la commande");
        return;
      }
      const { redirectUrl } = await res.json();
      if (redirectUrl) {
        window.location.href = redirectUrl;
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="border rounded-lg p-6 space-y-4 bg-card">
        <h2 className="font-semibold">Contact</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="firstName">Prénom *</Label>
            <Input id="firstName" name="firstName" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName">Nom *</Label>
            <Input id="lastName" name="lastName" required />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="email">Email *</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="phone">Téléphone</Label>
            <Input id="phone" name="phone" type="tel" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isPro} onChange={(e) => setIsPro(e.target.checked)} />
          Je commande en tant que professionnel (HoReCa / TPE)
        </label>
        {isPro ? (
          <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t">
            <div className="space-y-1.5">
              <Label htmlFor="companyName">Raison sociale *</Label>
              <Input id="companyName" name="companyName" required={isPro} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vatNumber">N° TVA</Label>
              <Input id="vatNumber" name="vatNumber" placeholder="BE0123456789" />
            </div>
          </div>
        ) : null}
      </section>

      <section className="border rounded-lg p-6 space-y-4 bg-card">
        <h2 className="font-semibold">Livraison</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="line1">Adresse *</Label>
            <Input id="line1" name="line1" required placeholder="Rue, numéro" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="line2">Complément (étage, boîte…)</Label>
            <Input id="line2" name="line2" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="zip">Code postal *</Label>
            <Input id="zip" name="zip" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">Ville *</Label>
            <Input id="city" name="city" required />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="country">Pays *</Label>
            <select id="country" name="country" defaultValue="BE" required className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="BE">Belgique</option>
              <option value="LU">Luxembourg</option>
              <option value="FR">France</option>
              <option value="NL">Pays-Bas</option>
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="notes">Note pour le livreur</Label>
            <Textarea id="notes" name="notes" rows={3} />
          </div>
        </div>
      </section>

      <section className="border rounded-lg p-6 space-y-3 bg-card">
        <h2 className="font-semibold">Paiement</h2>
        <p className="text-sm text-muted-foreground">
          Vous serez redirigé vers la page sécurisée Mollie pour choisir votre moyen de paiement
          (Bancontact, carte bancaire, iDEAL, virement bancaire).
        </p>
      </section>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        Procéder au paiement sécurisé
      </Button>
    </form>
  );
}

"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";

const SAMPLES = [
  {
    label: "Demande de devis (FR)",
    fromName: "Marco Rossi",
    fromEmail: "marco@bellissima.be",
    subject: "Demande devis pour pizzeria 80 couverts",
    body: "Bonjour,\n\nNous ouvrons une nouvelle pizzeria de 80 couverts à Bruxelles et nous cherchons à équiper la cuisine. Il nous faudrait un four à pizza professionnel (gaz de préférence), une chambre froide positive, une plonge avec égouttoir, et deux tables de préparation inox.\n\nPouvez-vous me faire parvenir un devis ? Idéalement avant la fin du mois.\n\nMerci d'avance,\nMarco Rossi",
  },
  {
    label: "Panne urgente SAV (FR)",
    fromName: "Sophie Laurent",
    fromEmail: "achats@etoiles.be",
    subject: "URGENT - lave-vaisselle ne fonctionne plus",
    body: "Bonjour,\n\nNotre lave-vaisselle Winterhalter installé l'année dernière refuse de démarrer ce matin. Voyant rouge clignotant, le cycle ne se lance pas. Service au déjeuner dans 2h, c'est très problématique.\n\nMerci d'envoyer un technicien dès que possible.\n\nSophie",
  },
  {
    label: "Disponibilité (NL)",
    fromName: "Jan De Vries",
    fromEmail: "jan@hetcafe.be",
    subject: "Beschikbaarheid biertap 3 wegen",
    body: "Beste,\n\nIk wil graag weten of jullie de biertap met 3 wegen op voorraad hebben, en wat de levertijd is naar Gent.\n\nMet vriendelijke groeten,\nJan",
  },
];

export function InboxNewForm() {
  const router = useRouter();
  const [fromName, setFromName] = useState(SAMPLES[0]!.fromName);
  const [fromEmail, setFromEmail] = useState(SAMPLES[0]!.fromEmail);
  const [subject, setSubject] = useState(SAMPLES[0]!.subject);
  const [bodyText, setBodyText] = useState(SAMPLES[0]!.body);
  const [channel, setChannel] = useState<"EMAIL" | "WEB_FORM" | "PHONE_NOTE">("EMAIL");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function applySample(idx: number) {
    const s = SAMPLES[idx];
    if (!s) return;
    setFromName(s.fromName);
    setFromEmail(s.fromEmail);
    setSubject(s.subject);
    setBodyText(s.body);
  }

  async function submit() {
    setError(null);
    if (bodyText.trim().length < 5) {
      setError("Le contenu est trop court.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, fromName, fromEmail, subject, bodyText }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? "Erreur création");
        return;
      }
      const { item } = await res.json();
      const url = new URL(`/inbox/${item.id}`, window.location.origin);
      url.searchParams.set("autorun", "1");
      router.push(url.pathname + url.search);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {SAMPLES.map((s, i) => (
          <Button key={s.label} variant="outline" size="sm" onClick={() => applySample(i)}>
            {s.label}
          </Button>
        ))}
      </div>
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="channel">Canal</Label>
              <Select id="channel" value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)}>
                <option value="EMAIL">Email</option>
                <option value="WEB_FORM">Formulaire web</option>
                <option value="PHONE_NOTE">Note tél</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fromName">Nom expéditeur</Label>
              <Input id="fromName" value={fromName} onChange={(e) => setFromName(e.target.value)} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="fromEmail">Email expéditeur</Label>
              <Input id="fromEmail" type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="subject">Sujet</Label>
              <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bodyText">Contenu</Label>
            <Textarea id="bodyText" rows={10} value={bodyText} onChange={(e) => setBodyText(e.target.value)} />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end">
            <Button onClick={submit} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Créer et trier
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

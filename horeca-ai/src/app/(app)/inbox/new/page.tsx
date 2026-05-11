import { InboxNewForm } from "@/components/inbox/InboxNewForm";

export default function NewInboxPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Simuler un email entrant</h1>
        <p className="text-sm text-muted-foreground">
          Outil interne pour tester le triage. Pour la production, branchez un webhook email (route à venir).
        </p>
      </div>
      <InboxNewForm />
    </div>
  );
}

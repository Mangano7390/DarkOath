import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Module en cours de développement. Module 1 (Devis IA) est livré ; les autres suivent dans l&apos;ordre
            défini avec l&apos;équipe.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

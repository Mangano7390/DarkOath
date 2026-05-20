import Link from "next/link";

export function Footer() {
  const company = process.env.COMPANY_NAME ?? "Mr Horeca";
  const address = process.env.COMPANY_ADDRESS ?? "";
  const vat = process.env.COMPANY_VAT ?? "";
  const email = process.env.COMPANY_EMAIL ?? "";
  const phone = process.env.COMPANY_PHONE ?? "";
  return (
    <footer className="border-t bg-secondary/40 mt-16">
      <div className="container py-12 grid md:grid-cols-4 gap-8 text-sm">
        <div className="space-y-2">
          <div className="font-semibold">{company}</div>
          <div className="text-muted-foreground">{address}</div>
          <div className="text-muted-foreground">TVA : {vat}</div>
        </div>
        <div className="space-y-2">
          <div className="font-semibold">Catalogue</div>
          <ul className="space-y-1 text-muted-foreground">
            <li><Link href="/c/cuisson" className="hover:text-foreground">Cuisson</Link></li>
            <li><Link href="/c/froid" className="hover:text-foreground">Froid pro</Link></li>
            <li><Link href="/c/lavage" className="hover:text-foreground">Lavage</Link></li>
            <li><Link href="/c/bar" className="hover:text-foreground">Bar &amp; boissons</Link></li>
            <li><Link href="/c/mobilier" className="hover:text-foreground">Mobilier inox</Link></li>
          </ul>
        </div>
        <div className="space-y-2">
          <div className="font-semibold">Services</div>
          <ul className="space-y-1 text-muted-foreground">
            <li>Livraison Benelux</li>
            <li>Installation sur site</li>
            <li>SAV technique agréé</li>
            <li>Devis personnalisé</li>
          </ul>
        </div>
        <div className="space-y-2">
          <div className="font-semibold">Contact</div>
          <ul className="space-y-1 text-muted-foreground">
            <li>{phone}</li>
            <li>{email}</li>
            <li><Link href="/contact" className="hover:text-foreground">Formulaire</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t">
        <div className="container py-4 text-xs text-muted-foreground flex items-center justify-between">
          <div>© {new Date().getFullYear()} {company}. Tous droits réservés.</div>
          <div className="flex gap-4">
            <Link href="/cgv" className="hover:text-foreground">CGV</Link>
            <Link href="/mentions-legales" className="hover:text-foreground">Mentions légales</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

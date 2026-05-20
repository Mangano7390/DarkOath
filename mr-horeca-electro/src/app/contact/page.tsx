import { ContactForm } from "@/components/ContactForm";
import { Mail, MapPin, Phone } from "lucide-react";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  const phone = process.env.COMPANY_PHONE ?? "";
  const email = process.env.COMPANY_EMAIL ?? "";
  const address = process.env.COMPANY_ADDRESS ?? "";
  return (
    <div className="container py-12 grid md:grid-cols-2 gap-10 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Contactez-nous</h1>
          <p className="text-muted-foreground mt-2">
            Une question, un devis, un SAV ? Notre équipe vous répond sous 24h.
          </p>
        </div>
        <div className="space-y-4 text-sm">
          <div className="flex items-start gap-3">
            <Phone className="h-5 w-5 text-horeca mt-0.5" />
            <div>
              <div className="font-semibold">Téléphone</div>
              <div className="text-muted-foreground">{phone}</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-horeca mt-0.5" />
            <div>
              <div className="font-semibold">Email</div>
              <div className="text-muted-foreground">{email}</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-horeca mt-0.5" />
            <div>
              <div className="font-semibold">Adresse</div>
              <div className="text-muted-foreground">{address}</div>
            </div>
          </div>
        </div>
      </div>
      <ContactForm />
    </div>
  );
}

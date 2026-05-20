import Link from "next/link";
import { ArrowRight, ShieldCheck, Truck, Headphones, Wrench } from "lucide-react";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/ProductCard";

export default async function HomePage() {
  const [featuredHoreca, featuredElectro] = await Promise.all([
    prisma.product.findMany({
      where: { channel: "HORECA", active: true, featured: true },
      include: { brand: true, images: { orderBy: { position: "asc" } } },
      take: 4,
    }),
    prisma.product.findMany({
      where: { channel: "ELECTRO", active: true, featured: true },
      include: { brand: true, images: { orderBy: { position: "asc" } } },
      take: 4,
    }),
  ]);

  return (
    <>
      {/* HERO */}
      <section className="relative bg-gradient-to-br from-horeca via-horeca to-[#152e44] text-white">
        <div className="container py-16 md:py-24">
          <div className="max-w-2xl space-y-5">
            <div className="text-xs uppercase tracking-[0.2em] text-horeca-accent">Distribution Belgique</div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              Tout votre matériel.
              <br />
              <span className="text-horeca-accent">Pro et particulier.</span>
            </h1>
            <p className="text-white/80 text-lg max-w-xl">
              Mr Horeca équipe les restaurateurs, hôteliers et collectivités.
              Mr Electro fournit les particuliers en gros et petit électroménager, TV, audio et informatique.
              Deux expertises, une seule équipe.
            </p>
            <div className="flex flex-wrap gap-3 pt-3">
              <Button asChild size="lg" variant="horeca" className="bg-white !text-horeca hover:bg-white/90">
                <Link href="/horeca">
                  Catalogue HoReCa <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="bg-transparent border-white text-white hover:bg-white/10 hover:text-white">
                <Link href="/electro">
                  Catalogue Electro <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="border-b">
        <div className="container py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
          <div className="flex items-start gap-3">
            <Truck className="h-5 w-5 text-horeca shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Livraison Benelux</div>
              <div className="text-muted-foreground">Sous 48-72h en zone urbaine</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Wrench className="h-5 w-5 text-horeca shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">SAV intégré</div>
              <div className="text-muted-foreground">Techniciens agréés constructeurs</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-horeca shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Garantie 2 ans</div>
              <div className="text-muted-foreground">Sur l&apos;ensemble du catalogue</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Headphones className="h-5 w-5 text-horeca shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Conseil personnalisé</div>
              <div className="text-muted-foreground">Devis gratuit sous 24h</div>
            </div>
          </div>
        </div>
      </section>

      {/* TWO COLUMNS */}
      <section className="container py-16 grid md:grid-cols-2 gap-6">
        <Link
          href="/horeca"
          className="group relative overflow-hidden rounded-xl bg-horeca text-white p-10 min-h-[280px] flex flex-col justify-between"
        >
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-horeca-accent mb-3">B2B</div>
            <div className="text-3xl font-bold mb-3">Mr Horeca</div>
            <p className="text-white/80 max-w-md">
              Cuisson, froid, lavage, bar, mobilier inox, pièces détachées. Plus de 5000 références
              pour restaurants, hôtels, brasseries et collectivités.
            </p>
          </div>
          <div className="flex items-center gap-1 text-horeca-accent font-medium group-hover:translate-x-1 transition">
            Découvrir le catalogue pro <ArrowRight className="h-4 w-4" />
          </div>
        </Link>
        <Link
          href="/electro"
          className="group relative overflow-hidden rounded-xl bg-electro text-white p-10 min-h-[280px] flex flex-col justify-between"
        >
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-electro-accent mb-3">Grand public</div>
            <div className="text-3xl font-bold mb-3">Mr Electro</div>
            <p className="text-white/80 max-w-md">
              Gros et petit électroménager, TV, audio, informatique, climatisation. Les meilleures
              marques aux meilleurs prix, livré et installé.
            </p>
          </div>
          <div className="flex items-center gap-1 text-electro-accent font-medium group-hover:translate-x-1 transition">
            Découvrir le catalogue <ArrowRight className="h-4 w-4" />
          </div>
        </Link>
      </section>

      {/* FEATURED HORECA */}
      {featuredHoreca.length > 0 ? (
        <section className="container py-12">
          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-horeca">HoReCa Pro</div>
              <h2 className="text-2xl font-bold">Sélection professionnelle</h2>
            </div>
            <Link href="/horeca" className="text-sm font-medium text-horeca hover:underline">
              Tout voir →
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredHoreca.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}

      {/* FEATURED ELECTRO */}
      {featuredElectro.length > 0 ? (
        <section className="container py-12">
          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-electro-accent">Electro</div>
              <h2 className="text-2xl font-bold">Nos best-sellers</h2>
            </div>
            <Link href="/electro" className="text-sm font-medium text-electro-accent hover:underline">
              Tout voir →
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredElectro.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

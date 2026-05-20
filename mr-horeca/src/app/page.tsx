import Link from "next/link";
import { ArrowRight, ShieldCheck, Truck, Headphones, Wrench } from "lucide-react";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/ProductCard";

export default async function HomePage() {
  const [featured, categories] = await Promise.all([
    prisma.product.findMany({
      where: { active: true, featured: true },
      include: { brand: true, images: { orderBy: { position: "asc" } } },
      take: 8,
    }),
    prisma.category.findMany({
      where: { parentId: null },
      orderBy: { order: "asc" },
      include: { _count: { select: { products: true } } },
    }),
  ]);

  return (
    <>
      {/* HERO */}
      <section className="relative bg-gradient-to-br from-brand via-brand to-brand-dark text-white">
        <div className="container py-20 md:py-28">
          <div className="max-w-2xl space-y-5">
            <div className="text-xs uppercase tracking-[0.2em] text-brand-accent">
              Distribution Belgique · B2B
            </div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              Équipement professionnel
              <br />
              <span className="text-brand-accent">pour restaurateurs et hôteliers.</span>
            </h1>
            <p className="text-white/80 text-lg max-w-xl">
              Cuisson, froid, lavage, bar, mobilier inox, pièces détachées.
              Les meilleures marques aux meilleurs prix, livraison et installation incluses.
            </p>
            <div className="flex flex-wrap gap-3 pt-3">
              <Button asChild size="lg" className="bg-white !text-brand hover:bg-white/90">
                <Link href="/catalogue">
                  Voir le catalogue <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="bg-transparent border-white text-white hover:bg-white/10 hover:text-white">
                <Link href="/contact">
                  Demander un devis
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
            <Truck className="h-5 w-5 text-brand shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Livraison Benelux</div>
              <div className="text-muted-foreground">Sous 48-72h en zone urbaine</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Wrench className="h-5 w-5 text-brand shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">SAV intégré</div>
              <div className="text-muted-foreground">Techniciens agréés constructeurs</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-brand shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Garantie 2 ans</div>
              <div className="text-muted-foreground">Sur l&apos;ensemble du catalogue</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Headphones className="h-5 w-5 text-brand shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Conseil personnalisé</div>
              <div className="text-muted-foreground">Devis gratuit sous 24h</div>
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="container py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-brand">Catégories</div>
            <h2 className="text-2xl font-bold">Explorez notre catalogue</h2>
          </div>
          <Link href="/catalogue" className="text-sm font-medium text-brand hover:underline">
            Tout voir →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/c/${c.slug}`}
              className="group rounded-lg border bg-card p-5 hover:border-brand hover:shadow-md transition"
            >
              <div className="font-semibold">{c.name}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {c._count.products} produit{c._count.products > 1 ? "s" : ""}
              </div>
              <div className="text-xs text-brand mt-3 opacity-0 group-hover:opacity-100 transition">
                Découvrir →
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* FEATURED */}
      {featured.length > 0 ? (
        <section className="container py-12">
          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-brand">Sélection</div>
              <h2 className="text-2xl font-bold">Nos best-sellers</h2>
            </div>
            <Link href="/catalogue" className="text-sm font-medium text-brand hover:underline">
              Tout voir →
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}

      {/* CTA */}
      <section className="container py-16">
        <div className="rounded-2xl bg-brand text-white p-10 md:p-14 grid md:grid-cols-2 gap-8 items-center">
          <div className="space-y-3">
            <h3 className="text-2xl md:text-3xl font-bold">Un projet d&apos;équipement complet ?</h3>
            <p className="text-white/80">
              Pizzeria, brasserie, hôtel, collectivité : notre équipe vous accompagne du chiffrage
              à l&apos;installation. Devis personnalisé sous 24h.
            </p>
          </div>
          <div className="flex md:justify-end">
            <Button asChild size="lg" className="bg-brand-accent !text-brand-dark hover:bg-brand-accent/90">
              <Link href="/contact">
                Demander un devis <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

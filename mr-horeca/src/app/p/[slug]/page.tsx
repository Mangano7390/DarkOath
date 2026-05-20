import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { formatPrice, fromDecimal } from "@/lib/utils";
import { AddToCartButton } from "@/components/AddToCartButton";
import { ChevronRight, Truck, ShieldCheck, RotateCcw } from "lucide-react";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const product = await prisma.product.findUnique({ where: { slug } });
  return {
    title: product?.name ?? "Produit",
    description: product?.shortDesc ?? undefined,
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      brand: true,
      category: true,
      images: { orderBy: { position: "asc" } },
    },
  });
  if (!product || !product.active) notFound();

  const priceHT = fromDecimal(product.priceHT);
  const priceTTC = formatPrice(priceHT, true);

  return (
    <div className="container py-10 space-y-8">
      <nav className="flex items-center text-sm text-muted-foreground gap-1">
        <Link href="/" className="hover:text-foreground">Accueil</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/catalogue" className="hover:text-foreground">Catalogue</Link>
        {product.category ? (
          <>
            <ChevronRight className="h-3 w-3" />
            <Link href={`/c/${product.category.slug}`} className="hover:text-foreground">
              {product.category.name}
            </Link>
          </>
        ) : null}
      </nav>

      <div className="grid lg:grid-cols-2 gap-10">
        <div className="space-y-3">
          <div className="relative aspect-square bg-secondary rounded-lg overflow-hidden">
            {product.images[0] ? (
              <Image
                src={product.images[0].url}
                alt={product.images[0].alt ?? product.name}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Photo à venir
              </div>
            )}
          </div>
          {product.images.length > 1 ? (
            <div className="grid grid-cols-5 gap-2">
              {product.images.slice(1).map((img) => (
                <div key={img.id} className="relative aspect-square bg-secondary rounded overflow-hidden">
                  <Image src={img.url} alt={img.alt ?? ""} fill className="object-cover" sizes="100px" />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-5">
          <div>
            {product.brand ? (
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {product.brand.name}
              </div>
            ) : null}
            <h1 className="text-2xl md:text-3xl font-bold mt-1">{product.name}</h1>
            <div className="text-xs text-muted-foreground mt-1">Réf. {product.sku}</div>
          </div>

          {product.shortDesc ? <p className="text-muted-foreground">{product.shortDesc}</p> : null}

          <div className="border-y py-4 space-y-1">
            <div className="text-3xl font-bold">{priceTTC}</div>
            <div className="text-xs text-muted-foreground">
              {formatPrice(priceHT, false)} HTVA · TVA {fromDecimal(product.vatRate).toFixed(0)}%
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            {product.stockQty > 0 ? (
              <>
                <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
                <span className="font-medium">En stock</span>
                <span className="text-muted-foreground">— Livraison sous 48-72h</span>
              </>
            ) : (
              <>
                <span className="inline-flex h-2 w-2 rounded-full bg-amber-500" />
                <span className="font-medium">Sur commande</span>
                <span className="text-muted-foreground">— Délai 7-10 jours</span>
              </>
            )}
          </div>

          <AddToCartButton sku={product.sku} />

          <div className="grid grid-cols-3 gap-3 pt-2 text-xs">
            <div className="flex items-start gap-2">
              <Truck className="h-4 w-4 text-brand mt-0.5" />
              <div>
                <div className="font-medium">Livraison Benelux</div>
                <div className="text-muted-foreground">Gratuite dès 500€</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-brand mt-0.5" />
              <div>
                <div className="font-medium">Garantie 2 ans</div>
                <div className="text-muted-foreground">Pièces &amp; main d&apos;œuvre</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <RotateCcw className="h-4 w-4 text-brand mt-0.5" />
              <div>
                <div className="font-medium">Retour 14 jours</div>
                <div className="text-muted-foreground">Sauf produits sur-mesure</div>
              </div>
            </div>
          </div>

          {product.longDesc ? (
            <div className="pt-6 border-t">
              <h2 className="font-semibold mb-2">Description</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{product.longDesc}</p>
            </div>
          ) : null}

          {product.attrs && typeof product.attrs === "object" ? (
            <div className="pt-4">
              <h2 className="font-semibold mb-2">Caractéristiques</h2>
              <dl className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                {Object.entries(product.attrs as Record<string, unknown>).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground capitalize">{k}</dt>
                    <dd className="font-medium">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

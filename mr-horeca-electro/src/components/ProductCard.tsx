import Link from "next/link";
import Image from "next/image";
import { formatPrice, fromDecimal } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface Props {
  product: {
    slug: string;
    name: string;
    shortDesc?: string | null;
    priceHT: unknown;
    stockQty: number;
    channel: "HORECA" | "ELECTRO" | "BOTH";
    brand?: { name: string } | null;
    images: { url: string; alt: string | null }[];
  };
}

export function ProductCard({ product }: Props) {
  const img = product.images[0];
  const price = formatPrice(fromDecimal(product.priceHT));
  const isHoreca = product.channel === "HORECA";
  return (
    <Link
      href={`/p/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border bg-card transition hover:shadow-md"
    >
      <div className="relative aspect-square bg-muted">
        {img ? (
          <Image
            src={img.url}
            alt={img.alt ?? product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground text-xs">
            Pas d&apos;image
          </div>
        )}
        {isHoreca ? (
          <span className="absolute top-2 left-2 rounded-full bg-horeca text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1">
            Pro
          </span>
        ) : null}
      </div>
      <div className="flex flex-col flex-1 p-4 gap-1">
        {product.brand ? (
          <div className="text-xs text-muted-foreground uppercase tracking-wider">{product.brand.name}</div>
        ) : null}
        <div className="font-medium text-sm leading-snug line-clamp-2">{product.name}</div>
        {product.shortDesc ? (
          <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{product.shortDesc}</div>
        ) : null}
        <div className="mt-auto pt-3 flex items-center justify-between">
          <div className="font-semibold">{price}</div>
          {product.stockQty > 0 ? (
            <Badge variant="success">En stock</Badge>
          ) : (
            <Badge variant="muted">Sur commande</Badge>
          )}
        </div>
      </div>
    </Link>
  );
}

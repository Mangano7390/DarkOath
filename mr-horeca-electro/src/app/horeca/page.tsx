import Link from "next/link";
import { prisma } from "@/lib/db";
import { ProductCard } from "@/components/ProductCard";

export const metadata = { title: "HoReCa Pro" };

export default async function HorecaPage() {
  const categories = await prisma.category.findMany({
    where: { channel: { in: ["HORECA", "BOTH"] }, parentId: null },
    orderBy: { order: "asc" },
    include: { _count: { select: { products: true } } },
  });
  const products = await prisma.product.findMany({
    where: { channel: "HORECA", active: true },
    include: { brand: true, images: { orderBy: { position: "asc" } } },
    orderBy: [{ featured: "desc" }, { name: "asc" }],
    take: 24,
  });
  return (
    <div className="container py-12 space-y-10">
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-[0.2em] text-horeca">B2B Pro</div>
        <h1 className="text-3xl font-bold">Catalogue HoReCa</h1>
        <p className="text-muted-foreground max-w-2xl">
          Tout le matériel pour équiper restaurants, hôtels, brasseries et collectivités.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/c/${c.slug}`}
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm hover:bg-horeca hover:text-white hover:border-horeca transition"
          >
            {c.name}
            <span className="text-xs text-muted-foreground">({c._count.products})</span>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ProductCard } from "@/components/ProductCard";
import { ChevronRight } from "lucide-react";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const category = await prisma.category.findUnique({ where: { slug } });
  return { title: category?.name ?? "Catégorie" };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const category = await prisma.category.findUnique({ where: { slug } });
  if (!category) notFound();
  const products = await prisma.product.findMany({
    where: { categoryId: category.id, active: true },
    include: { brand: true, images: { orderBy: { position: "asc" } } },
    orderBy: [{ featured: "desc" }, { name: "asc" }],
  });
  return (
    <div className="container py-12 space-y-8">
      <nav className="flex items-center text-sm text-muted-foreground gap-1">
        <Link href="/" className="hover:text-foreground">Accueil</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/catalogue" className="hover:text-foreground">Catalogue</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">{category.name}</span>
      </nav>
      <div>
        <h1 className="text-3xl font-bold">{category.name}</h1>
        <p className="text-muted-foreground mt-1">
          {products.length} produit{products.length > 1 ? "s" : ""}
        </p>
      </div>
      {products.length === 0 ? (
        <div className="text-muted-foreground py-12 text-center border rounded-lg">
          Aucun produit dans cette catégorie pour l&apos;instant.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

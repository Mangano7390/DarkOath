import Link from "next/link";
import Image from "next/image";
import { readCart } from "@/lib/cart";
import { hydrateCart } from "@/server/cart.service";
import { Button } from "@/components/ui/button";
import { CartQtyControl } from "@/components/CartQtyControl";
import { ArrowRight, ShoppingBag } from "lucide-react";

function fmt(n: number) {
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(n);
}

export default async function CartPage() {
  const cart = await readCart();
  const hydrated = await hydrateCart(cart);

  if (hydrated.items.length === 0) {
    return (
      <div className="container py-20 text-center max-w-md mx-auto">
        <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground" />
        <h1 className="text-2xl font-bold mt-4">Votre panier est vide</h1>
        <p className="text-muted-foreground mt-2">Parcourez nos catalogues pour ajouter des produits.</p>
        <div className="flex gap-3 justify-center mt-6">
          <Button asChild variant="horeca">
            <Link href="/horeca">Catalogue HoReCa</Link>
          </Button>
          <Button asChild variant="electro">
            <Link href="/electro">Catalogue Electro</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <h1 className="text-2xl font-bold mb-6">Mon panier</h1>
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-3">
          {hydrated.items.map((item) => (
            <div key={item.sku} className="flex gap-4 border rounded-lg p-4 bg-card">
              <div className="relative w-24 h-24 bg-secondary rounded shrink-0 overflow-hidden">
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt={item.name} fill className="object-cover" sizes="100px" />
                ) : null}
              </div>
              <div className="flex-1 min-w-0">
                <Link href={`/p/${item.slug}`} className="font-medium hover:underline">
                  {item.name}
                </Link>
                <div className="text-xs text-muted-foreground">Réf. {item.sku}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {fmt(item.unitPriceTTC)} TTC · {fmt(item.unitPriceHT)} HT
                </div>
                <div className="mt-2">
                  <CartQtyControl sku={item.sku} qty={item.qty} />
                </div>
              </div>
              <div className="text-right font-semibold">{fmt(item.unitPriceTTC * item.qty)}</div>
            </div>
          ))}
        </div>

        <aside className="border rounded-lg p-6 h-fit space-y-4 bg-card">
          <h2 className="font-semibold">Récapitulatif</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Sous-total HT</dt>
              <dd>{fmt(hydrated.subtotalHT)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">TVA</dt>
              <dd>{fmt(hydrated.totalVAT)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Livraison</dt>
              <dd>Calculée au checkout</dd>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-3">
              <dt>Total TTC</dt>
              <dd>{fmt(hydrated.totalTTC)}</dd>
            </div>
          </dl>
          <Button asChild size="lg" className="w-full">
            <Link href="/checkout">
              Commander <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Paiement sécurisé par Mollie · Bancontact, Carte, Virement
          </p>
        </aside>
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { readCart } from "@/lib/cart";
import { hydrateCart } from "@/server/cart.service";
import { CheckoutForm } from "@/components/CheckoutForm";

function fmt(n: number) {
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(n);
}

export default async function CheckoutPage() {
  const cart = await readCart();
  const hydrated = await hydrateCart(cart);
  if (hydrated.items.length === 0) redirect("/cart");

  return (
    <div className="container py-10 max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">Finaliser ma commande</h1>
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <CheckoutForm />
        </div>
        <aside className="border rounded-lg p-6 h-fit space-y-3 bg-card text-sm">
          <h2 className="font-semibold mb-2">Votre commande</h2>
          {hydrated.items.map((it) => (
            <div key={it.sku} className="flex justify-between gap-3 py-1 border-b last:border-0">
              <div className="flex-1 min-w-0">
                <div className="truncate">{it.name}</div>
                <div className="text-xs text-muted-foreground">× {it.qty}</div>
              </div>
              <div className="font-medium">{fmt(it.unitPriceTTC * it.qty)}</div>
            </div>
          ))}
          <div className="border-t pt-3 space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Sous-total HT</span>
              <span>{fmt(hydrated.subtotalHT)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>TVA</span>
              <span>{fmt(hydrated.totalVAT)}</span>
            </div>
            <div className="flex justify-between text-base font-bold pt-2 border-t mt-2">
              <span>Total TTC</span>
              <span>{fmt(hydrated.totalTTC)}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

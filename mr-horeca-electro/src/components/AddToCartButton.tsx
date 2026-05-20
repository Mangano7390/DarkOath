"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, ShoppingBag, Check } from "lucide-react";

export function AddToCartButton({ sku }: { sku: string }) {
  const [qty, setQty] = useState(1);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function add() {
    startTransition(async () => {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku, qty }),
      });
      if (res.ok) {
        setDone(true);
        router.refresh();
        setTimeout(() => setDone(false), 1500);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center border rounded-md h-12">
        <button
          type="button"
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          className="h-full w-10 hover:bg-accent"
          aria-label="Diminuer"
        >
          −
        </button>
        <input
          value={qty}
          onChange={(e) => setQty(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
          className="h-full w-12 text-center bg-transparent focus:outline-none"
          aria-label="Quantité"
        />
        <button
          type="button"
          onClick={() => setQty((q) => Math.min(99, q + 1))}
          className="h-full w-10 hover:bg-accent"
          aria-label="Augmenter"
        >
          +
        </button>
      </div>
      <Button size="lg" className="flex-1" onClick={add} disabled={pending}>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : done ? (
          <Check className="h-4 w-4" />
        ) : (
          <ShoppingBag className="h-4 w-4" />
        )}
        {done ? "Ajouté au panier" : "Ajouter au panier"}
      </Button>
    </div>
  );
}

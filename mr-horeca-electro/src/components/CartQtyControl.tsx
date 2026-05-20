"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

export function CartQtyControl({ sku, qty }: { sku: string; qty: number }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function update(newQty: number) {
    startTransition(async () => {
      await fetch("/api/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku, qty: newQty }),
      });
      router.refresh();
    });
  }

  return (
    <div className="inline-flex items-center gap-2">
      <div className="inline-flex items-center border rounded-md h-9">
        <button
          type="button"
          className="h-full w-9 hover:bg-accent disabled:opacity-50"
          onClick={() => update(qty - 1)}
          disabled={pending}
          aria-label="Diminuer"
        >
          −
        </button>
        <div className="h-full w-10 flex items-center justify-center text-sm">
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : qty}
        </div>
        <button
          type="button"
          className="h-full w-9 hover:bg-accent disabled:opacity-50"
          onClick={() => update(qty + 1)}
          disabled={pending}
          aria-label="Augmenter"
        >
          +
        </button>
      </div>
      <button
        type="button"
        onClick={() => update(0)}
        className="text-muted-foreground hover:text-destructive transition"
        aria-label="Supprimer"
        disabled={pending}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

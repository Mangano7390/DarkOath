import Link from "next/link";
import { ShoppingBag, Search, Menu } from "lucide-react";
import { readCart, totalQty } from "@/lib/cart";

export async function Header() {
  const cart = await readCart();
  const count = totalQty(cart);
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white/90 backdrop-blur">
      <div className="container flex h-16 items-center gap-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-bold text-lg tracking-tight text-horeca">Mr Horeca</span>
          <span className="text-muted-foreground">&amp;</span>
          <span className="font-bold text-lg tracking-tight text-electro-accent">Mr Electro</span>
        </Link>
        <nav className="hidden md:flex items-center gap-5 text-sm font-medium">
          <Link href="/horeca" className="hover:text-horeca transition-colors">
            HoReCa Pro
          </Link>
          <Link href="/electro" className="hover:text-electro-accent transition-colors">
            Electro
          </Link>
          <Link href="/contact" className="hover:text-foreground/80 text-muted-foreground">
            Contact
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/cart"
            className="relative inline-flex items-center gap-2 rounded-md border px-3 h-10 hover:bg-accent text-sm"
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">Panier</span>
            {count > 0 ? (
              <span className="absolute -top-2 -right-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-electro-accent px-1 text-xs font-bold text-white">
                {count}
              </span>
            ) : null}
          </Link>
        </div>
      </div>
    </header>
  );
}

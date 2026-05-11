"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Wrench,
  Inbox,
  BookOpen,
  BarChart3,
  Truck,
  PackageSearch,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/quotes", label: "Devis", icon: FileText },
  { href: "/tickets", label: "SAV", icon: Wrench },
  { href: "/inbox", label: "Boîte de réception", icon: Inbox },
  { href: "/catalog", label: "Fiches produits", icon: BookOpen },
  { href: "/insights", label: "Analyses", icon: BarChart3 },
  { href: "/routes", label: "Tournées", icon: Truck },
  { href: "/stock", label: "Stock", icon: PackageSearch },
];

export function Sidebar({ userName, userEmail }: { userName: string; userEmail: string }) {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:w-60 md:flex-col border-r bg-background">
      <div className="px-4 py-5 border-b">
        <div className="text-sm font-semibold">HoReCa AI</div>
        <div className="text-xs text-muted-foreground">{process.env.NEXT_PUBLIC_COMPANY ?? "Distribution"}</div>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                active
                  ? "bg-secondary text-secondary-foreground font-medium"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t px-3 py-3">
        <div className="text-xs font-medium truncate">{userName}</div>
        <div className="text-xs text-muted-foreground truncate">{userEmail}</div>
        <form action="/api/auth/signout" method="post" className="mt-2">
          <button
            type="submit"
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" /> Déconnexion
          </button>
        </form>
      </div>
    </aside>
  );
}

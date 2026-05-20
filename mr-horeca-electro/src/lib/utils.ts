import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(value: number | string, withVAT = true): string {
  const ht = typeof value === "string" ? Number(value) : value;
  const ttc = withVAT ? ht * 1.21 : ht;
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(ttc);
}

export function fromDecimal(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof (value as { toString?: () => string }).toString === "function") {
    return Number((value as { toString: () => string }).toString());
  }
  return 0;
}

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

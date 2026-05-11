import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string, locale = "fr-BE", currency = "EUR") {
  const n = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(n);
}

export function formatDate(d: Date | string, locale = "fr-BE") {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

export function toDecimal(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  // Prisma Decimal exposes toString()
  if (typeof (value as { toString?: () => string }).toString === "function") {
    return Number((value as { toString: () => string }).toString());
  }
  return 0;
}

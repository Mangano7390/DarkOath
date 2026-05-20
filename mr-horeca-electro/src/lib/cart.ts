import { cookies } from "next/headers";
import { z } from "zod";

const COOKIE = "mhe_cart";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const cartItemSchema = z.object({
  sku: z.string().min(1),
  qty: z.number().int().min(1).max(99),
});

const cartSchema = z.object({
  items: z.array(cartItemSchema).max(50),
});

export type CartItem = z.infer<typeof cartItemSchema>;
export type Cart = z.infer<typeof cartSchema>;

const EMPTY: Cart = { items: [] };

export async function readCart(): Promise<Cart> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return EMPTY;
  try {
    const parsed = cartSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY;
  } catch {
    return EMPTY;
  }
}

export async function writeCart(cart: Cart): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, JSON.stringify(cart), {
    httpOnly: false, // readable client-side for cart count
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function addToCart(sku: string, qty = 1): Promise<Cart> {
  const cart = await readCart();
  const existing = cart.items.find((i) => i.sku === sku);
  if (existing) {
    existing.qty = Math.min(99, existing.qty + qty);
  } else {
    cart.items.push({ sku, qty });
  }
  await writeCart(cart);
  return cart;
}

export async function updateQty(sku: string, qty: number): Promise<Cart> {
  const cart = await readCart();
  if (qty <= 0) {
    cart.items = cart.items.filter((i) => i.sku !== sku);
  } else {
    const item = cart.items.find((i) => i.sku === sku);
    if (item) item.qty = Math.min(99, qty);
  }
  await writeCart(cart);
  return cart;
}

export async function clearCart(): Promise<void> {
  await writeCart(EMPTY);
}

export function totalQty(cart: Cart): number {
  return cart.items.reduce((s, i) => s + i.qty, 0);
}

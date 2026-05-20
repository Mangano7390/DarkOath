import { NextResponse } from "next/server";
import { z } from "zod";
import { addToCart, readCart, updateQty } from "@/lib/cart";

const addSchema = z.object({ sku: z.string().min(1), qty: z.number().int().min(1).max(99).default(1) });
const updateSchema = z.object({ sku: z.string().min(1), qty: z.number().int().min(0).max(99) });

export async function GET() {
  const cart = await readCart();
  return NextResponse.json({ cart });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });
  const cart = await addToCart(parsed.data.sku, parsed.data.qty);
  return NextResponse.json({ cart });
}

export async function PATCH(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });
  const cart = await updateQty(parsed.data.sku, parsed.data.qty);
  return NextResponse.json({ cart });
}

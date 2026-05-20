import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { readCart, clearCart } from "@/lib/cart";
import { hydrateCart } from "@/server/cart.service";
import { getMollie } from "@/lib/mollie";

export const runtime = "nodejs";

const schema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(40).optional().or(z.literal("")),
  companyName: z.string().max(200).optional().or(z.literal("")),
  vatNumber: z.string().max(40).optional().or(z.literal("")),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional().or(z.literal("")),
  zip: z.string().min(2).max(20),
  city: z.string().min(1).max(100),
  country: z.string().length(2).default("BE"),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

async function nextOrderNumber() {
  const rows = await prisma.$queryRaw<{ nextval: bigint }[]>(
    Prisma.sql`SELECT nextval('order_seq')`,
  );
  const n = rows[0]?.nextval ?? BigInt(10000);
  const year = new Date().getFullYear();
  return `CMD-${year}-${n.toString().padStart(5, "0")}`;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const cart = await readCart();
  const hydrated = await hydrateCart(cart);
  if (hydrated.items.length === 0) {
    return NextResponse.json({ error: "empty_cart" }, { status: 400 });
  }

  const number = await nextOrderNumber();
  const shipAddress = {
    fullName: `${data.firstName} ${data.lastName}`,
    line1: data.line1,
    line2: data.line2 || null,
    zip: data.zip,
    city: data.city,
    country: data.country,
    phone: data.phone || null,
  };

  const order = await prisma.order.create({
    data: {
      number,
      status: "PENDING",
      guestEmail: data.email,
      guestFirstName: data.firstName,
      guestLastName: data.lastName,
      guestPhone: data.phone || null,
      guestCompany: data.companyName || null,
      guestVat: data.vatNumber || null,
      shipAddress,
      subtotalHT: hydrated.subtotalHT,
      totalVAT: hydrated.totalVAT,
      totalTTC: hydrated.totalTTC,
      notes: data.notes || null,
      items: {
        create: hydrated.items.map((it) => ({
          sku: it.sku,
          name: it.name,
          qty: it.qty,
          unitPriceHT: it.unitPriceHT,
          vatRate: it.vatRate,
          product: { connect: { sku: it.sku } },
        })),
      },
    },
  });

  // Create Mollie payment
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";
  const webhookUrl = process.env.MOLLIE_WEBHOOK_URL ?? `${siteUrl}/api/checkout/webhook`;

  let redirectUrl: string;
  try {
    const mollie = getMollie();
    const payment = await mollie.payments.create({
      amount: { currency: "EUR", value: hydrated.totalTTC.toFixed(2) },
      description: `Commande ${order.number}`,
      redirectUrl: `${siteUrl}/checkout/success?order=${order.number}`,
      webhookUrl,
      metadata: { orderId: order.id, orderNumber: order.number },
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { molliePaymentId: payment.id },
    });
    redirectUrl = payment.getCheckoutUrl() ?? `${siteUrl}/checkout/success?order=${order.number}`;
  } catch (err) {
    // If Mollie is misconfigured (no API key in dev), fall back to a stub success page.
    console.error("mollie_error", err);
    redirectUrl = `${siteUrl}/checkout/success?order=${order.number}&stub=1`;
  }

  await clearCart();
  return NextResponse.json({ ok: true, orderNumber: order.number, redirectUrl });
}

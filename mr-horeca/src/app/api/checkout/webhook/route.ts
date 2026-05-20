import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getMollie } from "@/lib/mollie";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Mollie posts application/x-www-form-urlencoded with `id` = paymentId
  const text = await req.text();
  const params = new URLSearchParams(text);
  const paymentId = params.get("id");
  if (!paymentId) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  try {
    const mollie = getMollie();
    const payment = await mollie.payments.get(paymentId);
    const order = await prisma.order.findFirst({ where: { molliePaymentId: paymentId } });
    if (!order) return NextResponse.json({ error: "order_not_found" }, { status: 404 });

    if (payment.isPaid()) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: "PAID",
          paidAt: new Date(),
          paymentMethod:
            payment.method === "bancontact"
              ? "BANCONTACT"
              : payment.method === "ideal"
                ? "IDEAL"
                : payment.method === "banktransfer"
                  ? "BANK_TRANSFER"
                  : "CARD",
        },
      });
      // Decrement stock
      const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
      for (const item of items) {
        if (item.productId) {
          await prisma.product.update({
            where: { id: item.productId },
            data: { stockQty: { decrement: item.qty } },
          });
        }
      }
    } else if (payment.isCanceled() || payment.isExpired() || payment.isFailed()) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "CANCELLED" },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("webhook_error", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

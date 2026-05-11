import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchProductsTool } from "@/lib/ai/tools/catalog";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ products: [] });
  const products = await searchProductsTool.handler(
    { query: q, limit: 10 },
    { userId: session.user.id, locale: session.user.locale ?? "fr" },
  );
  return NextResponse.json({ products });
}

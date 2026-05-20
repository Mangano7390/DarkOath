import createMollieClient, { MollieClient } from "@mollie/api-client";

let cached: MollieClient | null = null;

export function getMollie(): MollieClient {
  if (cached) return cached;
  const apiKey = process.env.MOLLIE_API_KEY;
  if (!apiKey) throw new Error("MOLLIE_API_KEY missing");
  cached = createMollieClient({ apiKey });
  return cached;
}

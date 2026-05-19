import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { demoSpend } from "../../drizzle/schema";

const COOKIE = "fold_demo_id";
const TTL_SECONDS = 24 * 60 * 60;

/** Per-cookie spend cap in cents. $1 → soft error after this. */
export const CAP_CENTS = 100;

// Anthropic public prices (cents per million tokens) — approximate.
// Erring slightly high so under-billing the cap is safer than over-billing.
type Price = { input: number; output: number };
const PRICING: Record<string, Price> = {
  "claude-haiku-4-5-20251001": { input: 100, output: 500 },
  "claude-sonnet-4-6": { input: 300, output: 1500 },
};

const DEFAULT_PRICING: Price = { input: 300, output: 1500 };

export async function getOrCreateDemoId(): Promise<string> {
  const c = await cookies();
  const existing = c.get(COOKIE)?.value;
  if (existing) return existing;
  const id = randomBytes(16).toString("hex");
  c.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: TTL_SECONDS,
    path: "/",
  });
  return id;
}

export async function readSpent(id: string): Promise<number> {
  const [row] = await db.select().from(demoSpend).where(eq(demoSpend.id, id)).limit(1);
  return row?.spentCents ?? 0;
}

export async function bumpSpend(id: string, cents: number) {
  if (cents <= 0) return;
  await db
    .insert(demoSpend)
    .values({ id, spentCents: cents, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: demoSpend.id,
      set: {
        spentCents: sql`${demoSpend.spentCents} + ${cents}`,
        updatedAt: new Date(),
      },
    });
}

export function estimateCostCents(
  model: string | undefined,
  inputTokens: number,
  outputTokens: number
): number {
  const p: Price = (model ? PRICING[model] : undefined) ?? DEFAULT_PRICING;
  const totalMicroCents = inputTokens * p.input + outputTokens * p.output;
  return Math.ceil(totalMicroCents / 1_000_000);
}

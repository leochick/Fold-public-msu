import { headers } from "next/headers";
import { eq, asc } from "drizzle-orm";
import { db } from "./db";
import { users } from "../../drizzle/schema";
import { auth } from "./better-auth";

export function isDemoMode() {
  return process.env.DEMO_MODE === "1";
}

export async function getCurrentUser() {
  if (isDemoMode()) {
    const rows = await db.select().from(users).orderBy(asc(users.id)).limit(1);
    return rows[0] ?? null;
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  // Stop using Number() or checking for NaN. Better Auth uses strings here.
  const userId = session.user.id;
  if (!userId) return null;

  // Cast users.id to string or match it directly depending on how your schema settled
  const [row] = await db.select().from(users).where(eq(users.id, userId as any)).limit(1);
  return row ?? null;
}

export async function requireUser() {
  const u = await getCurrentUser();
  if (!u) throw new Error("UNAUTHORIZED");
  return u;
}

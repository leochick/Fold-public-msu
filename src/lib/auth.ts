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

  // Modern Better Auth IDs can be strings or integers.
  // Let's pass the raw session ID cleanly to the database query:
  const userId = session.user.id;
  if (!userId) return null;

  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return row ?? null;
}

export async function requireUser() {
  const u = await getCurrentUser();
  if (!u) throw new Error("UNAUTHORIZED");
  return u;
}

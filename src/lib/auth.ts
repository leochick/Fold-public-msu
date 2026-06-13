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

  // Since user.id will be an auto-incremented integer string ("16"), parse it to a number
  const userId = Number(session.user.id);
  if (!userId || isNaN(userId)) return null;

  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return row ?? null;
}

export async function requireUser() {
  const u = await getCurrentUser();
  if (!u) throw new Error("UNAUTHORIZED");
  return u;
}

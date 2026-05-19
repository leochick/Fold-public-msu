import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "../../../../drizzle/schema";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    await db.select({ c: sql<number>`count(*)` }).from(users);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

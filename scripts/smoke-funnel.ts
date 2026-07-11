/**
 * End-to-end smoke test for Smart Intake dedup.
 * Exercises the headline scenario: Leader A adds "Jordan Chen", Leader B adds
 * "Alexander Chen" 30s later → server dedup must surface Mike as a duplicate.
 *
 * Usage: tsx scripts/smoke-funnel.ts (requires `npm run dev` on :3000)
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import * as schema from "../drizzle/schema";
const { users, sessions, students } = schema;

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = drizzle(client, { schema });

async function ensureUser(email: string, displayName: string) {
  let [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!u) {
    [u] = await db.insert(users).values({ id: randomBytes(16).toString("hex"), email, name: displayName, password: "smoketest" }).returning();
  }
  return u;
}

async function mintCookie(userId: string) {
  const id = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ id, token: id, userId, expiresAt });
  return `fold.session_token=${id}`;
}

async function cleanup() {
  // Remove any leftover smoke-test rows from prior runs.
  await client.execute(
    "DELETE FROM students WHERE (first_name IN ('Mike','Michael') AND last_name = 'Park') OR (first_name = 'Hannah' AND last_name IN ('Lee','Choi'))"
  );
}

async function main() {
  await cleanup();

  const leaderA = await ensureUser("smoke-a@example.com", "Leader A");
  const leaderB = await ensureUser("smoke-b@example.com", "Leader B");
  const cookieA = await mintCookie(String(leaderA.id));
  const cookieB = await mintCookie(String(leaderB.id));

  console.log("\n=== Window A: paste 'Jordan Chen, freshman bro, IG @jordanc99, met at the booth tonight' ===");
  const parseA = await fetch(BASE + "/api/intake/parse", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookieA },
    body: JSON.stringify({
      text: "Jordan Chen, freshman bro, IG @jordanc99, met at the booth tonight",
    }),
  });
  const parseAJson = await parseA.json();
  console.log("status:", parseA.status);
  console.log("contacts:");
  for (const c of parseAJson.contacts ?? []) {
    console.log(
      `  ${c.contactId}  ${c.firstName ?? ""} ${c.lastName ?? ""} (${c.match}, gender=${c.gender ?? "?"}, year=${c.year ?? "?"})`
    );
    console.log(`    firstMetContext: ${c.firstMetContext ?? "—"}`);
    console.log(`    serverDedupCandidates: ${c.serverDedupCandidates.length}`);
  }

  const commitA = await fetch(BASE + "/api/intake/commit", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookieA },
    body: JSON.stringify({ contacts: parseAJson.contacts }),
  });
  console.log("commit A:", commitA.status, await commitA.json());

  // Show new Mike row
  const [mike] = await db
    .select()
    .from(students)
    .where(eq(students.firstName, "Mike"))
    .limit(1);
  console.log(
    `\nMike row → id=${mike.id}, addedBy=${mike.addedByUserId}, firstMetContext=${mike.firstMetContext}`
  );

  console.log("\n=== Window B (30s later): paste 'Alexander Chen, freshman, IG @jordanc99' ===");
  const parseB = await fetch(BASE + "/api/intake/parse", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookieB },
    body: JSON.stringify({
      text: "Alexander Chen, freshman, IG @jordanc99",
    }),
  });
  const parseBJson = await parseB.json();
  console.log("status:", parseB.status);
  console.log("contacts:");
  for (const c of parseBJson.contacts ?? []) {
    console.log(
      `  ${c.contactId}  ${c.firstName ?? ""} ${c.lastName ?? ""} (${c.match})`
    );
    if (c.serverDedupCandidates.length > 0) {
      console.log(`    🚨 server dedup found ${c.serverDedupCandidates.length} candidate(s):`);
      for (const cand of c.serverDedupCandidates) {
        console.log(
          `      • ${cand.displayName}  score=${cand.score}  reasons=[${cand.reasons.join(",")}]  addedBy=${cand.addedByDisplayName ?? "?"}`
        );
      }
    }
  }

  const firstContact = parseBJson.contacts?.[0];
  const claudeMatchedDirectly =
    firstContact?.match === "existing" && firstContact?.studentId === mike.id;
  const serverDedupCaught =
    firstContact?.serverDedupCandidates?.length > 0 &&
    firstContact.serverDedupCandidates[0].studentId === mike.id;
  if (claudeMatchedDirectly) {
    console.log(
      "\n✅ Claude correctly identified Michael as existing Mike (via shared IG handle)."
    );
  } else if (serverDedupCaught) {
    console.log("\n✅ Server dedup correctly surfaced Mike as a duplicate of Michael.");
  } else {
    console.log("\n❌ FAIL: Neither Claude nor server caught the duplicate.");
    process.exit(1);
  }

  // Leader B adopts the existing Mike (via Claude match or server dedup) — no new row.
  console.log("\n=== Window B: adopt existing Mike (no new create) ===");
  const adopted = parseBJson.contacts.map((c: any, i: number) => {
    if (i !== 0) return c;
    if (c.match !== "existing" && c.serverDedupCandidates?.length > 0) {
      const cand = c.serverDedupCandidates[0];
      return {
        ...c,
        match: "existing",
        studentId: cand.studentId,
      };
    }
    return c;
  });
  const commitB = await fetch(BASE + "/api/intake/commit", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookieB },
    body: JSON.stringify({ contacts: adopted }),
  });
  console.log("commit B:", commitB.status, await commitB.json());

  // Verify state
  const [mike2] = await db
    .select()
    .from(students)
    .where(eq(students.id, mike.id))
    .limit(1);
  const totalMikes = await client.execute(
    "SELECT COUNT(*) as c FROM students WHERE first_name IN ('Mike','Michael')"
  );
  const totalMikesCount = totalMikes.rows[0].c as number;

  console.log("\n=== Final state ===");
  console.log(`Mike row → id=${mike2.id}, firstMetContext=${mike2.firstMetContext}`);
  console.log(`Total Mike/Michael rows in DB: ${totalMikesCount} (must be 1)`);

  if (totalMikesCount !== 1) {
    console.log("❌ FAIL: duplicate row was created.");
    process.exit(1);
  }
  console.log("\n✅ Scenario 1 passed (Claude+IG handle catches Mike↔Michael).");

  // ---------- Scenario 2: server dedup safety net ----------
  // Leader A adds "Hannah Lee" with phone. Leader B types "Hannah Choi" with the same phone.
  // Claude will see different last names and likely say "new" — server phone_last7 must catch.
  console.log("\n=== Scenario 2: server safety net (different last name, same phone) ===");
  const parseHannahA = await fetch(BASE + "/api/intake/parse", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookieA },
    body: JSON.stringify({
      text: "Met Hannah Lee at the booth, freshman, phone 650-555-9876",
    }),
  });
  const parseHannahAJson = await parseHannahA.json();
  await fetch(BASE + "/api/intake/commit", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookieA },
    body: JSON.stringify({ contacts: parseHannahAJson.contacts }),
  });

  const parseHannahB = await fetch(BASE + "/api/intake/parse", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookieB },
    body: JSON.stringify({
      text: "Hannah Choi, freshman, phone (650) 555-9876, met at BBQ",
    }),
  });
  const parseHannahBJson = await parseHannahB.json();
  console.log("contacts:");
  let serverCaught = false;
  for (const c of parseHannahBJson.contacts ?? []) {
    console.log(
      `  ${c.contactId}  ${c.firstName ?? ""} ${c.lastName ?? ""} (${c.match})`
    );
    if (c.serverDedupCandidates.length > 0) {
      console.log(`    🛡  server safety net flagged ${c.serverDedupCandidates.length} candidate(s):`);
      for (const cand of c.serverDedupCandidates) {
        console.log(
          `      • ${cand.displayName}  score=${cand.score}  reasons=[${cand.reasons.join(",")}]`
        );
        if (cand.reasons.includes("phone_last7")) serverCaught = true;
      }
    }
  }

  if (!serverCaught) {
    console.log(
      "ℹ Note: Claude may have caught Hannah on its own (which is the desired good case). " +
      "The server safety net only fires when Claude says match=new."
    );
    const wasNew = parseHannahBJson.contacts?.[0]?.match === "new";
    if (wasNew) {
      console.log("❌ FAIL: Claude said 'new' but server didn't catch via phone_last7.");
      process.exit(1);
    } else {
      console.log("✅ Scenario 2: Claude classified as existing on its own — safety net not needed.");
    }
  } else {
    console.log("\n✅ Scenario 2: server safety net caught the duplicate via phone match.");
  }

  console.log("\n🎉 All scenarios passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

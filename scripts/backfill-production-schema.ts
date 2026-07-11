/**
 * Idempotent backfill for production schema drift.
 *
 * Production was partially migrated outside drizzle's migrator (Better Auth recovery
 * scripts, manually journaled migrations). This script applies any remaining schema
 * fixes and records migrations 0015–0017 in __drizzle_migrations without re-running
 * SQL that would fail on an already-migrated database.
 *
 * Run with:
 *   npx tsx --env-file=.env.production.local scripts/backfill-production-schema.ts
 */
import { createClient, type Client } from "@libsql/client";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle/migrations");
const JOURNAL_PATH = path.join(MIGRATIONS_DIR, "meta/_journal.json");

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function tableExists(db: Client, name: string) {
  const r = await db.execute({
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
    args: [name],
  });
  return r.rows.length > 0;
}

async function columnExists(db: Client, table: string, column: string) {
  const r = await db.execute(`PRAGMA table_info(${table})`);
  return r.rows.some((row) => row.name === column);
}

async function columnType(db: Client, table: string, column: string) {
  const r = await db.execute(`PRAGMA table_info(${table})`);
  const row = r.rows.find((entry) => entry.name === column);
  return row ? String(row.type).toUpperCase() : null;
}

function migrationHash(tag: string) {
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, `${tag}.sql`), "utf8");
  return crypto.createHash("sha256").update(sql).digest("hex");
}

async function migrationApplied(db: Client, hash: string) {
  const r = await db.execute({
    sql: "SELECT 1 FROM __drizzle_migrations WHERE hash = ? LIMIT 1",
    args: [hash],
  });
  return r.rows.length > 0;
}

async function recordMigration(db: Client, tag: string, when: number) {
  const hash = migrationHash(tag);
  if (await migrationApplied(db, hash)) {
    console.log(`  skip journal: ${tag} already recorded`);
    return;
  }
  await db.execute({
    sql: "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
    args: [hash, when],
  });
  console.log(`  record journal: ${tag}`);
}

async function ensureTextUserIds(db: Client) {
  console.log("\n0015 text user ids:");
  if (await columnExists(db, "users", "password")) {
    console.log("  skip: users already uses Better Auth column names");
    return;
  }

  await db.execute("PRAGMA foreign_keys=OFF");

  await db.execute(`CREATE TABLE users__new (
    id text PRIMARY KEY NOT NULL,
    email text NOT NULL,
    password text,
    name text NOT NULL,
    email_verified integer DEFAULT 0 NOT NULL,
    image text,
    created_at integer DEFAULT (unixepoch()) NOT NULL,
    updated_at integer DEFAULT (unixepoch()) NOT NULL
  )`);
  await db.execute(`INSERT INTO users__new (id, email, password, name, email_verified, image, created_at, updated_at)
    SELECT cast(id as text), email, password_hash, display_name, email_verified, image, created_at, updated_at
    FROM users`);
  await db.execute("DROP TABLE users");
  await db.execute("ALTER TABLE users__new RENAME TO users");
  await db.execute("CREATE UNIQUE INDEX users_email_unique ON users (email)");
  console.log("  migrate: users");

  await db.execute(`CREATE TABLE sessions__new (
    id text PRIMARY KEY NOT NULL,
    token text NOT NULL,
    user_id text NOT NULL,
    expires_at integer NOT NULL,
    ip_address text,
    user_agent text,
    created_at integer DEFAULT (unixepoch()) NOT NULL,
    updated_at integer DEFAULT (unixepoch()) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  await db.execute(`INSERT INTO sessions__new (id, token, user_id, expires_at, ip_address, user_agent, created_at, updated_at)
    SELECT id, token, cast(user_id as text), expires_at, ip_address, user_agent, created_at, updated_at
    FROM sessions`);
  await db.execute("DROP TABLE sessions");
  await db.execute("ALTER TABLE sessions__new RENAME TO sessions");
  await db.execute("CREATE UNIQUE INDEX sessions_token_unique ON sessions (token)");
  console.log("  migrate: sessions");

  if (await tableExists(db, "account")) {
    await db.execute(`CREATE TABLE account__new (
      id text PRIMARY KEY NOT NULL,
      account_id text NOT NULL,
      provider_id text NOT NULL,
      user_id text NOT NULL,
      access_token text,
      refresh_token text,
      id_token text,
      access_token_expires_at integer,
      refresh_token_expires_at integer,
      scope text,
      password text,
      created_at integer DEFAULT (unixepoch()) NOT NULL,
      updated_at integer DEFAULT (unixepoch()) NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    await db.execute(`INSERT INTO account__new (
      id, account_id, provider_id, user_id, access_token, refresh_token, id_token,
      access_token_expires_at, refresh_token_expires_at, scope, password, created_at, updated_at
    )
      SELECT id, account_id, provider_id, cast(user_id as text), access_token, refresh_token, id_token,
        access_token_expires_at, refresh_token_expires_at, scope, password, created_at, updated_at
      FROM account`);
    await db.execute("DROP TABLE account");
    await db.execute("ALTER TABLE account__new RENAME TO account");
    console.log("  migrate: account");
  }

  await db.execute(`CREATE TABLE attendances__new (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    student_id integer NOT NULL,
    event_id integer NOT NULL,
    recorded_by text,
    recorded_at integer DEFAULT (unixepoch()) NOT NULL,
    notes text,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
  )`);
  await db.execute(`INSERT INTO attendances__new (id, student_id, event_id, recorded_by, recorded_at, notes)
    SELECT id, student_id, event_id, cast(recorded_by as text), recorded_at, notes
    FROM attendances`);
  await db.execute("DROP TABLE attendances");
  await db.execute("ALTER TABLE attendances__new RENAME TO attendances");
  await db.execute("CREATE UNIQUE INDEX uniq_student_event ON attendances (student_id, event_id)");
  console.log("  migrate: attendances");

  await db.execute(`CREATE TABLE feedback__new (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    user_id text,
    text text NOT NULL,
    page text,
    created_at integer DEFAULT (unixepoch()) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  )`);
  await db.execute(`INSERT INTO feedback__new (id, user_id, text, page, created_at)
    SELECT id, cast(user_id as text), text, page, created_at
    FROM feedback`);
  await db.execute("DROP TABLE feedback");
  await db.execute("ALTER TABLE feedback__new RENAME TO feedback");
  console.log("  migrate: feedback");

  await db.execute(`CREATE TABLE contact_attempts__new (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    student_id integer NOT NULL,
    attempted_by_user_id text,
    channel text NOT NULL,
    channel_detail text,
    attempted_at integer DEFAULT (unixepoch()) NOT NULL,
    responded integer DEFAULT 0 NOT NULL,
    notes text,
    created_at integer DEFAULT (unixepoch()) NOT NULL,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (attempted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
  )`);
  await db.execute(`INSERT INTO contact_attempts__new (
    id, student_id, attempted_by_user_id, channel, channel_detail, attempted_at, responded, notes, created_at
  )
    SELECT id, student_id, cast(attempted_by_user_id as text), channel, channel_detail, attempted_at, responded, notes, created_at
    FROM contact_attempts`);
  await db.execute("DROP TABLE contact_attempts");
  await db.execute("ALTER TABLE contact_attempts__new RENAME TO contact_attempts");
  console.log("  migrate: contact_attempts");

  await db.execute("PRAGMA foreign_keys=ON");
}

async function ensureStudentsAddedByText(db: Client) {
  console.log("\n0017 students.added_by_user_id text:");
  const type = await columnType(db, "students", "added_by_user_id");
  if (type === "TEXT") {
    console.log("  skip: students.added_by_user_id already text");
    return;
  }

  await db.execute("PRAGMA foreign_keys=OFF");
  await db.execute(`CREATE TABLE students__new (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    first_name text NOT NULL,
    last_name text,
    student_id text,
    gender text,
    year text,
    phone text,
    email text,
    ig_handle text,
    member_status text,
    newsletter integer DEFAULT 0 NOT NULL,
    groupme integer DEFAULT 0 NOT NULL,
    contacted_via_ig integer DEFAULT 0 NOT NULL,
    primary_contact text,
    goals text,
    notes text,
    course_material text,
    added_by_user_id text,
    first_met_context text,
    first_met_at integer,
    invited_by_student_id integer,
    created_at integer DEFAULT (unixepoch()) NOT NULL,
    updated_at integer DEFAULT (unixepoch()) NOT NULL,
    FOREIGN KEY (added_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (invited_by_student_id) REFERENCES students(id) ON DELETE SET NULL
  )`);
  await db.execute(`INSERT INTO students__new (
    id, first_name, last_name, student_id, gender, year, phone, email, ig_handle,
    member_status, newsletter, groupme, contacted_via_ig, primary_contact,
    goals, notes, course_material, added_by_user_id, first_met_context, first_met_at,
    invited_by_student_id, created_at, updated_at
  )
    SELECT
      id, first_name, last_name, student_id, gender, year, phone, email, ig_handle,
      member_status, newsletter, groupme, contacted_via_ig, primary_contact,
      goals, notes, course_material, cast(added_by_user_id as text), first_met_context, first_met_at,
      invited_by_student_id, created_at, updated_at
    FROM students`);
  await db.execute("DROP TABLE students");
  await db.execute("ALTER TABLE students__new RENAME TO students");
  await db.execute("PRAGMA foreign_keys=ON");
  console.log("  migrate: students.added_by_user_id -> text");
}

async function main() {
  console.log("Backfilling production schema + migration journal...\n");

  await ensureTextUserIds(client);
  await ensureStudentsAddedByText(client);

  console.log("\nRecording migration journal entries:");
  const journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, "utf8")) as {
    entries: Array<{ tag: string; when: number }>;
  };
  for (const entry of journal.entries.slice(15)) {
    await recordMigration(client, entry.tag, entry.when);
  }

  console.log("\n✓ Production schema backfill complete.");
  client.close();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});

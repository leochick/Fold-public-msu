/**
 * One-shot migration to apply 0007 (Better Auth) directly, bypassing drizzle's migrator.
 * Why: the demo Turso DB drifted from drizzle's __drizzle_migrations tracker, so the migrator
 * tries to re-run 0006 and hits duplicate-column errors. This script is idempotent — it
 * checks existing columns/tables before each change.
 *
 * Run with: npx tsx --env-file=.env.production.local scripts/migrate-better-auth.ts
 */
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function tableExists(name: string) {
  const r = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
    args: [name],
  });
  return r.rows.length > 0;
}

async function columnExists(table: string, column: string) {
  const r = await client.execute(`PRAGMA table_info(${table})`);
  return r.rows.some((row) => row.name === column);
}

async function indexExists(name: string) {
  const r = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type='index' AND name = ?",
    args: [name],
  });
  return r.rows.length > 0;
}

async function addColumnIfMissing(table: string, column: string, definition: string) {
  if (await columnExists(table, column)) {
    console.log(`  skip: ${table}.${column} already exists`);
    return;
  }
  await client.execute(`ALTER TABLE \`${table}\` ADD \`${column}\` ${definition}`);
  console.log(`  add:  ${table}.${column}`);
}

// SQLite ALTER TABLE ADD COLUMN can't use non-constant defaults (e.g. unixepoch()).
// Workaround: add with constant 0 default, then UPDATE all rows to current epoch.
// Drizzle/BA sets proper timestamps for new rows via the ORM-side default.
async function addTimestampColumnIfMissing(table: string, column: string) {
  if (await columnExists(table, column)) {
    console.log(`  skip: ${table}.${column} already exists`);
    return;
  }
  await client.execute(`ALTER TABLE \`${table}\` ADD \`${column}\` integer NOT NULL DEFAULT 0`);
  const upd = await client.execute(
    `UPDATE \`${table}\` SET \`${column}\` = unixepoch() WHERE \`${column}\` = 0`
  );
  console.log(`  add:  ${table}.${column} (set ${upd.rowsAffected} existing rows to now)`);
}

async function main() {
  console.log("Applying Better Auth schema additions...\n");

  // 1. users: nullable password_hash + email_verified, image, updated_at
  console.log("users:");
  await addColumnIfMissing("users", "email_verified", "integer DEFAULT 0 NOT NULL");
  await addColumnIfMissing("users", "image", "text");
  await addTimestampColumnIfMissing("users", "updated_at");
  // Note: we leave password_hash as-is. It was NOT NULL before, and SQLite can't change
  // that without a table rebuild. Setting it nullable in the schema is fine — existing rows
  // still satisfy the old constraint, and new INSERTs go through Better Auth which won't
  // touch this column.

  // 2. sessions: token + timestamps + ip/UA + unique index on token
  console.log("\nsessions:");
  await addColumnIfMissing("sessions", "token", "text NOT NULL DEFAULT ''");
  await addColumnIfMissing("sessions", "ip_address", "text");
  await addColumnIfMissing("sessions", "user_agent", "text");
  await addTimestampColumnIfMissing("sessions", "created_at");
  await addTimestampColumnIfMissing("sessions", "updated_at");
  // Backfill token = id for any rows where token is empty
  const upd = await client.execute("UPDATE `sessions` SET `token` = `id` WHERE `token` = ''");
  console.log(`  backfill token = id (${upd.rowsAffected} rows)`);
  if (!(await indexExists("sessions_token_unique"))) {
    await client.execute("CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`)");
    console.log("  add:  unique index sessions_token_unique");
  } else {
    console.log("  skip: sessions_token_unique already exists");
  }

  // 3. account table
  console.log("\naccount:");
  if (!(await tableExists("account"))) {
    await client.execute(`CREATE TABLE \`account\` (
      \`id\` text PRIMARY KEY NOT NULL,
      \`account_id\` text NOT NULL,
      \`provider_id\` text NOT NULL,
      \`user_id\` integer NOT NULL,
      \`access_token\` text,
      \`refresh_token\` text,
      \`id_token\` text,
      \`access_token_expires_at\` integer,
      \`refresh_token_expires_at\` integer,
      \`scope\` text,
      \`password\` text,
      \`created_at\` integer DEFAULT (unixepoch()) NOT NULL,
      \`updated_at\` integer DEFAULT (unixepoch()) NOT NULL,
      FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
    )`);
    console.log("  create: account");
  } else {
    console.log("  skip: account table already exists");
  }

  // 4. verification table
  console.log("\nverification:");
  if (!(await tableExists("verification"))) {
    await client.execute(`CREATE TABLE \`verification\` (
      \`id\` text PRIMARY KEY NOT NULL,
      \`identifier\` text NOT NULL,
      \`value\` text NOT NULL,
      \`expires_at\` integer NOT NULL,
      \`created_at\` integer DEFAULT (unixepoch()) NOT NULL,
      \`updated_at\` integer DEFAULT (unixepoch()) NOT NULL
    )`);
    console.log("  create: verification");
  } else {
    console.log("  skip: verification table already exists");
  }

  // 5. demo_spend table (per-cookie spend cap for demo deployments)
  console.log("\ndemo_spend:");
  if (!(await tableExists("demo_spend"))) {
    await client.execute(`CREATE TABLE \`demo_spend\` (
      \`id\` text PRIMARY KEY NOT NULL,
      \`spent_cents\` integer DEFAULT 0 NOT NULL,
      \`updated_at\` integer DEFAULT (unixepoch()) NOT NULL
    )`);
    console.log("  create: demo_spend");
  } else {
    console.log("  skip: demo_spend table already exists");
  }

  // 5. Backfill account rows from existing users.password_hash where not already present
  console.log("\nbackfill:");
  const existing = await client.execute(`
    SELECT u.id, u.password_hash
    FROM users u
    LEFT JOIN account a ON a.user_id = u.id AND a.provider_id = 'credential'
    WHERE u.password_hash IS NOT NULL AND u.password_hash != '' AND a.id IS NULL
  `);
  if (existing.rows.length === 0) {
    console.log("  no users need backfill");
  } else {
    for (const row of existing.rows) {
      await client.execute({
        sql: `INSERT INTO account (id, account_id, provider_id, user_id, password)
              VALUES (lower(hex(randomblob(16))), ?, 'credential', ?, ?)`,
        args: [String(row.id), Number(row.id), String(row.password_hash)],
      });
    }
    console.log(`  backfilled ${existing.rows.length} credential account rows`);
  }

  console.log("\n✓ Better Auth schema is live.");
  client.close();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

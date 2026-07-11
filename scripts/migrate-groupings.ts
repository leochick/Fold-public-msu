/**
 * One-shot migration to create the groupings table.
 * Idempotent — safe to run if the table already exists.
 *
 * Run with: npx tsx --env-file=.env.production.local scripts/migrate-groupings.ts
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

async function main() {
  console.log("Applying groupings schema...\n");

  if (!(await tableExists("groupings"))) {
    await client.execute(`CREATE TABLE \`groupings\` (
      \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      \`name\` text NOT NULL,
      \`view_id\` integer NOT NULL,
      \`checked_event_ids\` text,
      \`include_newsletter_contacts\` integer DEFAULT false NOT NULL,
      \`containers\` text NOT NULL,
      \`added_by_user_id\` text,
      \`created_at\` integer DEFAULT (unixepoch()) NOT NULL,
      \`updated_at\` integer DEFAULT (unixepoch()) NOT NULL,
      FOREIGN KEY (\`view_id\`) REFERENCES \`views\`(\`id\`) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (\`added_by_user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
    )`);
    console.log("create: groupings");
  } else {
    console.log("skip: groupings table already exists");
    const info = await client.execute("PRAGMA table_info(groupings)");
    const hasNewsletter = info.rows.some((row) => row.name === "include_newsletter_contacts");
    if (!hasNewsletter) {
      await client.execute(
        "ALTER TABLE `groupings` ADD `include_newsletter_contacts` integer DEFAULT false NOT NULL"
      );
      console.log("add: groupings.include_newsletter_contacts");
    }
  }

  console.log("\n✓ Groupings schema is live.");
  client.close();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

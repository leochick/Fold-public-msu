/**
 * Generate missing drizzle snapshot files (0012–0017) from cumulative migrations.
 *
 *   npx tsx scripts/generate-migration-snapshots.ts
 */
import { createClient } from "@libsql/client";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { drizzle } from "drizzle-orm/libsql";

const ROOT = process.cwd();
const META_DIR = path.join(ROOT, "drizzle/migrations/meta");
const MIGRATIONS_DIR = path.join(ROOT, "drizzle/migrations");
const TEMP_ROOT = path.join(ROOT, ".tmp-snapshot-gen");

type ColumnInfo = {
  name: string;
  type: string;
  notnull: number;
  dflt_value: unknown;
  pk: number;
};

type ForeignKeyInfo = {
  from: string;
  to: string;
  table: string;
  on_delete: string;
  on_update: string;
};

function normalizeDefault(value: unknown) {
  if (value == null) return undefined;
  const text = String(value);
  if (text === "true") return true;
  if (text === "false") return false;
  if (/^-?\d+$/.test(text)) return Number(text);
  return text;
}

function columnSnapshot(col: ColumnInfo) {
  const type = col.type.toLowerCase() || "text";
  const isIntegerPk = col.pk === 1 && type.includes("int");
  return {
    name: col.name,
    type,
    primaryKey: col.pk === 1,
    notNull: col.notnull === 1,
    autoincrement: isIntegerPk,
    ...(col.dflt_value != null ? { default: normalizeDefault(col.dflt_value) } : {}),
  };
}

async function snapshotFromDb(dbPath: string) {
  const client = createClient({ url: `file:${dbPath}` });
  const tables = (
    await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations' ORDER BY name"
    )
  ).rows.map((row) => String(row.name));

  const snapshotTables: Record<string, unknown> = {};
  for (const table of tables) {
    const cols = (await client.execute(`PRAGMA table_info(${table})`)).rows as unknown as ColumnInfo[];
    const indexes = (await client.execute(`PRAGMA index_list(${table})`)).rows as Array<{
      name: string;
      unique: number;
    }>;
    const fks = (await client.execute(`PRAGMA foreign_key_list(${table})`)).rows as unknown as ForeignKeyInfo[];

    const indexSnapshot: Record<string, unknown> = {};
    for (const index of indexes) {
      if (index.name.startsWith("sqlite_")) continue;
      const info = (await client.execute(`PRAGMA index_info(${index.name})`)).rows as Array<{ name: string }>;
      indexSnapshot[index.name] = {
        name: index.name,
        columns: info.map((entry) => entry.name),
        isUnique: index.unique === 1,
      };
    }

    const fkSnapshot: Record<string, unknown> = {};
    for (const fk of fks) {
      const key = `${table}_${fk.from}_${fk.table}_${fk.to}_fk`;
      fkSnapshot[key] = {
        name: key,
        tableFrom: table,
        tableTo: fk.table,
        columnsFrom: [fk.from],
        columnsTo: [fk.to],
        onDelete: fk.on_delete.replaceAll("_", " "),
        onUpdate: fk.on_update.replaceAll("_", " "),
      };
    }

    snapshotTables[table] = {
      name: table,
      columns: Object.fromEntries(cols.map((col) => [col.name, columnSnapshot(col)])),
      indexes: indexSnapshot,
      foreignKeys: fkSnapshot,
      compositePrimaryKeys: {},
      uniqueConstraints: {},
      checkConstraints: {},
    };
  }

  client.close();
  return snapshotTables;
}

function writeSnapshot(idx: number, prevId: string, tables: Record<string, unknown>) {
  const id = crypto.randomUUID();
  const snapshotName = `${String(idx).padStart(4, "0")}_snapshot.json`;
  const payload = {
    version: "6",
    dialect: "sqlite",
    id,
    prevId,
    tables,
    views: {},
    enums: {},
    _meta: { schemas: {}, tables: {}, columns: {} },
    internal: { indexes: {} },
  };
  fs.writeFileSync(path.join(META_DIR, snapshotName), `${JSON.stringify(payload, null, 2)}\n`);
  return id;
}

async function main() {
  fs.rmSync(TEMP_ROOT, { recursive: true, force: true });

  const journal = JSON.parse(fs.readFileSync(path.join(META_DIR, "_journal.json"), "utf8")) as {
    entries: Array<{ tag: string }>;
  };

  const prev0011 = JSON.parse(fs.readFileSync(path.join(META_DIR, "0011_snapshot.json"), "utf8")) as {
    id: string;
  };

  let prevId = prev0011.id;

  for (let idx = 12; idx < journal.entries.length; idx++) {
    const tag = journal.entries[idx].tag;
    const partialDir = path.join(TEMP_ROOT, tag);
    const dbPath = path.join(TEMP_ROOT, `${tag}.db`);

    fs.mkdirSync(path.join(partialDir, "meta"), { recursive: true });
    fs.writeFileSync(
      path.join(partialDir, "meta/_journal.json"),
      JSON.stringify({ ...journal, entries: journal.entries.slice(0, idx + 1) }, null, 2)
    );

    for (let i = 0; i <= idx; i++) {
      const partialTag = journal.entries[i].tag;
      fs.copyFileSync(
        path.join(MIGRATIONS_DIR, `${partialTag}.sql`),
        path.join(partialDir, `${partialTag}.sql`)
      );
    }

    const client = createClient({ url: `file:${dbPath}` });
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: partialDir });
    client.close();

    const tables = await snapshotFromDb(dbPath);
    prevId = writeSnapshot(idx, prevId, tables);
    console.log(`wrote ${String(idx).padStart(4, "0")}_snapshot.json`);
  }

  fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

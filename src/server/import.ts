import { db } from "@/lib/db";
import { students } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import { parseCsv, autoMap, coerce, SCHEMA_FIELDS, type SchemaField } from "@/lib/csv";
import { httpErr } from "@/lib/http";

export async function processImport(input: {
  csv: string;
  mode: "preview" | "commit";
  mapping?: SchemaField[];
}) {
  const rows = parseCsv(input.csv);
  if (rows.length < 2) throw httpErr.badRequest("csv has no data rows");

  const headers = rows[0].map((h) => h.trim());
  const dataRows = rows.slice(1);
  const mapping = input.mapping ?? autoMap(headers);

  if (input.mode === "preview") {
    return {
      headers,
      sample: dataRows.slice(0, 5),
      totalRows: dataRows.length,
      mapping,
    };
  }

  if (mapping.length !== headers.length) throw httpErr.badRequest("mapping length mismatch");
  if (!mapping.includes("firstName")) throw httpErr.badRequest("firstName is required in mapping");

  let created = 0;
  let updated = 0;

  for (const row of dataRows) {
    const data: Record<string, unknown> = {};
    for (let i = 0; i < headers.length; i++) {
      const f = mapping[i];
      if (f === "skip" || !SCHEMA_FIELDS.includes(f as never)) continue;
      const val = coerce(f, row[i] ?? "");
      if (val !== null && val !== undefined && val !== "") data[f] = val;
    }
    if (!data.firstName) continue;

    let existing: { id: number } | undefined;
    if (data.email) {
      const r = await db
        .select({ id: students.id })
        .from(students)
        .where(eq(students.email, String(data.email)))
        .limit(1);
      existing = r[0];
    }
    if (!existing && data.lastName) {
      const r = await db
        .select({ id: students.id })
        .from(students)
        .where(
          and(
            sql`lower(first_name) = ${String(data.firstName).toLowerCase()}`,
            sql`lower(coalesce(last_name, '')) = ${String(data.lastName).toLowerCase()}`
          )
        )
        .limit(1);
      existing = r[0];
    }

    if (existing) {
      await db
        .update(students)
        .set({ ...data, updatedAt: new Date() } as never)
        .where(eq(students.id, existing.id));
      updated += 1;
    } else {
      await db.insert(students).values(data as never);
      created += 1;
    }
  }

  return { ok: true, created, updated };
}

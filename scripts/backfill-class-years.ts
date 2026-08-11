/**
 * Recompute students.year from graduation_year using current date + academic calendar.
 *
 *   npx tsx --env-file=.env.production.local scripts/backfill-class-years.ts
 */
import { createClient } from "@libsql/client";
import {
  deriveClassYearFromGraduationYear,
  springEndsFromAcademicYears,
} from "../src/lib/class-year";
import type { AcademicSemesterData } from "../drizzle/schema";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  const years = await client.execute("SELECT name, spring FROM academic_years");
  const springEndsByYear = springEndsFromAcademicYears(
    years.rows.map((row) => ({
      name: String(row.name),
      spring: (typeof row.spring === "string" ? JSON.parse(row.spring) : row.spring) as AcademicSemesterData,
    }))
  );

  const students = await client.execute(
    "SELECT id, year, graduation_year FROM students WHERE graduation_year IS NOT NULL"
  );

  let updated = 0;
  for (const row of students.rows) {
    const id = Number(row.id);
    const graduationYear = Number(row.graduation_year);
    const nextYear = deriveClassYearFromGraduationYear(
      graduationYear,
      new Date(),
      springEndsByYear
    );
    if (!nextYear || nextYear === row.year) continue;
    await client.execute({
      sql: "UPDATE students SET year = ?, updated_at = unixepoch() WHERE id = ?",
      args: [nextYear, id],
    });
    updated += 1;
    console.log(`  #${id}: ${row.year ?? "null"} → ${nextYear} (grad ${graduationYear})`);
  }

  console.log(`✓ updated ${updated} / ${students.rows.length} students with graduation years`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

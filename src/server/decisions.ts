import { isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { formatDashboardDate } from "@/lib/dashboard-date-range";
import type { DecisionStudent } from "@/lib/decisions";
import { students } from "../../drizzle/schema";

export async function listDecisionStudents(): Promise<DecisionStudent[]> {
  const rows = await db
    .select({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      salvationDecisionAt: students.salvationDecisionAt,
      salvationDecisionType: students.salvationDecisionType,
      salvationDecisionNotes: students.salvationDecisionNotes,
    })
    .from(students)
    .where(isNotNull(students.salvationDecisionAt));

  const result: DecisionStudent[] = [];
  for (const row of rows) {
    if (!row.salvationDecisionAt) continue;
    result.push({
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      decisionAt: formatDashboardDate(row.salvationDecisionAt),
      decisionType: row.salvationDecisionType,
      notes: row.salvationDecisionNotes,
    });
  }
  return result;
}

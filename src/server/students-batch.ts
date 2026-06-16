import { db } from "@/lib/db";
import { students } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { anthropic, MODEL } from "@/lib/claude";
import { PARSE_STUDENTS_BATCH_TOOL } from "@/lib/rides/claude-tools";
import { findPossibleDuplicates } from "@/lib/funnel/dedup";
import { PARSE_STUDENTS_BATCH_SYSTEM, buildParseStudentsUserMsg } from "@/lib/prompts/parse-students-batch";
import { callClaudeOrThrow } from "./attendance";
import { httpErr } from "@/lib/http";
import type { CommitStudentRosterBatchBody } from "@/lib/contracts/students";

export async function parseStudentsBatch(text: string) {
  const roster = await db
    .select({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      igHandle: students.igHandle,
      phone: students.phone,
      email: students.email,
      createdAt: students.createdAt,
    })
    .from(students);

  const userMsg = buildParseStudentsUserMsg(text);

  const resp = await callClaudeOrThrow(() =>
    anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: PARSE_STUDENTS_BATCH_SYSTEM,
      tools: [PARSE_STUDENTS_BATCH_TOOL],
      tool_choice: { type: "tool", name: PARSE_STUDENTS_BATCH_TOOL.name },
      messages: [{ role: "user", content: userMsg }],
    })
  );

  const toolUse = resp.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw httpErr.upstream("AI mapping failure.");

  const input = toolUse.input as { students?: any[]; explanation?: string };
  const processedItems = [];
  const now = new Date();

  for (const item of input.students ?? []) {
        const candidates = findPossibleDuplicates(
        {
        firstName: item.firstName,
        lastName: item.lastName,
        igHandle: item.igHandle,
        phone: item.phone,
        email: item.email,
        },
        roster,
        now
    );

    const hasMatch = candidates.length > 0;
    const existingRecords = [];

    // Gather ALL matched candidates instead of just grabbing the first one
    if (hasMatch) {
        for (const candidate of candidates) {
        const [matchedRow] = await db
            .select()
            .from(students)
            .where(eq(students.id, candidate.studentId))
            .limit(1);

        if (matchedRow) {
            existingRecords.push(matchedRow);
        }
        }
    }

    processedItems.push({
        incoming: item,
        isDuplicate: hasMatch,
        existingRecords, // Pass the array of matches down to the frontend
    });
  }

  return {
    items: processedItems,
    explanation: input.explanation ?? "Processing completed."
  };
}

export async function commitStudentsBatch(userId: string, body: CommitStudentRosterBatchBody) {
  let created = 0;
  let merged = 0;

  for (const item of body.items) {
    if (item.action === "skip") continue;

    if (item.action === "create") {
      await db.insert(students).values({
        firstName: item.incoming.firstName,
        lastName: item.incoming.lastName ?? null,
        gender: (item.incoming.gender as any) ?? null,
        year: (item.incoming.year as any) ?? null,
        phone: item.incoming.phone ?? null,
        email: item.incoming.email ?? null,
        igHandle: item.incoming.igHandle ?? null,
        notes: item.incoming.notes ?? null,
        addedByUserId: userId,
        funnelStage: "new",
      });
      created++;
    }

    if (item.action === "merge" && item.existingId) {
      const [old] = await db.select().from(students).where(eq(students.id, item.existingId)).limit(1);
      if (old) {
        await db
          .update(students)
          .set({
            lastName: item.incoming.lastName || old.lastName,
            gender: (item.incoming.gender as any) || old.gender,
            year: (item.incoming.year as any) || old.year,
            phone: item.incoming.phone || old.phone,
            email: item.incoming.email || old.email,
            igHandle: item.incoming.igHandle || old.igHandle,
            notes: item.incoming.notes 
              ? `${old.notes ?? ""}\n[AI Merge]: ${item.incoming.notes}`.trim()
              : old.notes,
            updatedAt: new Date(),
          })
          .where(eq(students.id, item.existingId));
        merged++;
      }
    }
  }

  return { success: true, created, merged };
}

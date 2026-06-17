import { withAuth } from "@/lib/http";
import { z } from "zod";
import { db } from "@/lib/db";
import { students } from "../../../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { anthropic, MODEL } from "@/lib/claude";
import { PARSE_STUDENTS_BATCH_TOOL } from "@/lib/rides/claude-tools";
import { findPossibleDuplicates } from "@/lib/funnel/dedup";
import { PARSE_STUDENTS_BATCH_SYSTEM, buildParseStudentsUserMsg } from "@/lib/prompts/parse-students-batch";
import { callClaudeOrThrow } from "@/server/attendance";
import { httpErr } from "@/lib/http";

const parseAttendeesSchema = z.object({
  text: z.string().min(1),
});

export const POST = withAuth(
  async ({ body }) => {
    // 1. Fetch the overall student roster to compute name/handle overlaps
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

    const userMsg = buildParseStudentsUserMsg(body.text);

    // 2. Use Claude to extract unstructured data fields
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
    const processedAttendees = [];
    const now = new Date();

    // 3. Match each candidate against your global database records
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

      if (hasMatch) {
        for (const candidate of candidates) {
          const [matchedRow] = await db
            .select()
            .from(students)
            .where(eq(students.id, candidate.studentId))
            .limit(1);
          if (matchedRow) existingRecords.push(matchedRow);
        }
      }

      processedAttendees.push({
        incoming: item,
        isDuplicate: hasMatch,
        existingRecords,
      });
    }

    return {
      items: processedAttendees,
      explanation: input.explanation ?? "Attendees structured successfully.",
    };
  },
  { bodySchema: parseAttendeesSchema }
);

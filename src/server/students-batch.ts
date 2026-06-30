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

function mergeCourseMaterial(existing: string[] | null | undefined, toAdd?: string[]) {
  if (!toAdd?.length) return existing ?? null;
  return [...new Set([...(existing ?? []), ...toAdd])];
}

function buildCreateValues(userId: string, incoming: CommitStudentRosterBatchBody["items"][number]["incoming"]) {
  return {
    firstName: incoming.firstName,
    lastName: incoming.lastName ?? null,
    gender: incoming.gender ?? null,
    year: incoming.year ?? null,
    phone: incoming.phone ?? null,
    email: incoming.email ?? null,
    igHandle: incoming.igHandle ?? null,
    memberStatus: incoming.memberStatus ?? null,
    isActive: incoming.isActive ?? true,
    newsletter: incoming.newsletter ?? false,
    groupme: incoming.groupme ?? false,
    contactedViaIg: incoming.contactedViaIg ?? false,
    funnelStage: incoming.funnelStage ?? "new",
    primaryContact: incoming.primaryContact ?? null,
    goals: incoming.goals ?? null,
    courseMaterial: mergeCourseMaterial(null, incoming.courseMaterialAdd),
    notes: incoming.notes ?? null,
    addedByUserId: userId,
  } as const;
}

function buildMergePatch(
  old: typeof students.$inferSelect,
  incoming: CommitStudentRosterBatchBody["items"][number]["incoming"]
) {
  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (incoming.lastName) patch.lastName = incoming.lastName;
  if (incoming.gender) patch.gender = incoming.gender;
  if (incoming.year) patch.year = incoming.year;
  if (incoming.phone) patch.phone = incoming.phone;
  if (incoming.email) patch.email = incoming.email;
  if (incoming.igHandle) patch.igHandle = incoming.igHandle;
  if (incoming.memberStatus != null) patch.memberStatus = incoming.memberStatus;
  if (incoming.isActive != null) patch.isActive = incoming.isActive;
  if (incoming.newsletter != null) patch.newsletter = incoming.newsletter;
  if (incoming.groupme != null) patch.groupme = incoming.groupme;
  if (incoming.contactedViaIg != null) patch.contactedViaIg = incoming.contactedViaIg;
  if (incoming.funnelStage != null) patch.funnelStage = incoming.funnelStage;
  if (incoming.primaryContact) patch.primaryContact = incoming.primaryContact;
  if (incoming.goals) patch.goals = incoming.goals;

  if (incoming.courseMaterialAdd?.length) {
    patch.courseMaterial = mergeCourseMaterial(old.courseMaterial ?? null, incoming.courseMaterialAdd);
  }

  if (incoming.notes) {
    patch.notes = `${old.notes ?? ""}\n[AI Merge]: ${incoming.notes}`.trim();
  }

  return patch;
}

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
      await db.insert(students).values(buildCreateValues(userId, item.incoming));
      created++;
    }

    if (item.action === "merge" && item.existingId) {
      const [old] = await db.select().from(students).where(eq(students.id, item.existingId)).limit(1);
      if (old) {
        await db
          .update(students)
          .set(buildMergePatch(old, item.incoming))
          .where(eq(students.id, item.existingId));
        merged++;
      }
    }
  }

  return { success: true, created, merged };
}

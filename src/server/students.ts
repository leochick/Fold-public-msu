import { z } from "zod";
import { db } from "@/lib/db";
import { students } from "../../drizzle/schema";
import { inArray, eq } from "drizzle-orm";
import { anthropic, MODEL, UPDATE_STUDENTS_TOOL } from "@/lib/claude";
import { PARSE_UPDATE_SYSTEM, buildParseUpdateUserMsg } from "@/lib/prompts/parse-update";
import { httpErr } from "@/lib/http";
import { loadRosterWithStatus, formatRosterCompactWithStatus } from "./roster";
import { callClaudeOrThrow } from "./attendance";
import { commitUpdatesBody } from "@/lib/contracts/students";
import { pickStudentFields } from "@/lib/changelog";
import {
  logStudentCreated,
  logStudentDeleted,
  logStudentUpdated,
} from "./changelog";

const ALLOWED_PATCH_FIELDS = new Set([
  "firstName",
  "lastName",
  "gender",
  "year",
  "phone",
  "email",
  "igHandle",
  "memberStatus",
  "contactedViaIg",
  "primaryContact",
  "goals",
  "notes",
]);

export async function parseUpdate(text: string) {
  const roster = await loadRosterWithStatus();
  const rosterCompact = formatRosterCompactWithStatus(roster);
  const userMsg = buildParseUpdateUserMsg(rosterCompact, text);

  const resp = await callClaudeOrThrow(() =>
    anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: PARSE_UPDATE_SYSTEM,
      tools: [UPDATE_STUDENTS_TOOL],
      tool_choice: { type: "tool", name: UPDATE_STUDENTS_TOOL.name },
      messages: [{ role: "user", content: userMsg }],
    })
  );
  const tu = resp.content.find((b) => b.type === "tool_use");
  if (!tu || tu.type !== "tool_use") throw httpErr.upstream("claude returned no tool use");
  const out = tu.input as {
    updates: { studentId: number; patch: Record<string, unknown> }[];
    creates?: Record<string, unknown>[];
    deletes?: { studentId: number; reason?: string }[];
    explanation: string;
    ambiguous?: string[];
  };
  return hydrateUpdatePreview(out);
}

export async function hydrateUpdatePreview(out: {
  updates?: { studentId: number; patch: Record<string, unknown> }[];
  creates?: Record<string, unknown>[];
  deletes?: { studentId: number; reason?: string }[];
  explanation: string;
  ambiguous?: string[];
}) {
  const updateIds = (out.updates ?? []).map((u) => u.studentId).filter((n) => Number.isFinite(n));
  const deleteIds = (out.deletes ?? []).map((d) => d.studentId).filter((n) => Number.isFinite(n));
  const allIds = [...new Set([...updateIds, ...deleteIds])];
  const before = allIds.length
    ? await db.select().from(students).where(inArray(students.id, allIds))
    : [];
  const beforeById = new Map(before.map((s) => [s.id, s]));
  const previews = (out.updates ?? []).map((u) => ({
    studentId: u.studentId,
    before: beforeById.get(u.studentId) ?? null,
    patch: u.patch,
  }));
  const deletes = (out.deletes ?? []).map((d) => ({
    studentId: d.studentId,
    student: beforeById.get(d.studentId) ?? null,
    reason: d.reason ?? "",
  }));
  return {
    explanation: out.explanation,
    ambiguous: out.ambiguous ?? [],
    previews,
    creates: out.creates ?? [],
    deletes,
  };
}

export async function commitUpdates(userId: string, body: z.infer<typeof commitUpdatesBody>) {
  let applied = 0;
  let created = 0;
  let deleted = 0;

  for (const u of body.updates) {
    const [beforeRow] = await db
      .select()
      .from(students)
      .where(eq(students.id, u.studentId))
      .limit(1);
    if (!beforeRow) continue;
    const before = pickStudentFields(beforeRow as Record<string, unknown>);

    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(u.patch)) {
      if (k === "notesAppend") continue;
      if (!ALLOWED_PATCH_FIELDS.has(k)) continue;
      if (v === undefined) continue;
      if (k === "igHandle" && typeof v === "string") {
        patch[k] = v.replace(/^@/, "") || null;
      } else if (typeof v === "string" && v === "") {
        patch[k] = null;
      } else {
        patch[k] = v;
      }
    }
    const append = u.patch.notesAppend ?? u.notesAppend;
    if (append && append.trim()) {
      const [cur] = await db
        .select({ notes: students.notes })
        .from(students)
        .where(eq(students.id, u.studentId))
        .limit(1);
      const stamp = new Date().toISOString().slice(0, 10);
      const line = `[${stamp}] ${append.trim()}`;
      patch.notes = cur?.notes ? `${cur.notes}\n${line}` : line;
    }
    if (Object.keys(patch).length === 0) continue;
    patch.updatedAt = new Date();
    await db
      .update(students)
      .set(patch as never)
      .where(eq(students.id, u.studentId));
    const after = { ...before, ...patch };
    await logStudentUpdated(userId, u.studentId, before, after);
    applied += 1;
  }

  for (const c of body.creates) {
    const vals: Record<string, unknown> = { firstName: c.firstName.trim() };
    for (const k of [
      "lastName",
      "gender",
      "year",
      "phone",
      "email",
      "igHandle",
      "memberStatus",
      "primaryContact",
      "notes",
    ] as const) {
      const v = c[k];
      if (typeof v === "string" && v) {
        vals[k] = k === "igHandle" ? v.replace(/^@/, "") : v;
      }
    }
    vals.addedByUserId = userId;
    const [row] = await db.insert(students).values(vals as never).returning();
    await logStudentCreated(userId, row, "Bulk edit");
    created += 1;
  }

  for (const d of body.deletes) {
    const [student] = await db.select().from(students).where(eq(students.id, d.studentId)).limit(1);
    if (student) await logStudentDeleted(userId, student);
    await db.delete(students).where(eq(students.id, d.studentId));
    deleted += 1;
  }

  return { ok: true, applied, created, deleted };
}

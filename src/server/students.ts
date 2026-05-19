import { z } from "zod";
import { db } from "@/lib/db";
import { students, contactAttempts, attendances, events, users } from "../../drizzle/schema";
import { inArray, eq, desc } from "drizzle-orm";
import { anthropic, MODEL, UPDATE_STUDENTS_TOOL } from "@/lib/claude";
import { DRAFT_OUTREACH_TOOL } from "@/lib/funnel/draft-tools";
import { PARSE_UPDATE_SYSTEM, buildParseUpdateUserMsg } from "@/lib/prompts/parse-update";
import { buildDraftOutreachSystem } from "@/lib/prompts/draft-outreach";
import { httpErr } from "@/lib/http";
import { loadRosterWithStatus, formatRosterCompactWithStatus } from "./roster";
import { callClaudeOrThrow } from "./attendance";
import { commitUpdatesBody, draftOutreachBody, contactLogBody } from "@/lib/contracts/students";
import { funnelStageSchema } from "@/lib/contracts/shared";
import type { Channel, FunnelStage } from "@/lib/funnel/types";

const ALLOWED_PATCH_FIELDS = new Set([
  "firstName",
  "lastName",
  "gender",
  "year",
  "phone",
  "email",
  "igHandle",
  "memberStatus",
  "isActive",
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

export async function commitUpdates(userId: number, body: z.infer<typeof commitUpdatesBody>) {
  let applied = 0;
  let created = 0;
  let deleted = 0;

  for (const u of body.updates) {
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
    await db.insert(students).values(vals as never);
    created += 1;
  }

  for (const d of body.deletes) {
    await db.delete(students).where(eq(students.id, d.studentId));
    deleted += 1;
  }

  return { ok: true, applied, created, deleted };
}

export async function setFunnelStage(studentId: number, body: z.infer<typeof funnelStageSchema>) {
  await db
    .update(students)
    .set({ funnelStage: body, updatedAt: new Date() })
    .where(eq(students.id, studentId));
  return { ok: true };
}

export async function logContact(userId: number, body: z.infer<typeof contactLogBody>) {
  const [s] = await db
    .select()
    .from(students)
    .where(eq(students.id, body.studentId))
    .limit(1);
  if (!s) throw httpErr.notFound("student not found");

  const responded = !!body.responded;
  await db.insert(contactAttempts).values({
    studentId: body.studentId,
    attemptedByUserId: userId,
    channel: body.channel,
    channelDetail: body.channelDetail ?? null,
    responded,
    notes: body.notes ?? null,
  });

  const order: FunnelStage[] = [
    "new",
    "reaching_out",
    "connected",
    "met",
    "active",
    "engaged",
  ];
  const target: FunnelStage = responded ? "connected" : "reaching_out";
  const currentIdx =
    s.funnelStage === "inactive" ? 1 : order.indexOf(s.funnelStage as FunnelStage);
  const targetIdx = order.indexOf(target);
  if (targetIdx > currentIdx || s.funnelStage === "inactive") {
    await db
      .update(students)
      .set({ funnelStage: target, updatedAt: new Date() })
      .where(eq(students.id, body.studentId));
  }
  return { ok: true };
}

export async function draftOutreach(
  organizerName: string,
  studentId: number,
  body: z.infer<typeof draftOutreachBody>
) {
  const purpose = (body.purpose ?? "").trim();
  const refinement = (body.refinement ?? "").trim();
  const channel = body.channel;

  const [s] = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
  if (!s) throw httpErr.notFound("student not found");

  const recentAttempts = await db
    .select({
      channel: contactAttempts.channel,
      channelDetail: contactAttempts.channelDetail,
      attemptedAt: contactAttempts.attemptedAt,
      responded: contactAttempts.responded,
      notes: contactAttempts.notes,
      byName: users.displayName,
    })
    .from(contactAttempts)
    .leftJoin(users, eq(users.id, contactAttempts.attemptedByUserId))
    .where(eq(contactAttempts.studentId, studentId))
    .orderBy(desc(contactAttempts.attemptedAt))
    .limit(8);

  const recentEvents = await db
    .select({ name: events.name, startDate: events.startDate, recordedAt: attendances.recordedAt })
    .from(attendances)
    .innerJoin(events, eq(events.id, attendances.eventId))
    .where(eq(attendances.studentId, studentId))
    .orderBy(desc(attendances.recordedAt))
    .limit(5);

  const profileLines: string[] = [];
  profileLines.push(`Name: ${s.firstName}${s.lastName ? " " + s.lastName : ""}`);
  if (s.gender) profileLines.push(`Gender: ${s.gender === "M" ? "male" : "female"}`);
  if (s.year) profileLines.push(`Year: ${s.year}`);
  if (s.igHandle) profileLines.push(`IG: @${s.igHandle}`);
  if (s.funnelStage) profileLines.push(`Funnel stage: ${s.funnelStage}`);
  if (s.firstMetContext) profileLines.push(`First met: ${s.firstMetContext}`);
  if (s.primaryContact) profileLines.push(`Primary contact (leader): ${s.primaryContact}`);
  if (s.goals) profileLines.push(`Goals: ${s.goals}`);
  if (Array.isArray(s.courseMaterial) && s.courseMaterial.length) {
    profileLines.push(`Course material done: ${s.courseMaterial.join(", ")}`);
  }
  if (s.notes) profileLines.push(`Notes: ${s.notes}`);

  const attemptsLines = recentAttempts.map((a) => {
    const when = new Date(a.attemptedAt).toISOString().slice(0, 10);
    const reply = a.responded ? "responded" : "no reply";
    const detail = a.channelDetail ? ` — ${a.channelDetail}` : "";
    const note = a.notes ? ` — ${a.notes}` : "";
    return `  ${when}  ${a.channel}  by ${a.byName ?? "?"}  (${reply})${detail}${note}`;
  });

  const eventLines = recentEvents.map((e) => {
    const when = new Date(e.startDate).toISOString().slice(0, 10);
    return `  ${when}  ${e.name}`;
  });

  const purposeBlock = purpose
    ? `\nLeader's purpose for this message:\n${purpose}\n`
    : "\nNo specific purpose given — write a general warm follow-up.\n";
  const refinementBlock = refinement
    ? `\nRefinement on a previous draft (apply this):\n${refinement}\n`
    : "";

  const system = buildDraftOutreachSystem(organizerName, channel as Channel);
  const userMsg = `Channel: ${channel}

Student profile:
${profileLines.join("\n")}

Recent contact attempts (most recent first, up to 8):
${attemptsLines.length ? attemptsLines.join("\n") : "  (none yet)"}

Recent event attendance (most recent first, up to 5):
${eventLines.length ? eventLines.join("\n") : "  (none yet)"}
${purposeBlock}${refinementBlock}`;

  const resp = await callClaudeOrThrow(() =>
    anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system,
      tools: [DRAFT_OUTREACH_TOOL],
      tool_choice: { type: "tool", name: DRAFT_OUTREACH_TOOL.name },
      messages: [{ role: "user", content: userMsg }],
    })
  );
  const toolUse = resp.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw httpErr.upstream("claude returned no tool use");
  const input = toolUse.input as {
    drafts?: Array<{ label: string; body: string }>;
    explanation?: string;
  };
  return {
    drafts: input.drafts ?? [],
    explanation: input.explanation ?? "",
    channel,
  };
}

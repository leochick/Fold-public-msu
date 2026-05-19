import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { events, students, attendances } from "../../drizzle/schema";
import { anthropic, MODEL, PARSE_ATTENDANCE_TOOL } from "@/lib/claude";
import { PARSE_ATTENDANCE_SYSTEM, buildParseAttendanceUserMsg } from "@/lib/prompts/parse-attendance";
import { httpErr } from "@/lib/http";
import { loadBasicRoster, formatRosterCompact } from "./roster";
import type { Attendee, ParseAttendanceBody, CommitAttendanceBody } from "@/lib/contracts/attendance";

export type ParsedAttendee = Attendee & { _existingName?: string };

export async function parseAttendance(body: ParseAttendanceBody) {
  const [evt] = await db.select().from(events).where(eq(events.id, body.eventId)).limit(1);
  if (!evt) throw httpErr.notFound("event not found");

  const roster = await loadBasicRoster();
  const rosterCompact = formatRosterCompact(roster);
  const userMsg = buildParseAttendanceUserMsg(rosterCompact, body.text);

  const resp = await callClaudeOrThrow(() =>
    anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: PARSE_ATTENDANCE_SYSTEM,
      tools: [PARSE_ATTENDANCE_TOOL],
      tool_choice: { type: "tool", name: PARSE_ATTENDANCE_TOOL.name },
      messages: [{ role: "user", content: userMsg }],
    })
  );

  const toolUse = resp.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw httpErr.upstream("claude returned no tool use");
  }
  const input = toolUse.input as { attendees?: ParsedAttendee[] };
  const attendees = (input.attendees ?? []).map((a) => {
    if (a.match === "existing" && typeof a.studentId === "number") {
      const r = roster.find((x) => x.id === a.studentId);
      a._existingName = r ? `${r.firstName}${r.lastName ? " " + r.lastName : ""}` : undefined;
    }
    return a;
  });
  return {
    attendees,
    explanation: `Parsed ${attendees.length} attendee${attendees.length === 1 ? "" : "s"}.`,
  };
}

export async function commitAttendance(userId: number, body: CommitAttendanceBody) {
  let created = 0;
  let marked = 0;

  for (const a of body.attendees) {
    let sid: number | undefined;
    if (a.match === "existing" && typeof a.studentId === "number") {
      sid = a.studentId;
    } else if (a.match === "new" && a.firstName) {
      const [row] = await db
        .insert(students)
        .values({
          firstName: a.firstName,
          lastName: a.lastName ?? null,
          gender: a.gender ?? null,
          year: a.year ?? null,
          igHandle: a.igHandle ?? null,
          notes: a.notes ?? null,
        })
        .returning();
      sid = row.id;
      created += 1;
    }
    if (!sid) continue;
    try {
      await db
        .insert(attendances)
        .values({ studentId: sid, eventId: body.eventId, recordedBy: userId })
        .run();
      marked += 1;
    } catch {
      // unique constraint = already marked
    }
  }
  return { ok: true, created, marked };
}

export async function callClaudeOrThrow<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw httpErr.upstream(err instanceof Error ? err.message : "claude failed");
  }
}

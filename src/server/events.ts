import { db } from "@/lib/db";
import { events, students, attendances } from "../../drizzle/schema";
import { anthropic, HAIKU, PROPOSE_EVENT_BATCH_TOOL, PROPOSE_EVENT_BATCH_LIST_TOOL, EVENT_INSIGHTS_TOOL } from "@/lib/claude";
import { buildParseEventBatchSystem, buildParseEventBatchUserMsg } from "@/lib/prompts/parse-event-batch";
import { EVENT_INSIGHTS_SYSTEM } from "@/lib/prompts/event-insights";
import { EVENT_INSIGHTS_SINGLE_SYSTEM } from "@/lib/prompts/event-insights-single";
import { httpErr } from "@/lib/http";
import { loadBasicRoster, formatRosterCompact, fuzzyMatchInviter } from "./roster";
import { callClaudeOrThrow } from "./attendance";
import type { CommitEventBatchBody, ParseEventBatchBody } from "@/lib/contracts/events";

export async function parseEventBatch(body: ParseEventBatchBody) {
  const roster = await loadBasicRoster();
  const rosterCompact = formatRosterCompact(roster);
  const today = new Date().toISOString().slice(0, 10);
  const system = buildParseEventBatchSystem(today);
  const userMsg = buildParseEventBatchUserMsg(rosterCompact, body.text);

  const resp = await callClaudeOrThrow(() =>
    anthropic.messages.create({
      model: HAIKU,
      max_tokens: 2048,
      system,
      tools: [PROPOSE_EVENT_BATCH_TOOL, PROPOSE_EVENT_BATCH_LIST_TOOL],
      tool_choice: { type: "any" },
      messages: [{ role: "user", content: userMsg }],
    })
  );

  const tu = resp.content.find((b) => b.type === "tool_use");
  if (!tu || tu.type !== "tool_use") throw httpErr.upstream("claude returned no tool use");

  if (tu.name === PROPOSE_EVENT_BATCH_LIST_TOOL.name) {
    const out = tu.input as {
      events?: Array<{ name: string; date: string; type?: string; location?: string }>;
    };
    const list = (out.events ?? []).filter((e) => e.name?.trim() && e.date);
    return { mode: "batch" as const, events: list };
  }

  const out = tu.input as {
    event: unknown;
    attendees?: Array<Record<string, unknown>>;
  };
  const attendees = (out.attendees ?? []).map((a) => {
    if (a.match === "existing" && typeof a.studentId === "number") {
      const r = roster.find((x) => x.id === a.studentId);
      (a as Record<string, unknown>)._existingName = r
        ? `${r.firstName}${r.lastName ? " " + r.lastName : ""}`
        : undefined;
    }
    if (typeof a.invitedByName === "string" && a.invitedByName.trim()) {
      const resolved = fuzzyMatchInviter(a.invitedByName, roster);
      if (resolved) {
        a.invitedById = resolved.id;
        a._invitedByDisplayName = resolved.name;
      }
    }
    return a;
  });
  return { mode: "single" as const, event: out.event, attendees };
}

export async function commitEventBatch(userId: number, body: CommitEventBatchBody) {
  if (body.mode === "batch") {
    const created: Array<{ id: number; name: string; date: string }> = [];
    for (const ev of body.events) {
      const [y, m, day] = ev.date.split("-").map(Number);
      const d = new Date(y, m - 1, day);
      if (isNaN(d.getTime())) continue;
      const [row] = await db
        .insert(events)
        .values({
          name: ev.name.trim(),
          type: ev.type?.trim() || null,
          startDate: d,
          location: ev.location?.trim() || null,
        })
        .returning();
      created.push({
        id: row.id,
        name: row.name,
        date: row.startDate.toISOString().slice(0, 10),
      });
    }
    return { ok: true, mode: "batch" as const, created };
  }

  const ev = body.event;
  const [y, m, day] = ev.date.split("-").map(Number);
  const startDate = new Date(y, m - 1, day);
  if (isNaN(startDate.getTime())) throw httpErr.badRequest("invalid date");

  const [evt] = await db
    .insert(events)
    .values({
      name: ev.name.trim(),
      type: ev.type?.trim() || null,
      startDate,
      location: ev.location?.trim() || null,
    })
    .returning();

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
          invitedByStudentId: typeof a.invitedById === "number" ? a.invitedById : null,
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
        .values({ studentId: sid, eventId: evt.id, recordedBy: userId })
        .run();
      marked += 1;
    } catch {
      /* unique */
    }
  }
  return { ok: true, mode: "single" as const, eventId: evt.id, created, marked };
}

export async function aggregatesInsights(aggregates: unknown) {
  const userMsg = JSON.stringify(aggregates, null, 2);
  const resp = await callClaudeOrThrow(() =>
    anthropic.messages.create({
      model: HAIKU,
      max_tokens: 600,
      system: EVENT_INSIGHTS_SYSTEM,
      tools: [EVENT_INSIGHTS_TOOL],
      tool_choice: { type: "tool", name: EVENT_INSIGHTS_TOOL.name },
      messages: [{ role: "user", content: `Aggregates:\n${userMsg}` }],
    })
  );
  const tu = resp.content.find((b) => b.type === "tool_use");
  if (!tu || tu.type !== "tool_use") throw httpErr.upstream("claude returned no tool use");
  const out = tu.input as { insights: { headline: string; evidence: string }[] };
  return { insights: out.insights ?? [] };
}

export async function singleEventInsights(stats: unknown) {
  const userMsg = JSON.stringify(stats, null, 2);
  const resp = await callClaudeOrThrow(() =>
    anthropic.messages.create({
      model: HAIKU,
      max_tokens: 400,
      system: EVENT_INSIGHTS_SINGLE_SYSTEM,
      tools: [EVENT_INSIGHTS_TOOL],
      tool_choice: { type: "tool", name: EVENT_INSIGHTS_TOOL.name },
      messages: [{ role: "user", content: `Single event stats:\n${userMsg}` }],
    })
  );
  const tu = resp.content.find((b) => b.type === "tool_use");
  if (!tu || tu.type !== "tool_use") throw httpErr.upstream("no tool use returned");
  const out = tu.input as { insights: { headline: string; evidence: string }[] };
  return { insights: out.insights ?? [] };
}

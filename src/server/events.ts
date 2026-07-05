import { db } from "@/lib/db";
import { events, students, attendances } from "../../drizzle/schema";
import { anthropic, HAIKU, MODEL, PROPOSE_EVENT_BATCH_TOOL, PROPOSE_EVENT_BATCH_LIST_TOOL, EVENT_INSIGHTS_TOOL } from "@/lib/claude";
import { buildParseEventBatchSystem, buildParseEventBatchUserMsg } from "@/lib/prompts/parse-event-batch";
import { EVENT_INSIGHTS_SYSTEM } from "@/lib/prompts/event-insights";
import { EVENT_INSIGHTS_SINGLE_SYSTEM } from "@/lib/prompts/event-insights-single";
import { httpErr } from "@/lib/http";
import { loadBasicRoster, formatRosterCompact, fuzzyMatchInviter } from "./roster";
import { callClaudeOrThrow } from "./attendance";
import type { BatchEventIncoming, CommitEventBatchBody, ParseEventBatchBody } from "@/lib/contracts/events";
import { eq } from "drizzle-orm";
import { eventDateStr, findPossibleEventMatches } from "@/lib/funnel/event-dedup";
import { pickEventFields } from "@/lib/changelog";
import {
  logEventCreated,
  logEventUpdated,
  logStudentCreated,
} from "./changelog";

function formatEventsCompact(list: typeof events.$inferSelect[]) {
  return list
    .map((e) => {
      const date = eventDateStr(e);
      const type = e.type ?? "";
      const loc = e.location ?? "";
      return `${e.id}|${e.name}|${date}|${type}|${loc}`;
    })
    .join("\n");
}

function parseLocalDate(date: string) {
  const [y, m, day] = date.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  if (isNaN(d.getTime())) throw httpErr.badRequest(`invalid date: ${date}`);
  return d;
}

function buildEventMergePatch(
  old: typeof events.$inferSelect,
  incoming: BatchEventIncoming
) {
  const patch: Record<string, unknown> = {};

  if (incoming.name?.trim() && incoming.name.trim() !== old.name) {
    patch.name = incoming.name.trim();
  }
  if (incoming.type?.trim()) patch.type = incoming.type.trim();
  if (incoming.location?.trim()) patch.location = incoming.location.trim();
  if (incoming.notes?.trim()) {
    patch.notes = old.notes
      ? `${old.notes}\n[AI Merge]: ${incoming.notes.trim()}`
      : incoming.notes.trim();
  }
  if (incoming.totalStudents != null) patch.totalStudents = incoming.totalStudents;

  return patch;
}

function buildEventCreateValues(incoming: BatchEventIncoming) {
  return {
    name: incoming.name.trim(),
    type: incoming.type?.trim() || null,
    startDate: parseLocalDate(incoming.date),
    location: incoming.location?.trim() || null,
    notes: incoming.notes?.trim() || null,
    totalStudents: incoming.totalStudents ?? null,
  };
}

function enrichBatchItem(
  incoming: BatchEventIncoming,
  currentEventsList: typeof events.$inferSelect[],
  intent: "create" | "update"
) {
  const matches = findPossibleEventMatches(incoming, currentEventsList);
  const isDuplicate = matches.length > 0;
  const defaultAction =
    intent === "update"
      ? isDuplicate
        ? "merge"
        : "skip"
      : isDuplicate
        ? "merge"
        : "create";

  return {
    incoming,
    isDuplicate,
    existingRecords: matches,
    chosenAction: defaultAction as "create" | "merge" | "skip",
    selectedExistingId: matches[0]?.id,
  };
}

export async function parseEventBatch(body: ParseEventBatchBody) {
  const roster = await loadBasicRoster();
  const rosterCompact = formatRosterCompact(roster);
  const currentEventsList = await db.select().from(events);
  const eventsCompact = formatEventsCompact(currentEventsList);
  const today = new Date().toISOString().slice(0, 10);
  const system = buildParseEventBatchSystem(today);
  const userMsg = buildParseEventBatchUserMsg(rosterCompact, eventsCompact, body.text);

  const resp = await callClaudeOrThrow(() =>
    anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system,
      tools: [PROPOSE_EVENT_BATCH_TOOL, PROPOSE_EVENT_BATCH_LIST_TOOL],
      tool_choice: { type: "any" },
      messages: [{ role: "user", content: userMsg }],
    })
  );

  const tu = resp.content.find((b) => b.type === "tool_use");
  if (!tu || tu.type !== "tool_use") throw httpErr.upstream("Extraction error.");

  if (tu.name === PROPOSE_EVENT_BATCH_LIST_TOOL.name) {
    const out = tu.input as {
      events?: BatchEventIncoming[];
      intent?: "create" | "update";
      explanation?: string;
    };
    const intent = out.intent ?? "create";
    const list = (out.events ?? []).filter((e) => e.name?.trim() && e.date);
    const items = list.map((ev) => enrichBatchItem(ev, currentEventsList, intent));

    return {
      mode: "batch" as const,
      intent,
      items,
      explanation: out.explanation ?? "Processing completed.",
    };
  }

  const out = tu.input as {
    event: BatchEventIncoming & { isNew?: boolean };
    attendees?: Array<Record<string, unknown>>;
  };

  const eventItem = enrichBatchItem(
    {
      name: out.event.name,
      date: out.event.date,
      type: out.event.type,
      location: out.event.location,
    },
    currentEventsList,
    out.event.isNew ? "create" : "create"
  );
  if (out.event.isNew) {
    eventItem.chosenAction = "create";
  }

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

  return {
    mode: "single" as const,
    event: eventItem,
    attendees,
  };
}

export async function commitEventBatch(userId: string, body: CommitEventBatchBody) {
  if (body.mode === "batch") {
    const created: typeof events.$inferSelect[] = [];
    let merged = 0;

    for (const item of body.items) {
      if (item.action === "skip") continue;

      if (item.action === "create") {
        const [row] = await db.insert(events).values(buildEventCreateValues(item.incoming)).returning();
        await logEventCreated(userId, row);
        created.push(row);
      } else if (item.action === "merge" && item.existingId) {
        const [old] = await db.select().from(events).where(eq(events.id, item.existingId)).limit(1);
        if (old) {
          const before = pickEventFields(old as Record<string, unknown>);
          const patch = buildEventMergePatch(old, item.incoming);
          if (Object.keys(patch).length > 0) {
            await db.update(events).set(patch).where(eq(events.id, item.existingId));
            await logEventUpdated(userId, item.existingId, before, { ...before, ...patch });
          }
          merged++;
        }
      }
    }

    return { ok: true, mode: "batch" as const, created, merged };
  }

  const eventAction = body.eventAction ?? "create";
  if (eventAction === "skip") {
    return { ok: true, mode: "single" as const, eventId: null, created: 0, marked: 0, skipped: true };
  }

  let evt: typeof events.$inferSelect;

  if (eventAction === "merge" && body.existingEventId) {
    const [old] = await db.select().from(events).where(eq(events.id, body.existingEventId)).limit(1);
    if (!old) throw httpErr.badRequest("existing event not found");
    const before = pickEventFields(old as Record<string, unknown>);
    const patch = buildEventMergePatch(old, body.event);
    if (Object.keys(patch).length > 0) {
      await db.update(events).set(patch).where(eq(events.id, body.existingEventId));
      await logEventUpdated(userId, body.existingEventId, before, { ...before, ...patch });
    }
    [evt] = await db.select().from(events).where(eq(events.id, body.existingEventId)).limit(1);
  } else {
    [evt] = await db
      .insert(events)
      .values(buildEventCreateValues(body.event))
      .returning();
    await logEventCreated(userId, evt);
  }

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
      await logStudentCreated(userId, row, `Added during event ${evt.name}`);
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

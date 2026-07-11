import type { z } from "zod";

import type * as attendance from "./contracts/attendance";
import type * as events from "./contracts/events";
import type * as students from "./contracts/students";
import type * as intake from "./contracts/intake";
import type * as svAttendance from "@/server/attendance";
import type * as svEvents from "@/server/events";
import type * as svStudents from "@/server/students";
import type * as svIntake from "@/server/intake";
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function post<R>(path: string, body: unknown): Promise<R> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    if (!res.ok) throw new ApiError(res.status, res.statusText);
    return undefined as R;
  }
  if (!res.ok) {
    const err = (json as { error?: string })?.error ?? res.statusText;
    throw new ApiError(res.status, err);
  }
  return json as R;
}

type In<S extends z.ZodTypeAny> = z.input<S>;

export const api = {
  attendance: {
    parse: (b: In<typeof attendance.parseAttendanceBody>) =>
      post<Awaited<ReturnType<typeof svAttendance.parseAttendance>>>("/api/parse-attendance", b),
    commit: (b: In<typeof attendance.commitAttendanceBody>) =>
      post<Awaited<ReturnType<typeof svAttendance.commitAttendance>>>("/api/commit-attendance", b),
  },
  events: {
    parseBatch: (b: In<typeof events.parseEventBatchBody>) =>
      post<Awaited<ReturnType<typeof svEvents.parseEventBatch>>>("/api/parse-event-batch", b),
    commitBatch: (b: In<typeof events.commitEventBatchBody>) =>
      post<Awaited<ReturnType<typeof svEvents.commitEventBatch>>>("/api/commit-event-batch", b),
    insights: (b: In<typeof events.eventInsightsBody>) =>
      post<Awaited<ReturnType<typeof svEvents.aggregatesInsights>>>("/api/event-insights", b),
    insightsSingle: (b: In<typeof events.eventInsightsSingleBody>) =>
      post<Awaited<ReturnType<typeof svEvents.singleEventInsights>>>(
        "/api/event-insights/single",
        b
      ),
  },
  students: {
    parseUpdate: (b: In<typeof students.parseUpdateBody>) =>
      post<Awaited<ReturnType<typeof svStudents.parseUpdate>>>("/api/parse-update", b),
    commitUpdates: (b: In<typeof students.commitUpdatesBody>) =>
      post<Awaited<ReturnType<typeof svStudents.commitUpdates>>>("/api/commit-updates", b),
    draftOutreach: (id: number, b: In<typeof students.draftOutreachBody>) =>
      post<Awaited<ReturnType<typeof svStudents.draftOutreach>>>(
        `/api/students/${id}/draft-outreach`,
        b
      ),
    logContact: (b: In<typeof students.contactLogBody>) =>
      post<Awaited<ReturnType<typeof svStudents.logContact>>>("/api/contacts/log", b),
    parseBatch: (b: { text: string }) =>
      post<any>("/api/students/parse-batch", b),
    commitBatch: (b: { items: any[] }) =>
      post<any>("/api/students/commit-batch", b),
  },
  intake: {
    parse: (b: In<typeof intake.intakeParseBody>) =>
      post<Awaited<ReturnType<typeof svIntake.parseIntake>>>("/api/intake/parse", b),
    commit: (b: In<typeof intake.intakeCommitBody>) =>
      post<Awaited<ReturnType<typeof svIntake.commitIntake>>>("/api/intake/commit", b),
  },
};

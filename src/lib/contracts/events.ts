import { z } from "zod";
import { attendeeSchema } from "./attendance";
import { nonEmptyText } from "./shared";

export const parseEventBatchBody = z.object({ text: nonEmptyText });
export type ParseEventBatchBody = z.infer<typeof parseEventBatchBody>;

export const eventInputSchema = z.object({
  name: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  type: z.string().optional(),
  location: z.string().optional(),
});

export const commitEventBatchBody = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("single"),
    event: eventInputSchema.extend({ isNew: z.boolean().optional() }),
    attendees: z.array(attendeeSchema).default([]),
  }),
  z.object({
    mode: z.literal("batch"),
    events: z.array(eventInputSchema).min(1),
  }),
]);
export type CommitEventBatchBody = z.infer<typeof commitEventBatchBody>;

export const eventInsightsBody = z.object({
  aggregates: z.object({ totalEvents: z.number() }).passthrough(),
});

export const eventInsightsSingleBody = z.object({
  eventId: z.number().int().positive(),
  stats: z
    .object({
      total: z.number(),
      firstTimers: z.number(),
      returners: z.number(),
      genderSplit: z.object({ M: z.number(), F: z.number(), unknown: z.number() }),
      inviteChains: z.array(z.object({ inviter: z.string(), invitees: z.array(z.string()) })),
    })
    .passthrough(),
});

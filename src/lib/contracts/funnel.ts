import { z } from "zod";

export const funnelSweepBody = z
  .object({
    thresholdDays: z.number().int().positive().max(365).optional(),
  })
  .default({});

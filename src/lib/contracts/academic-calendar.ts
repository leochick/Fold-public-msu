import { z } from "zod";

export const footballScheduleBody = z.object({
  academicYearId: z.number().int().positive(),
});

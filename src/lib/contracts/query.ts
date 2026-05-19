import { z } from "zod";
import { nonEmptyText } from "./shared";

export const nlQueryBody = z.object({ query: nonEmptyText });
export type NlQueryBody = z.infer<typeof nlQueryBody>;

export const askBody = z.object({ text: nonEmptyText });
export type AskBody = z.infer<typeof askBody>;

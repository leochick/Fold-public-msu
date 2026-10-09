import type Anthropic from "@anthropic-ai/sdk";
import type { FootballScheduleContext } from "@/lib/football-schedule";

export const FOOTBALL_SCHEDULE_TOOL: Anthropic.Tool = {
  name: "record_football_schedule",
  description:
    "Record the fall varsity football schedule found on the web for the university identified from the campus context.",
  input_schema: {
    type: "object",
    properties: {
      school: {
        type: "string",
        description:
          "Full university name whose schedule was used. Empty string if the context does not identify a school.",
      },
      games: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description:
                'Game label as "{campus short name} vs. {opponent}", using the short name supported by the context.',
            },
            date: {
              type: "string",
              description: "Game date as YYYY-MM-DD.",
            },
            startTime: {
              type: "string",
              description:
                "Kickoff in the school's local time as HH:MM (24-hour). Use an empty string when the time is TBA or unannounced.",
            },
            venue: {
              type: "string",
              enum: ["home", "away"],
              description: "Home or away from the identified school's perspective.",
            },
          },
          required: ["name", "date", "startTime", "venue"],
        },
      },
    },
    required: ["school", "games"],
  },
};

export const FOOTBALL_SCHEDULE_SYSTEM = `You fill a campus ministry academic calendar with that campus's fall varsity football schedule.

Decide which university's football team the calendar is for using only the supplied context (event locations, event names, and role notes). Do not assume a school when the clues are ambiguous or missing. Different universities share initials, so prefer a specific place name (a union, stadium, or campus building) over initials alone.

Search the web for that school's published fall football schedule. Use the fall season year given in the request (the first year of an academic year like 2025-26). Include regular-season games and any postseason games already on the published schedule. Skip spring games and other seasons.

Then call record_football_schedule:
- school: the university's full name, or "" if you cannot tell which school it is
- games: chronological. name is "{short name from context} vs. {opponent}". date is YYYY-MM-DD. startTime is local kickoff as HH:MM, or "" if TBA. venue is "home" or "away" from that school's perspective. If a game is at a neutral site, use "home" only when that school is designated the home team; otherwise use "away".
- If you cannot identify the school, call the tool with school "" and games [].
- Do not invent games that were not on a page you found.`;

export function buildFootballScheduleUserPrompt(input: {
  academicYearName: string;
  fallSeasonYear: number | null;
  context: FootballScheduleContext;
}): string {
  const season =
    input.fallSeasonYear != null
      ? String(input.fallSeasonYear)
      : "the fall of this academic year";
  return [
    `Academic year: ${input.academicYearName}`,
    `Fall football season year to look up: ${season}`,
    "",
    "Campus context (use this to decide which school's football schedule to retrieve):",
    JSON.stringify(input.context, null, 2),
    "",
    "Search the web, then call record_football_schedule.",
  ].join("\n");
}

import { desc, isNotNull, ne, and } from "drizzle-orm";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODEL } from "@/lib/claude";
import { httpErr } from "@/lib/http";
import {
  fallFootballSeasonYear,
  filterGamesToFallSeason,
  normalizeFootballGames,
  type FootballScheduleContext,
} from "@/lib/football-schedule";
import {
  buildFootballScheduleUserPrompt,
  FOOTBALL_SCHEDULE_SYSTEM,
  FOOTBALL_SCHEDULE_TOOL,
} from "@/lib/prompts/football-schedule";
import { events, roleBoards, type RoleBoardRow } from "../../drizzle/schema";
import { db } from "@/lib/db";
import { callClaudeOrThrow } from "./attendance";
import { getAcademicYearById } from "./academic-calendar";

const WEB_SEARCH: Anthropic.WebSearchTool20250305 = {
  type: "web_search_20250305",
  name: "web_search",
  max_uses: 5,
};

function clip(value: string, max = 180): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max);
}

function roleNoteLines(rows: RoleBoardRow[]): string[] {
  const lines: string[] = [];
  for (const row of rows) {
    if (row.kind === "subheader") {
      if (row.name.trim()) lines.push(clip(row.name));
      continue;
    }
    if (row.name.trim()) lines.push(clip(row.name));
    for (const item of row.responsibilities ?? []) {
      if (typeof item === "string" && item.trim()) lines.push(clip(item));
    }
  }
  return lines;
}

export async function gatherFootballScheduleContext(): Promise<FootballScheduleContext> {
  const [locationRows, recentRows, boards] = await Promise.all([
    db
      .selectDistinct({ location: events.location })
      .from(events)
      .where(and(isNotNull(events.location), ne(events.location, "")))
      .limit(40),
    db
      .select({ name: events.name, location: events.location })
      .from(events)
      .orderBy(desc(events.startDate))
      .limit(25),
    db.select({ rows: roleBoards.rows }).from(roleBoards).limit(4),
  ]);

  const roleNotes: string[] = [];
  for (const board of boards) {
    for (const line of roleNoteLines(board.rows ?? [])) {
      roleNotes.push(line);
      if (roleNotes.length >= 40) break;
    }
    if (roleNotes.length >= 40) break;
  }

  return {
    eventLocations: locationRows
      .map((row) => row.location?.trim() ?? "")
      .filter((location) => location.length > 0),
    recentEvents: recentRows.map((row) => ({
      name: row.name.trim(),
      location: row.location?.trim() ?? "",
    })),
    roleNotes,
  };
}

function searchedTheWeb(content: Anthropic.ContentBlock[]): boolean {
  return content.some(
    (block) =>
      (block.type === "server_tool_use" && block.name === "web_search") ||
      block.type === "web_search_tool_result"
  );
}

export async function populateFootballSchedule(academicYearId: number) {
  if (!Number.isFinite(academicYearId)) throw httpErr.badRequest("Invalid academic year");
  const year = await getAcademicYearById(academicYearId);
  if (!year) throw httpErr.notFound("Academic year not found");

  const context = await gatherFootballScheduleContext();
  const seasonYear = fallFootballSeasonYear(year.name);
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: buildFootballScheduleUserPrompt({
        academicYearName: year.name,
        fallSeasonYear: seasonYear,
        context,
      }),
    },
  ];

  let searched = false;
  for (let turn = 0; turn < 5; turn++) {
    const response = await callClaudeOrThrow(() =>
      anthropic.messages.create({
        model: MODEL,
        max_tokens: 8000,
        system: FOOTBALL_SCHEDULE_SYSTEM,
        tools: [WEB_SEARCH, FOOTBALL_SCHEDULE_TOOL],
        messages,
      })
    );

    if (searchedTheWeb(response.content)) searched = true;

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock =>
        block.type === "tool_use" && block.name === FOOTBALL_SCHEDULE_TOOL.name
    );

    if (toolUse && !searched) {
      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: toolUse.id,
            is_error: true,
            content:
              "Search the web for the published schedule before recording games. Then call record_football_schedule again using only games from those results.",
          },
        ],
      });
      continue;
    }

    if (toolUse) {
      const input = toolUse.input as { school?: unknown; games?: unknown };
      const school = typeof input.school === "string" ? input.school.trim() : "";
      const games = filterGamesToFallSeason(normalizeFootballGames(input.games), seasonYear);
      if (!school) {
        throw httpErr.badRequest(
          "Could not tell which school's football schedule to use. Add campus locations to events, then try again."
        );
      }
      if (games.length === 0) {
        throw httpErr.upstream(`No fall football games were found for ${school}.`);
      }
      return { school, games };
    }

    messages.push({ role: "assistant", content: response.content });
    if (response.stop_reason === "pause_turn") continue;

    if (turn < 4) {
      messages.push({
        role: "user",
        content:
          "Search the web for the fall football schedule, then call record_football_schedule. Do not answer in prose.",
      });
      continue;
    }
    break;
  }

  throw httpErr.upstream("Could not load a football schedule from the web.");
}

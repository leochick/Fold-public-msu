import { anthropic, MODEL, NL_QUERY_TOOL, UPDATE_STUDENTS_TOOL } from "@/lib/claude";
import { NL_QUERY_SYSTEM } from "@/lib/prompts/nl-query";
import { ASK_SYSTEM, buildAskUserMsg } from "@/lib/prompts/ask";
import { runFilter, type FilterSpec } from "@/lib/filter-to-sql";
import { httpErr } from "@/lib/http";
import { loadRosterWithStatus, formatRosterCompactWithStatus } from "./roster";
import { hydrateUpdatePreview } from "./students";
import { callClaudeOrThrow } from "./attendance";

export async function nlQuery(query: string) {
  const resp = await callClaudeOrThrow(() =>
    anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: NL_QUERY_SYSTEM,
      tools: [NL_QUERY_TOOL],
      tool_choice: { type: "tool", name: NL_QUERY_TOOL.name },
      messages: [{ role: "user", content: query }],
    })
  );
  const tu = resp.content.find((b) => b.type === "tool_use");
  if (!tu || tu.type !== "tool_use") throw httpErr.upstream("no tool use");
  const input = tu.input as { filters: FilterSpec; explanation?: string };
  const rows = await runFilter(input.filters ?? {});
  return {
    rows,
    explanation: input.explanation ?? "",
    filters: input.filters ?? {},
  };
}

export async function ask(text: string) {
  const roster = await loadRosterWithStatus();
  const rosterCompact = formatRosterCompactWithStatus(roster);
  const userMsg = buildAskUserMsg(rosterCompact, text);

  const resp = await callClaudeOrThrow(() =>
    anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: ASK_SYSTEM,
      tools: [NL_QUERY_TOOL, UPDATE_STUDENTS_TOOL],
      tool_choice: { type: "any" },
      messages: [{ role: "user", content: userMsg }],
    })
  );
  const tu = resp.content.find((b) => b.type === "tool_use");
  if (!tu || tu.type !== "tool_use") throw httpErr.upstream("claude returned no tool use");

  if (tu.name === NL_QUERY_TOOL.name) {
    const input = tu.input as { filters: FilterSpec; explanation?: string };
    const rows = await runFilter(input.filters ?? {});
    return {
      mode: "query" as const,
      rows,
      explanation: input.explanation ?? "",
      filters: input.filters ?? {},
    };
  }

  const out = tu.input as {
    updates: { studentId: number; patch: Record<string, unknown> }[];
    creates?: Record<string, unknown>[];
    deletes?: { studentId: number; reason?: string }[];
    explanation: string;
    ambiguous?: string[];
  };
  const hydrated = await hydrateUpdatePreview(out);
  return { mode: "update" as const, ...hydrated };
}

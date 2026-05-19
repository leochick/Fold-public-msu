export const maxDuration = 60;

import { withAuth, httpErr } from "@/lib/http";
import { mockInsights } from "@/lib/demo-data";
import { eventInsightsBody } from "@/lib/contracts/events";
import { anthropic, EVENT_INSIGHTS_TOOL } from "@/lib/claude";
import { EVENT_INSIGHTS_SYSTEM } from "@/lib/prompts/event-insights";
import { anthropicSseStream, sseResponse } from "@/server/streaming";

const HAIKU = "claude-haiku-4-5-20251001";

export const POST = withAuth(
  async ({ body }) => {
    if (body.aggregates.totalEvents < 3) {
      throw httpErr.badRequest("not enough events for insights");
    }
    const userMsg = JSON.stringify(body.aggregates, null, 2);
    const stream = anthropicSseStream(anthropic, {
      model: HAIKU,
      max_tokens: 600,
      system: EVENT_INSIGHTS_SYSTEM,
      tools: [EVENT_INSIGHTS_TOOL],
      tool_choice: { type: "tool", name: EVENT_INSIGHTS_TOOL.name },
      messages: [{ role: "user", content: `Aggregates:\n${userMsg}` }],
    });
    return sseResponse(stream);
  },
  {
    bodySchema: eventInsightsBody,
    demoMock: () => ({ insights: mockInsights() }),
  }
);

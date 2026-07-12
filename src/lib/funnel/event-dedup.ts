import type { Event } from "../../../drizzle/schema";
import { levenshtein } from "./dedup";

function normalizeEventName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[:|/]+/g, " ")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ");
}

export function nameSimilarity(a: string, b: string): number {
  const na = normalizeEventName(a);
  const nb = normalizeEventName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 100;

  if (na.includes(nb) || nb.includes(na)) {
    const shorter = Math.min(na.length, nb.length);
    const longer = Math.max(na.length, nb.length);
    const ratio = shorter / longer;
    // Weak containment (e.g. "large group" inside a long specific title) should not dominate.
    if (ratio < 0.45) return Math.round(55 + ratio * 40);
    return Math.round(80 + ratio * 20);
  }

  const maxLen = Math.max(na.length, nb.length);
  const dist = levenshtein(na, nb);
  return Math.max(0, 100 - (dist / maxLen) * 100);
}

export function eventDateStr(e: { startDate: Date | string | number }): string {
  return new Date(e.startDate).toISOString().slice(0, 10);
}

function scoreEventMatch(
  incoming: { name: string; type?: string | null },
  e: Event
): number {
  let score = nameSimilarity(incoming.name, e.name);
  if (incoming.type && e.type && normalizeEventName(incoming.type) === normalizeEventName(e.type)) {
    score += 15;
  }
  if (e.type && nameSimilarity(incoming.name, e.type) >= 80) {
    score += 20;
  }
  return score;
}

/**
 * Find existing events that could match an incoming batch item.
 * When `date` is provided, only events on that date are considered (legacy Quick Add behavior).
 * When `date` is omitted, match by name across all events (notes-table / title-only updates).
 */
export function findPossibleEventMatches(
  incoming: { name: string; date?: string; type?: string | null },
  existingEvents: Event[],
  minScore = 40
): Event[] {
  const pool = incoming.date
    ? existingEvents.filter((e) => eventDateStr(e) === incoming.date)
    : existingEvents;

  if (pool.length === 0) return [];

  // Name-only matching needs a higher bar — date-scoped searches can be fuzzier.
  const threshold = incoming.date ? minScore : Math.max(minScore, 75);

  const scored = pool
    .map((e) => ({ event: e, score: scoreEventMatch(incoming, e) }))
    .filter((x) => x.score >= threshold)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(a.event.startDate).getTime() - new Date(b.event.startDate).getTime();
    });

  if (scored.length > 0) {
    return scored.map((x) => x.event);
  }

  // Date-scoped fallback: sole event on that day is a match even with a weak name.
  if (incoming.date && pool.length === 1) {
    return [pool[0]];
  }

  return [];
}

/**
 * Enrich a list of incoming events with match candidates.
 * When matching by name only, assign distinct existing events in paste order
 * (chronological among equal-score matches) so repeated titles like "D-Group"
 * map to different dates instead of all selecting the same row.
 */
export function assignEventMatches<T extends { name: string; date?: string; type?: string | null }>(
  incomingList: T[],
  existingEvents: Event[],
  intent: "create" | "update",
  minScore = 40
): Array<{
  incoming: T & { date?: string };
  isDuplicate: boolean;
  existingRecords: Event[];
  chosenAction: "create" | "merge" | "skip";
  selectedExistingId?: number;
}> {
  const usedIds = new Set<number>();

  return incomingList.map((incoming) => {
    const matches = findPossibleEventMatches(incoming, existingEvents, minScore);
    const unused = matches.filter((m) => !usedIds.has(m.id));
    const ordered =
      unused.length > 0 ? [...unused, ...matches.filter((m) => usedIds.has(m.id))] : matches;

    const isDuplicate = ordered.length > 0;
    const selected = ordered[0];
    if (selected && intent === "update") {
      usedIds.add(selected.id);
    }

    const defaultAction =
      intent === "update"
        ? isDuplicate
          ? "merge"
          : "skip"
        : isDuplicate
          ? "merge"
          : "create";

    const withDate =
      !incoming.date && selected
        ? { ...incoming, date: eventDateStr(selected) }
        : incoming;

    return {
      incoming: withDate,
      isDuplicate,
      existingRecords: ordered,
      chosenAction: defaultAction as "create" | "merge" | "skip",
      selectedExistingId: selected?.id,
    };
  });
}

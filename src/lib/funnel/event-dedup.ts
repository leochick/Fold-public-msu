import type { Event } from "../../../drizzle/schema";
import { levenshtein } from "./dedup";

function normalizeEventName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

function nameSimilarity(a: string, b: string): number {
  const na = normalizeEventName(a);
  const nb = normalizeEventName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 100;
  if (na.includes(nb) || nb.includes(na)) return 80;
  const maxLen = Math.max(na.length, nb.length);
  const dist = levenshtein(na, nb);
  return Math.max(0, 100 - (dist / maxLen) * 100);
}

export function eventDateStr(e: { startDate: Date | string | number }): string {
  return new Date(e.startDate).toISOString().slice(0, 10);
}

export function findPossibleEventMatches(
  incoming: { name: string; date: string; type?: string | null },
  existingEvents: Event[],
  minScore = 40
): Event[] {
  const onDate = existingEvents.filter((e) => eventDateStr(e) === incoming.date);
  if (onDate.length === 0) return [];

  const scored = onDate
    .map((e) => {
      let score = nameSimilarity(incoming.name, e.name);
      if (incoming.type && e.type && normalizeEventName(incoming.type) === normalizeEventName(e.type)) {
        score += 15;
      }
      if (e.type && nameSimilarity(incoming.name, e.type) >= 80) {
        score += 20;
      }
      return { event: e, score };
    })
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score);

  if (scored.length > 0) {
    return scored.map((x) => x.event);
  }

  if (onDate.length === 1) {
    return [onDate[0]];
  }

  return onDate;
}

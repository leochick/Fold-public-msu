import type { AcademicFootballGame, AcademicFootballVenue } from "../../drizzle/schema";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

export type FootballScheduleContext = {
  eventLocations: string[];
  recentEvents: Array<{ name: string; location: string }>;
  roleNotes: string[];
};

export function fallFootballSeasonYear(academicYearName: string): number | null {
  const match = /^(20\d{2})-\d{2}$/.exec(academicYearName.trim());
  if (!match) return null;
  return Number(match[1]);
}

/** Parse a kickoff into HH:MM. Returns null for TBA or unreadable values. */
export function parseKickoffTime(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const direct = HH_MM.exec(trimmed);
  if (direct) return `${direct[1]}:${direct[2]}`;
  if (/\bnoon\b/i.test(trimmed)) return "12:00";

  const match = /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/i.exec(trimmed);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  if (hour > 12 || minute > 59) return null;
  const meridiem = match[3].toLowerCase().replace(/\./g, "");
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function asVenue(value: unknown): AcademicFootballVenue | null {
  if (typeof value !== "string") return null;
  const venue = value.trim().toLowerCase();
  if (venue === "home" || venue === "away") return venue;
  return null;
}

export function normalizeFootballGames(value: unknown): AcademicFootballGame[] {
  if (!Array.isArray(value)) return [];
  const games: AcademicFootballGame[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!name) continue;
    const dateText = typeof item.date === "string" ? item.date.trim() : "";
    const timeText = typeof item.startTime === "string" ? item.startTime : "";
    games.push({
      name,
      date: ISO_DATE.test(dateText) ? dateText : null,
      startTime: parseKickoffTime(timeText),
      venue: asVenue(item.venue),
    });
  }

  const seen = new Set<string>();
  const unique = games.filter((game) => {
    const key = `${game.date ?? ""}|${game.name.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.sort((a, b) => {
    if (a.date && b.date && a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    return a.name.localeCompare(b.name);
  });
}

/** Keep games that fall in the fall football season (August through January). */
export function filterGamesToFallSeason(
  games: AcademicFootballGame[],
  seasonYear: number | null
): AcademicFootballGame[] {
  if (seasonYear == null) return games;
  const start = `${seasonYear}-08-01`;
  const end = `${seasonYear + 1}-02-01`;
  return games.filter((game) => !game.date || (game.date >= start && game.date < end));
}

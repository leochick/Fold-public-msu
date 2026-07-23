export type EventNotesRow = {
  name: string;
  notes: string;
};

export type EventCreateRow = {
  name: string;
  date: string;
  location?: string;
  notes?: string;
  totalStudents?: number;
};

type ColumnKey = "date" | "event" | "location" | "attendance" | "notes";

const HEADER_ALIASES: Record<ColumnKey, string[]> = {
  date: ["date", "day", "when"],
  event: ["event", "name", "title", "event name"],
  location: ["location", "loc", "place", "venue"],
  attendance: ["attendance", "attend", "attendees", "total", "students", "count", "#", "total students"],
  notes: ["notes", "note", "comments", "comment"],
};

/**
 * Detects pasted Event/Notes spreadsheet text (tab-separated, often from Google Sheets).
 * Accepts an optional preamble before an "Event" / "Notes" header row.
 */
export function looksLikeEventNotesTable(text: string): boolean {
  return findNotesHeaderIndex(text.split(/\r?\n/)) >= 0;
}

/** Detects Date + Event spreadsheet pastes for bulk event creation. */
export function looksLikeEventCreateTable(text: string): boolean {
  return findCreateHeader(text.split(/\r?\n/)) != null;
}

function normalizeHeaderCell(value: string): string {
  return value.trim().toLowerCase().replace(/['"]/g, "").replace(/\s+/g, " ");
}

function isHeaderCell(value: string, expected: string): boolean {
  return normalizeHeaderCell(value) === expected;
}

function resolveColumnKey(value: string): ColumnKey | null {
  const norm = normalizeHeaderCell(value);
  if (!norm) return null;
  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as [ColumnKey, string[]][]) {
    if (aliases.includes(norm)) return key;
  }
  return null;
}

function findNotesHeaderIndex(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const cols = splitTsvLine(lines[i]);
    if (cols.length >= 2 && isHeaderCell(cols[0], "event") && isHeaderCell(cols[1], "notes")) {
      return i;
    }
  }
  return -1;
}

function findCreateHeader(
  lines: string[]
): { index: number; columns: Partial<Record<ColumnKey, number>> } | null {
  for (let i = 0; i < lines.length; i++) {
    const cols = splitTsvLine(lines[i]);
    if (cols.length < 2) continue;

    const columns: Partial<Record<ColumnKey, number>> = {};
    for (let c = 0; c < cols.length; c++) {
      const key = resolveColumnKey(cols[c]);
      if (key && columns[key] == null) columns[key] = c;
    }

    // Create tables need Date + Event. Prefer this over Event/Notes-only updates.
    if (columns.date != null && columns.event != null) {
      return { index: i, columns };
    }
  }
  return null;
}

/** Split one TSV line, respecting double-quoted fields. Tabs only (notes often contain commas). */
export function splitTsvLine(line: string): string[] {
  const cols: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "\t" && !inQuotes) {
      cols.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  cols.push(cur);
  return cols;
}

/**
 * Parse a full Event/Notes paste, including quoted multiline cells.
 * Returns rows with non-empty event titles; empty notes are kept so callers can skip.
 */
export function parseEventNotesTable(text: string): EventNotesRow[] | null {
  const raw = text.replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/);
  const headerIdx = findNotesHeaderIndex(lines);
  if (headerIdx < 0) return null;

  const body = lines.slice(headerIdx + 1).join("\n");
  const rows: EventNotesRow[] = [];
  let i = 0;

  while (i < body.length) {
    if (body[i] === "\n") {
      i++;
      continue;
    }

    const { fields, nextIndex } = readRecord(body, i);
    i = nextIndex;
    if (fields.length === 0) continue;

    const name = (fields[0] ?? "").trim();
    const notes = (fields[1] ?? "").trim();
    if (!name) continue;
    rows.push({ name, notes });
  }

  return rows.length > 0 ? rows : null;
}

/**
 * Parse Date/Event/Location/Attendance/Notes spreadsheet pastes into create-ready rows.
 * Quoted multiline notes are preserved. Date ranges use the start date.
 */
export function parseEventCreateTable(
  text: string,
  opts?: { today?: Date }
): EventCreateRow[] | null {
  const raw = text.replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/);
  const header = findCreateHeader(lines);
  if (!header) return null;

  const today = opts?.today ?? new Date();
  const body = lines.slice(header.index + 1).join("\n");
  const rows: EventCreateRow[] = [];
  let i = 0;

  while (i < body.length) {
    if (body[i] === "\n") {
      i++;
      continue;
    }

    const { fields, nextIndex } = readRecord(body, i);
    i = nextIndex;
    if (fields.length === 0) continue;

    const name = cellAt(fields, header.columns.event).trim();
    const dateRaw = cellAt(fields, header.columns.date).trim();
    if (!name || !dateRaw) continue;

    const date = parseSpreadsheetDate(dateRaw, today);
    if (!date) continue;

    const location = cellAt(fields, header.columns.location).trim() || undefined;
    const notes = cellAt(fields, header.columns.notes).trim() || undefined;
    const totalStudents = parseAttendance(cellAt(fields, header.columns.attendance));

    const row: EventCreateRow = { name, date };
    if (location) row.location = location;
    if (notes) row.notes = notes;
    if (totalStudents != null) row.totalStudents = totalStudents;
    rows.push(row);
  }

  return rows.length > 0 ? rows : null;
}

function cellAt(fields: string[], index: number | undefined): string {
  if (index == null) return "";
  return fields[index] ?? "";
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * Parse spreadsheet dates like "Friday, 8/22", "10/11", or "Friday, 9/26 - Sunday, 9/28".
 * Uses the start of a range. When a weekday is present, prefer the year whose calendar matches.
 */
export function parseSpreadsheetDate(raw: string, today: Date = new Date()): string | null {
  const start = raw.split(/\s*[-–—]\s*(?=[A-Za-z]|\d)/)[0]?.trim() ?? raw.trim();
  const m = start.match(
    /^(?:(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s*,?\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*$/i
  );
  if (!m) return null;

  const weekdayName = m[1]?.toLowerCase();
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  let year: number;
  if (m[4]) {
    year = Number(m[4]);
    if (year < 100) year += 2000;
  } else {
    year = pickYearForMonthDay(month, day, weekdayName, today);
  }

  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function pickYearForMonthDay(
  month: number,
  day: number,
  weekdayName: string | undefined,
  today: Date
): number {
  const currentYear = today.getFullYear();
  const candidates = [currentYear, currentYear - 1, currentYear + 1];
  const wantDow = weekdayName ? WEEKDAYS[weekdayName] : undefined;

  if (wantDow != null) {
    for (const y of candidates) {
      const d = new Date(y, month - 1, day);
      if (d.getMonth() === month - 1 && d.getDate() === day && d.getDay() === wantDow) {
        return y;
      }
    }
  }

  return currentYear;
}

/** Parse attendance cells like "52", "37 + 2", "25 (21+4)", "18 --> 9?". */
export function parseAttendance(raw: string): number | undefined {
  const text = raw.trim();
  if (!text) return undefined;

  const sum = text.match(/^(\d+)\s*\+\s*(\d+)\s*$/);
  if (sum) return Number(sum[1]) + Number(sum[2]);

  const first = text.match(/(\d+)/);
  if (!first) return undefined;
  return Number(first[1]);
}

/** Read one TSV record starting at `start` (tabs only; notes often contain commas). */
export function readRecord(text: string, start: number): { fields: string[]; nextIndex: number } {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  let i = start;

  while (i < text.length) {
    const ch = text[i];

    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
      continue;
    }

    if (!inQuotes && ch === "\t") {
      fields.push(cur);
      cur = "";
      i++;
      continue;
    }

    if (!inQuotes && ch === "\n") {
      fields.push(cur);
      return { fields, nextIndex: i + 1 };
    }

    cur += ch;
    i++;
  }

  if (cur.length > 0 || fields.length > 0) {
    fields.push(cur);
  }
  return { fields, nextIndex: i };
}

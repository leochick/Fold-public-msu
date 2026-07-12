export type EventNotesRow = {
  name: string;
  notes: string;
};

/**
 * Detects pasted Event/Notes spreadsheet text (tab-separated, often from Google Sheets).
 * Accepts an optional preamble before an "Event" / "Notes" header row.
 */
export function looksLikeEventNotesTable(text: string): boolean {
  return findEventNotesHeaderIndex(text.split(/\r?\n/)) >= 0;
}

function isHeaderCell(value: string, expected: string): boolean {
  return value.trim().toLowerCase().replace(/['"]/g, "") === expected;
}

function findEventNotesHeaderIndex(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const cols = splitTsvLine(lines[i]);
    if (cols.length >= 2 && isHeaderCell(cols[0], "event") && isHeaderCell(cols[1], "notes")) {
      return i;
    }
  }
  return -1;
}

/** Split one TSV line, respecting double-quoted fields. Tabs only (notes often contain commas). */
function splitTsvLine(line: string): string[] {
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
  const headerIdx = findEventNotesHeaderIndex(lines);
  if (headerIdx < 0) return null;

  const body = lines.slice(headerIdx + 1).join("\n");
  const rows: EventNotesRow[] = [];
  let i = 0;

  while (i < body.length) {
    // Skip blank lines between records
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

/** Read one TSV record starting at `start` (tabs only; notes often contain commas). */
function readRecord(text: string, start: number): { fields: string[]; nextIndex: number } {
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

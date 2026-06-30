import type { BatchRosterIncoming } from "@/lib/contracts/students";
import { normalizeEmail, type RosterRow } from "@/lib/funnel/dedup";

type ParsedName = {
  firstName: string;
  lastName?: string;
  rawText: string;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractEmail(text: string): string | undefined {
  const match = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  return match?.[0];
}

export function extractPhone(text: string): string | undefined {
  const withoutEmail = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, " ");
  const match = withoutEmail.match(/(?:\+?1[-.\s()]*)?(?:\(?\d{3}\)?[-.\s]*)?\d{3}[-.\s]?\d{4}\b/);
  return match?.[0]?.trim();
}

function hasContactInfo(text: string): boolean {
  return !!(extractEmail(text) || extractPhone(text));
}

export function countEmailLines(text: string): number {
  return text.split(/\n+/).filter((line) => extractEmail(line.trim())).length;
}

export function shouldParseEmailRosterLocally(text: string): boolean {
  return countEmailLines(text) >= 2;
}

function findRosterByEmail(email: string, roster: RosterRow[]): RosterRow | undefined {
  const normalized = normalizeEmail(email);
  return roster.find((student) => student.email && normalizeEmail(student.email) === normalized);
}

function deriveFirstNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const token = local.replace(/[^a-zA-Z]+/g, " ").trim().split(/\s+/)[0];
  if (!token) return local || "Student";
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

function parseEmailRosterLine(
  line: string,
  email: string,
  roster: RosterRow[]
): BatchRosterIncoming | null {
  const emailIndex = line.toLowerCase().indexOf(email.toLowerCase());
  let namePart = "";
  if (emailIndex === 0) {
    namePart = line.slice(email.length).trim();
  } else if (emailIndex > 0) {
    namePart = line.slice(0, emailIndex).trim();
  }
  namePart = namePart.replace(/^[\t:,\-–—]+|[\t:,\-–—]+$/g, "").trim();

  const rosterMatch = findRosterByEmail(email, roster);
  const parsedName = namePart ? parseNameToken(namePart) : null;
  const nameLooksUsable = !!parsedName && parsedName.firstName.length > 1;

  let firstName = "";
  let lastName: string | null = null;

  if (nameLooksUsable && parsedName) {
    firstName = parsedName.firstName;
    lastName = parsedName.lastName ?? null;
  } else if (rosterMatch) {
    firstName = rosterMatch.firstName;
    lastName = rosterMatch.lastName ?? null;
  } else if (parsedName) {
    firstName = parsedName.firstName;
    lastName = parsedName.lastName ?? null;
  } else {
    firstName = deriveFirstNameFromEmail(email);
  }

  return {
    firstName,
    lastName,
    email,
    rawText: line.trim(),
  };
}

export function extractEmailRosterEntriesFromText(
  text: string,
  roster: RosterRow[] = []
): BatchRosterIncoming[] {
  const entries: BatchRosterIncoming[] = [];
  const seenEmails = new Set<string>();

  for (const line of text.split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const email = extractEmail(trimmed);
    if (!email) continue;

    const normalized = normalizeEmail(email);
    if (seenEmails.has(normalized)) continue;
    seenEmails.add(normalized);

    const entry = parseEmailRosterLine(trimmed, email, roster);
    if (entry) entries.push(entry);
  }

  return entries;
}

function findLineContainingName(text: string, student: BatchRosterIncoming): string | undefined {
  const fullName = student.lastName
    ? `${student.firstName} ${student.lastName}`
    : student.firstName;
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .find((line) => new RegExp(`\\b${escapeRegex(fullName)}\\b`, "i").test(line));
}

function resolveNameFromFragment(fragment: string, roster: RosterRow[]): ParsedName | null {
  const trimmed = fragment.trim();
  if (!trimmed) return null;

  const rosterMatches = extractNamesFromBulkText(trimmed, roster);
  if (rosterMatches.length === 1) return rosterMatches[0];

  const parsed = parseNameToken(trimmed);
  if (!parsed) return null;

  const rosterByFirst = roster.filter(
    (student) => student.firstName.toLowerCase() === parsed.firstName.toLowerCase()
  );
  if (rosterByFirst.length === 1) {
    const match = rosterByFirst[0];
    return {
      firstName: match.firstName,
      lastName: match.lastName ?? undefined,
      rawText: trimmed,
    };
  }

  return parsed;
}

function stripContactInfo(text: string): string {
  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, " ")
    .replace(/(?:\+?1[-.\s()]*)?(?:\(?\d{3}\)?[-.\s]*)?\d{3}[-.\s]?\d{4}\b/g, " ")
    .replace(
      /\b(?:phone|email|cell|mobile|number)\s*(?:is|:)?\s*/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function extractContactEntriesFromText(
  text: string,
  roster: RosterRow[] = []
): BatchRosterIncoming[] {
  const entries: BatchRosterIncoming[] = [];
  const seen = new Set<string>();

  for (const line of text.split(/\n+/).map((part) => part.trim()).filter(Boolean)) {
    const email = extractEmail(line);
    const phone = extractPhone(line);
    if (!email && !phone) continue;

    let nameFragment = line;
    const separatorMatch = line.match(/^(.+?)\s*[-:–—]\s*(.+)$/);
    if (separatorMatch) {
      nameFragment = separatorMatch[1];
    } else {
      nameFragment = stripContactInfo(line);
    }

    const resolved = resolveNameFromFragment(nameFragment, roster);
    if (!resolved) continue;

    const key = `${resolved.firstName.toLowerCase()}|${(resolved.lastName ?? "").toLowerCase()}|${email ?? ""}|${phone ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    entries.push({
      firstName: resolved.firstName,
      lastName: resolved.lastName ?? null,
      email: email ?? null,
      phone: phone ?? null,
      rawText: line,
    });
  }

  return entries;
}

function enrichContactInfo(
  student: BatchRosterIncoming,
  fullText: string
): BatchRosterIncoming {
  const sources = [student.rawText, findLineContainingName(fullText, student)].filter(
    (value): value is string => !!value?.trim()
  );

  let email = student.email ?? null;
  let phone = student.phone ?? null;
  for (const source of sources) {
    email = email ?? extractEmail(source) ?? null;
    phone = phone ?? extractPhone(source) ?? null;
  }

  return {
    ...student,
    email,
    phone,
  };
}

export function detectBulkFlags(text: string): Partial<BatchRosterIncoming> {
  const flags: Partial<BatchRosterIncoming> = {};

  if (/(?:unsubscribed from|not on|removed from|off)\s+(?:the\s+)?newsletter/i.test(text)) {
    flags.newsletter = false;
  } else if (/\bnewsletter\b/i.test(text)) {
    flags.newsletter = true;
  }

  if (/(?:not in|removed from|off)\s+groupme/i.test(text)) {
    flags.groupme = false;
  } else if (/\bgroupme\b/i.test(text)) {
    flags.groupme = true;
  }

  if (/(?:mark inactive|stopped coming|make inactive)/i.test(text)) {
    flags.isActive = false;
  } else if (/(?:mark active|make active)/i.test(text)) {
    flags.isActive = true;
  }

  if (/(?:in the ig group|added to ig|ig group chat)/i.test(text)) {
    flags.contactedViaIg = true;
  }

  return flags;
}

function parseNameToken(token: string): ParsedName | null {
  const cleaned = token.trim().replace(/^[-–—]\s*/, "");
  if (!cleaned) return null;
  const parts = cleaned.split(/\s+/);
  const firstName = parts[0]?.trim();
  if (!firstName) return null;
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : undefined;
  return { firstName, lastName, rawText: cleaned };
}

export function extractNamesFromBulkText(text: string, roster: RosterRow[] = []): ParsedName[] {
  const forMatch = text.match(/\bfor[:\s]+(.+)$/is);
  if (forMatch) {
    const names = forMatch[1]
      .split(/\s*,\s*|\s+and\s+|\s*&\s*/i)
      .map(parseNameToken)
      .filter((n): n is ParsedName => n != null);
    if (names.length > 0) return names;
  }

  const matched: ParsedName[] = [];
  const seen = new Set<string>();
  for (const student of roster) {
    const full = student.lastName
      ? `${student.firstName} ${student.lastName}`
      : student.firstName;
    const pattern = student.lastName
      ? new RegExp(`\\b${escapeRegex(full)}\\b`, "i")
      : new RegExp(`\\b${escapeRegex(student.firstName)}\\b`, "i");
    if (!pattern.test(text)) continue;
    const key = full.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    matched.push({
      firstName: student.firstName,
      lastName: student.lastName ?? undefined,
      rawText: full,
    });
  }
  return matched;
}

function asStudentRecord(value: unknown): BatchRosterIncoming | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const firstName = typeof row.firstName === "string" ? row.firstName.trim() : "";
  if (!firstName) return null;

  const rawText =
    typeof row.rawText === "string" && row.rawText.trim()
      ? row.rawText.trim()
      : `${firstName}${typeof row.lastName === "string" && row.lastName ? ` ${row.lastName}` : ""}`.trim();

  return { ...(row as BatchRosterIncoming), firstName, rawText };
}

function applyMissingBulkFlags(
  student: BatchRosterIncoming,
  bulkFlags: Partial<BatchRosterIncoming>
): BatchRosterIncoming {
  const next = { ...student };
  for (const [key, value] of Object.entries(bulkFlags) as [keyof BatchRosterIncoming, unknown][]) {
    if (value == null) continue;
    if (next[key] == null) {
      (next as Record<string, unknown>)[key as string] = value;
    }
  }
  return next;
}

export function normalizeBatchStudentsInput(
  text: string,
  aiStudents: unknown[] | undefined,
  roster: RosterRow[] = []
): BatchRosterIncoming[] {
  const bulkFlags = detectBulkFlags(text);
  const emailRoster = extractEmailRosterEntriesFromText(text, roster);

  if (shouldParseEmailRosterLocally(text)) {
    return emailRoster.map((entry) => applyMissingBulkFlags(entry, bulkFlags));
  }

  let students = (aiStudents ?? [])
    .map(asStudentRecord)
    .filter((s): s is BatchRosterIncoming => s != null)
    .map((s) => applyMissingBulkFlags(s, bulkFlags))
    .map((s) => enrichContactInfo(s, text));

  if (students.length === 0 && Object.keys(bulkFlags).length > 0) {
    const names = extractNamesFromBulkText(text, roster);
    students = names.map((name) =>
      enrichContactInfo(
        {
          firstName: name.firstName,
          lastName: name.lastName ?? null,
          rawText: name.rawText,
          ...bulkFlags,
        },
        text
      )
    );
  }

  if (students.length === 0 && hasContactInfo(text)) {
    students = extractContactEntriesFromText(text, roster);
  }

  if (students.length === 0 && emailRoster.length > 0) {
    students = emailRoster;
  }

  return students.map((entry) => applyMissingBulkFlags(entry, bulkFlags));
}

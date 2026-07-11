import type { BatchRosterIncoming } from "@/lib/contracts/students";
import { levenshtein, normalizeEmail, type RosterRow } from "@/lib/funnel/dedup";

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

function isBulkInstructionLine(line: string): boolean {
  const lower = line.toLowerCase();
  if (
    /^(mark|add|set|subscribe|update)\b/i.test(line) &&
    /\b(groupme|newsletter|course|active|inactive|subscribed)\b/i.test(lower)
  ) {
    return true;
  }
  return /following students/i.test(lower);
}

export function extractNameListBodyLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !isBulkInstructionLine(line))
    .filter((line) => !extractEmail(line) && !extractPhone(line));
}

function matchesInitials(line: string, student: RosterRow): boolean {
  const token = line.trim().toLowerCase();
  if (token.length < 2 || token.length > 4 || /\s/.test(token)) return false;
  const firstInitial = student.firstName?.[0]?.toLowerCase() ?? "";
  const lastInitial = student.lastName?.[0]?.toLowerCase() ?? "";
  const initials = `${firstInitial}${lastInitial}`;
  return token === initials;
}

function resolveNameFromLine(line: string, roster: RosterRow[]): ParsedName | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const normLine = trimmed.toLowerCase();

  for (const student of roster) {
    const full = `${student.firstName}${student.lastName ? ` ${student.lastName}` : ""}`.trim();
    if (full.toLowerCase() === normLine) {
      return { firstName: student.firstName, lastName: student.lastName ?? undefined, rawText: trimmed };
    }
  }

  const parsed = parseNameToken(trimmed);
  if (!parsed) return null;

  if (parsed.lastName) {
    const exact = roster.filter(
      (student) =>
        student.firstName.toLowerCase() === parsed.firstName.toLowerCase() &&
        (student.lastName ?? "").toLowerCase() === parsed.lastName!.toLowerCase()
    );
    if (exact.length === 1) {
      return {
        firstName: exact[0].firstName,
        lastName: exact[0].lastName ?? undefined,
        rawText: trimmed,
      };
    }
  }

  const byFirst = roster.filter(
    (student) => student.firstName.toLowerCase() === parsed.firstName.toLowerCase()
  );
  if (byFirst.length === 1) {
    return {
      firstName: byFirst[0].firstName,
      lastName: byFirst[0].lastName ?? undefined,
      rawText: trimmed,
    };
  }

  const byInitials = roster.filter((student) => matchesInitials(trimmed, student));
  if (byInitials.length === 1) {
    return {
      firstName: byInitials[0].firstName,
      lastName: byInitials[0].lastName ?? undefined,
      rawText: trimmed,
    };
  }

  let best: { student: RosterRow; score: number } | null = null;
  for (const student of roster) {
    const full = `${student.firstName}${student.lastName ? ` ${student.lastName}` : ""}`.trim().toLowerCase();
    const fullDist = levenshtein(normLine, full);
    const firstDist = levenshtein(parsed.firstName.toLowerCase(), student.firstName.toLowerCase());
    const lastDist =
      parsed.lastName && student.lastName
        ? levenshtein(parsed.lastName.toLowerCase(), student.lastName.toLowerCase())
        : null;

    let score = Number.POSITIVE_INFINITY;
    if (parsed.lastName && student.lastName && fullDist <= 4) score = fullDist;
    else if (parsed.lastName && student.lastName && firstDist <= 2 && lastDist !== null && lastDist <= 2) {
      score = firstDist + lastDist;
    } else if (!parsed.lastName && firstDist <= 2) score = firstDist;

    if (score < Number.POSITIVE_INFINITY && (!best || score < best.score)) {
      best = { student, score };
    }
  }

  if (best && best.score <= 4) {
    return {
      firstName: best.student.firstName,
      lastName: best.student.lastName ?? undefined,
      rawText: trimmed,
    };
  }

  return parsed;
}

export function extractNameListEntriesFromText(
  text: string,
  roster: RosterRow[] = []
): BatchRosterIncoming[] {
  const entries: BatchRosterIncoming[] = [];
  const seen = new Set<string>();

  for (const line of extractNameListBodyLines(text)) {
    const resolved = resolveNameFromLine(line, roster);
    if (!resolved) continue;

    const key = `${resolved.firstName.toLowerCase()}|${(resolved.lastName ?? "").toLowerCase()}|${line.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    entries.push({
      firstName: resolved.firstName,
      lastName: resolved.lastName ?? null,
      rawText: resolved.rawText,
    });
  }

  return entries;
}

export function shouldParseBulkListLocally(text: string): boolean {
  if (shouldParseEmailRosterLocally(text)) return true;
  if (Object.keys(detectBulkFlags(text)).length === 0) return false;
  return extractNameListBodyLines(text).length >= 2;
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
  const bodyLines = extractNameListBodyLines(text);
  if (bodyLines.length >= 2) {
    const fromLines = extractNameListEntriesFromText(text, roster);
    if (fromLines.length > 0) {
      return fromLines.map((entry) => ({
        firstName: entry.firstName,
        lastName: entry.lastName ?? undefined,
        rawText: entry.rawText ?? entry.firstName,
      }));
    }
  }

  const forMatch = text.match(/\bfor[:\s]+(.+)$/is);
  if (forMatch) {
    const payload = forMatch[1].trim();
    const parts = payload.includes("\n")
      ? payload.split(/\n+/).map((part) => part.trim()).filter(Boolean)
      : payload.split(/\s*,\s*|\s+and\s+|\s*&\s*/i);
    const names = parts.map(parseNameToken).filter((n): n is ParsedName => n != null);
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

  const nameListEntries = extractNameListEntriesFromText(text, roster);
  if (Object.keys(bulkFlags).length > 0 && nameListEntries.length >= 2) {
    return nameListEntries.map((entry) => applyMissingBulkFlags(entry, bulkFlags));
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

  if (students.length === 0 && nameListEntries.length > 0) {
    students = nameListEntries;
  }

  return students.map((entry) => applyMissingBulkFlags(entry, bulkFlags));
}

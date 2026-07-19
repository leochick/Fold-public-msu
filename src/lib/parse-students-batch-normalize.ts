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
    /\b(groupme|newsletter|course|active|inactive|subscribed|salvation)\b/i.test(lower)
  ) {
    return true;
  }
  if (/\bsalvation\s+decision\b/i.test(lower)) return true;
  return /following (?:students|people)/i.test(lower);
}

/** Parse M/D/YY, M/D/YYYY, or already-ISO dates into YYYY-MM-DD. */
export function parseFlexibleIsoDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(trimmed);
  if (!slash) return null;

  const month = Number(slash[1]);
  const day = Number(slash[2]);
  let year = Number(slash[3]);
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const check = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  if (
    Number.isNaN(check.getTime()) ||
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return iso;
}

export function parseSalvationDecisionType(raw: string): "salvation" | "lordship" | null {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "salvation") return "salvation";
  if (normalized === "lordship") return "lordship";
  return null;
}

function splitSalvationDecisionColumns(line: string): string[] | null {
  const tabParts = line.split("\t").map((part) => part.trim()).filter(Boolean);
  if (tabParts.length >= 3) return tabParts;

  // Fallback: name … date … type … notes (date + Salvation/Lordship anchors)
  const match = line.match(
    /^(.+?)\s+(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})\s+(Salvation|Lordship)\s*(.*)$/i
  );
  if (!match) return null;
  const notes = match[4]?.trim();
  return notes
    ? [match[1].trim(), match[2].trim(), match[3].trim(), notes]
    : [match[1].trim(), match[2].trim(), match[3].trim()];
}

function parseSalvationDecisionLine(
  line: string,
  roster: RosterRow[]
): BatchRosterIncoming | null {
  const cols = splitSalvationDecisionColumns(line);
  if (!cols || cols.length < 3) return null;

  const namePart = cols[0];
  const datePart = cols[1];
  const typePart = cols[2];
  const notesPart = cols.slice(3).join(" ").trim();

  const date = parseFlexibleIsoDate(datePart);
  const decisionType = parseSalvationDecisionType(typePart);
  if (!date || !decisionType) return null;

  const resolved = resolveNameFromLine(namePart, roster);
  if (!resolved) return null;

  return {
    firstName: resolved.firstName,
    lastName: resolved.lastName ?? null,
    salvationDecisionAt: date,
    salvationDecisionType: decisionType,
    salvationDecisionNotes: notesPart || null,
    rawText: line.trim(),
  };
}

export function extractSalvationDecisionEntriesFromText(
  text: string,
  roster: RosterRow[] = []
): BatchRosterIncoming[] {
  const entries: BatchRosterIncoming[] = [];
  const seen = new Set<string>();

  for (const line of text.split(/\n+/).map((part) => part.trim()).filter(Boolean)) {
    if (isBulkInstructionLine(line)) continue;
    const entry = parseSalvationDecisionLine(line, roster);
    if (!entry) continue;

    const key = `${entry.firstName.toLowerCase()}|${(entry.lastName ?? "").toLowerCase()}|${entry.salvationDecisionAt}|${entry.rawText}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(entry);
  }

  return entries;
}

export function countSalvationDecisionLines(text: string): number {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !isBulkInstructionLine(line))
    .filter((line) => {
      const cols = splitSalvationDecisionColumns(line);
      if (!cols || cols.length < 3) return false;
      return !!(parseFlexibleIsoDate(cols[1]) && parseSalvationDecisionType(cols[2]));
    }).length;
}

export function shouldParseSalvationDecisionLocally(text: string): boolean {
  return countSalvationDecisionLines(text) >= 2;
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
  if (shouldParseSalvationDecisionLocally(text)) return true;
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

function coerceSalvationFields(row: Record<string, unknown>): Partial<BatchRosterIncoming> {
  const patch: Partial<BatchRosterIncoming> = {};

  if (typeof row.salvationDecisionAt === "string") {
    const iso = parseFlexibleIsoDate(row.salvationDecisionAt);
    if (iso) patch.salvationDecisionAt = iso;
  }

  if (typeof row.salvationDecisionType === "string") {
    const decisionType = parseSalvationDecisionType(row.salvationDecisionType);
    if (decisionType) patch.salvationDecisionType = decisionType;
  }

  if (typeof row.salvationDecisionNotes === "string") {
    const notes = row.salvationDecisionNotes.trim();
    patch.salvationDecisionNotes = notes || null;
  }

  return patch;
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

  return {
    ...(row as BatchRosterIncoming),
    firstName,
    rawText,
    ...coerceSalvationFields(row),
  };
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
  const salvationRoster = extractSalvationDecisionEntriesFromText(text, roster);

  if (shouldParseEmailRosterLocally(text)) {
    return emailRoster.map((entry) => applyMissingBulkFlags(entry, bulkFlags));
  }

  if (shouldParseSalvationDecisionLocally(text)) {
    return salvationRoster.map((entry) => applyMissingBulkFlags(entry, bulkFlags));
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

  if (students.length === 0 && salvationRoster.length > 0) {
    students = salvationRoster;
  }

  if (students.length === 0 && nameListEntries.length > 0) {
    students = nameListEntries;
  }

  return students.map((entry) => applyMissingBulkFlags(entry, bulkFlags));
}

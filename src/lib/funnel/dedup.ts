// Define and export missing types for typecheck safety across modules
export type RosterRow = {
  id: number;
  firstName: string;
  lastName?: string | null;
  igHandle?: string | null;
  phone?: string | null;
  email?: string | null;
  createdAt?: Date | string | null;
};

export interface DedupCandidate {
  studentId: number;
  confidence: "high" | "medium" | "low";
  score: number;
  reasons: string[];
}

// 1. Restore exported helper utilities used by the test suite
export function phoneLast7(phone: string | null | undefined): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.length >= 7 ? cleaned.slice(-7) : "";
}

export function normalizeEmail(email: string | null | undefined): string {
  if (!email) return "";
  let trimmed = email.toLowerCase().trim();
  const [localPart, domain] = trimmed.split("@");
  if (!localPart || !domain) return trimmed;

  let local = localPart.split("+")[0]; // remove alias flags
  if (domain === "gmail.com" || domain === "googlemail.com") {
    local = local.replace(/\./g, ""); // strip periods for Gmail
  }
  return `${local}@${domain}`;
}

export function normalizeIg(ig: string | null | undefined): string {
  if (!ig) return "";
  return ig.toLowerCase().trim().replace("@", "");
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let i = 1; i <= b.length; i++) {
    let prev = i;
    for (let j = 1; j <= a.length; j++) {
      const val = b[i - 1] === a[j - 1] ? row[j - 1] : Math.min(row[j - 1] + 1, row[j] + 1, prev + 1);
      row[j - 1] = prev;
      prev = val;
    }
    row[a.length] = prev;
  }
  return row[a.length];
}

// 2. Updated multi-match duplicate discovery algorithm
export function findPossibleDuplicates(
  incoming: {
    firstName: string;
    lastName?: string | null;
    igHandle?: string | null;
    phone?: string | null;
    email?: string | null;
  },
  roster: RosterRow[],
  now: Date
): DedupCandidate[] {
  const matches: DedupCandidate[] = [];
  
  const normInFirst = incoming.firstName.toLowerCase().trim();
  const normInLast = incoming.lastName?.toLowerCase().trim() || "";

  for (const student of roster) {
    let score = 0;
    const reasons: string[] = [];

    const normRowFirst = student.firstName.toLowerCase().trim();
    const normRowLast = student.lastName?.toLowerCase().trim() || "";

    // Exact phone match verification
    if (incoming.phone && student.phone) {
      const inClean = phoneLast7(incoming.phone);
      const rowClean = phoneLast7(student.phone);
      if (inClean && rowClean && inClean === rowClean) {
        score += 100;
        reasons.push("phone_last7");
      }
    }

    // Exact Instagram tag overlap verification
    if (incoming.igHandle && student.igHandle) {
      if (normalizeIg(incoming.igHandle) === normalizeIg(student.igHandle)) {
        score += 90;
        reasons.push("ig_exact");
      }
    }

    // Normalized email verification
    if (incoming.email && student.email) {
      if (normalizeEmail(incoming.email) === normalizeEmail(student.email)) {
        score += 95;
        reasons.push("email_normalized");
      }
    }

    // Smart first name fallback rules
    if (normInFirst && normInFirst === normRowFirst) {
      if (!normInLast) {
        // Match solely on first name if incoming entry lacks a last name
        score += 50;
        reasons.push("name_fuzzy");
      } else if (normInLast === normRowLast) {
        score += 80;
        reasons.push("name_fuzzy");
      }
    }

    // Recent profile lookback weight modifier
    if (student.createdAt && reasons.length > 0) {
      const createdTime = new Date(student.createdAt).getTime();
      const diffMs = now.getTime() - createdTime;
      const hoursLimit = 24 * 60 * 60 * 1000;
      if (diffMs >= 0 && diffMs <= hoursLimit) {
        score += 15;
        reasons.push("recent_add");
      }
    }

    if (reasons.length > 0) {
      let confidence: "high" | "medium" | "low" = "low";
      if (score >= 80) confidence = "high";
      else if (score >= 40) confidence = "medium";

      matches.push({
        studentId: student.id,
        confidence,
        score,
        reasons
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

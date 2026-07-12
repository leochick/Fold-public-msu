/** Short local date like `7/12/26` for appended note/goal lines. */
export function formatMergeStamp(date: Date = new Date()): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = String(date.getFullYear()).slice(-2);
  return `${month}/${day}/${year}`;
}

/**
 * Appends incoming text to an existing notes/goals field with a date stamp,
 * e.g. existing `"Friends with Ariana"` + `"Goes by Sierra"` →
 * `"Friends with Ariana\n7/12/26 - Goes by Sierra"`.
 */
export function appendStampedLine(
  existing: string | null | undefined,
  incoming: string | null | undefined,
  date: Date = new Date()
): string | null {
  const addition = (incoming ?? "").trim();
  if (!addition) {
    const kept = (existing ?? "").trim();
    return kept || null;
  }

  const line = `${formatMergeStamp(date)} - ${addition}`;
  const kept = (existing ?? "").trim();
  if (!kept) return line;
  if (kept === addition || kept.endsWith(line)) return kept;
  return `${kept}\n${line}`;
}

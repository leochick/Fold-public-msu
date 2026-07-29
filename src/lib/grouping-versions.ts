/** Prefer the starred default version; otherwise the earliest saved version. */
export function pickInitialGroupingVersion<T extends { isDefault: boolean }>(
  versions: T[]
): T | null {
  return versions.find((version) => version.isDefault) ?? versions[0] ?? null;
}

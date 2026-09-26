export function createContainerKey() {
  return `container-${Math.random().toString(36).slice(2, 10)}`;
}

export function remapIndexAfterReorder(
  index: number,
  fromIndex: number,
  toIndex: number
): number {
  if (index === fromIndex) return toIndex;
  if (fromIndex < toIndex && index > fromIndex && index <= toIndex) return index - 1;
  if (fromIndex > toIndex && index >= toIndex && index < fromIndex) return index + 1;
  return index;
}

export function reorderList<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= list.length ||
    toIndex >= list.length
  ) {
    return list;
  }
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

/** Convert a gap index (0..length) into the destination index after removal. */
export function dropInsertToIndex(fromIndex: number, dropInsertIndex: number): number {
  return dropInsertIndex > fromIndex ? dropInsertIndex - 1 : dropInsertIndex;
}

export function shouldShowContainerInsertGap(
  fromIndex: number | null,
  dropInsertIndex: number | null
): boolean {
  return (
    fromIndex != null &&
    dropInsertIndex != null &&
    dropInsertIndex !== fromIndex &&
    dropInsertIndex !== fromIndex + 1
  );
}

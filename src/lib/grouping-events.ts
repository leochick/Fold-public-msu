export function formatGroupingEventSelection(
  checkedEventIds: number[] | null,
  eventNameById: Map<number, string>
): string {
  if (checkedEventIds === null) return "All events";
  if (checkedEventIds.length === 0) return "No events";
  if (checkedEventIds.length === 1) {
    return eventNameById.get(checkedEventIds[0]) ?? "Various events";
  }
  return "Various events";
}

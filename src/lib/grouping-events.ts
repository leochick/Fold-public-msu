import { isTablingEventType } from "@/lib/dashboard-engagement";

export type GroupingEventLike = {
  id: number;
  type: string | null;
};

export function formatGroupingEventSelection(
  checkedEventIds: number[] | null,
  eventNameById: Map<number, string>
): string {
  if (checkedEventIds === null) return "All non-tabling events";
  if (checkedEventIds.length === 0) return "No events";
  if (checkedEventIds.length === 1) {
    return eventNameById.get(checkedEventIds[0]) ?? "Various events";
  }
  return "Various events";
}

export function partitionEventsByTabling<T extends GroupingEventLike>(events: T[]) {
  const nonTabling: T[] = [];
  const tabling: T[] = [];
  for (const event of events) {
    if (isTablingEventType(event.type)) tabling.push(event);
    else nonTabling.push(event);
  }
  return { nonTabling, tabling };
}

/** Event IDs treated as checked for matching and display. */
export function resolveCheckedEventIdSet(
  checkedEventIds: number[] | null,
  events: GroupingEventLike[]
): Set<number> {
  if (checkedEventIds === null) {
    return new Set(partitionEventsByTabling(events).nonTabling.map((event) => event.id));
  }
  return new Set(checkedEventIds);
}

export function areAllNonTablingEventsChecked(
  checkedEventIds: number[] | null,
  events: GroupingEventLike[]
): boolean {
  if (checkedEventIds === null) return true;
  const { nonTabling } = partitionEventsByTabling(events);
  if (nonTabling.length === 0) return false;
  return nonTabling.every((event) => checkedEventIds.includes(event.id));
}

export function areAllTablingEventsChecked(
  checkedEventIds: number[] | null,
  events: GroupingEventLike[]
): boolean {
  const { tabling } = partitionEventsByTabling(events);
  if (tabling.length === 0) return false;
  if (checkedEventIds === null) return false;
  return tabling.every((event) => checkedEventIds.includes(event.id));
}

export function isGroupingEventChecked(
  eventId: number,
  checkedEventIds: number[] | null,
  events: GroupingEventLike[]
): boolean {
  return resolveCheckedEventIdSet(checkedEventIds, events).has(eventId);
}

/** Collapse to null when selection is exactly all non-tabling events (no tabling). */
function canonicalizeCheckedEventIds(
  selectedIds: number[],
  events: GroupingEventLike[]
): number[] | null {
  const { nonTabling, tabling } = partitionEventsByTabling(events);
  const selected = [...new Set(selectedIds)];
  const selectedSet = new Set(selected);
  const hasAnyTabling = tabling.some((event) => selectedSet.has(event.id));
  const allNonTablingSelected = nonTabling.every((event) => selectedSet.has(event.id));

  if (!hasAnyTabling && allNonTablingSelected && selected.length === nonTabling.length) {
    return null;
  }

  return selected;
}

export function toggleAllNonTablingEvents(
  checkedEventIds: number[] | null,
  events: GroupingEventLike[]
): number[] | null {
  const { nonTabling, tabling } = partitionEventsByTabling(events);
  const current = resolveCheckedEventIdSet(checkedEventIds, events);
  const tablingSelected = tabling.filter((event) => current.has(event.id)).map((event) => event.id);

  if (areAllNonTablingEventsChecked(checkedEventIds, events)) {
    return tablingSelected;
  }

  return canonicalizeCheckedEventIds(
    [...nonTabling.map((event) => event.id), ...tablingSelected],
    events
  );
}

export function toggleAllTablingEvents(
  checkedEventIds: number[] | null,
  events: GroupingEventLike[]
): number[] | null {
  const { nonTabling, tabling } = partitionEventsByTabling(events);
  const current = resolveCheckedEventIdSet(checkedEventIds, events);
  const nonTablingSelected = nonTabling
    .filter((event) => current.has(event.id))
    .map((event) => event.id);

  if (areAllTablingEventsChecked(checkedEventIds, events)) {
    return canonicalizeCheckedEventIds(nonTablingSelected, events);
  }

  return canonicalizeCheckedEventIds(
    [...nonTablingSelected, ...tabling.map((event) => event.id)],
    events
  );
}

export function toggleGroupingEvent(
  eventId: number,
  checkedEventIds: number[] | null,
  events: GroupingEventLike[]
): number[] | null {
  const current = resolveCheckedEventIdSet(checkedEventIds, events);
  if (current.has(eventId)) {
    current.delete(eventId);
  } else {
    current.add(eventId);
  }
  return canonicalizeCheckedEventIds([...current], events);
}

export function studentMatchesGroupingEvents(params: {
  attendedEventIds: number[];
  newsletter: boolean;
  checkedEventIds: number[] | null;
  includeNewsletterContacts: boolean;
  events: GroupingEventLike[];
}): boolean {
  const {
    attendedEventIds,
    newsletter,
    checkedEventIds,
    includeNewsletterContacts,
    events,
  } = params;

  if (attendedEventIds.length === 0) {
    return includeNewsletterContacts && newsletter;
  }

  const checked = resolveCheckedEventIdSet(checkedEventIds, events);
  if (checked.size === 0) return false;
  return attendedEventIds.some((eventId) => checked.has(eventId));
}

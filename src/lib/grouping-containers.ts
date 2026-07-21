import type { GroupingContainerData, GroupingContainerItem } from "../../drizzle/schema";

type LegacyGroupingContainer = {
  title?: string;
  location?: string;
  time?: string;
  studentIds?: number[];
  staffIds?: number[];
  items?: GroupingContainerItem[];
};

export const GROUPING_CONTAINER_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type GroupingContainerDay = (typeof GROUPING_CONTAINER_DAYS)[number];

const GROUPING_CONTAINER_DAY_SET = new Set<string>(GROUPING_CONTAINER_DAYS);

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeContainerDay(value: unknown): GroupingContainerDay | undefined {
  const trimmed = normalizeOptionalText(value);
  if (!trimmed || !GROUPING_CONTAINER_DAY_SET.has(trimmed)) return undefined;
  return trimmed as GroupingContainerDay;
}

function isValidItem(item: unknown): item is GroupingContainerItem {
  if (!item || typeof item !== "object") return false;
  const row = item as GroupingContainerItem;
  return (
    (row.entity === "student" || row.entity === "staff") &&
    Number.isFinite(row.id)
  );
}

function normalizeItem(item: GroupingContainerItem): GroupingContainerItem {
  if (item.entity !== "staff") {
    return { entity: item.entity, id: item.id };
  }
  const roleName =
    typeof item.associatedRoleName === "string" ? item.associatedRoleName.trim() : "";
  return roleName
    ? { entity: "staff", id: item.id, associatedRoleName: roleName }
    : { entity: "staff", id: item.id };
}

function dedupeItems(items: GroupingContainerItem[]): GroupingContainerItem[] {
  const seen = new Set<string>();
  const result: GroupingContainerItem[] = [];
  for (const item of items) {
    const key = `${item.entity}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalizeItem(item));
  }
  return result;
}

export function normalizeGroupingContainer(raw: LegacyGroupingContainer): GroupingContainerData {
  const title = raw.title ?? "";
  const location = normalizeOptionalText(raw.location);
  const time = normalizeContainerDay(raw.time);
  const meta = {
    ...(location ? { location } : {}),
    ...(time ? { time } : {}),
  };

  if (Array.isArray(raw.items)) {
    return {
      title,
      ...meta,
      items: dedupeItems(raw.items.filter(isValidItem)),
    };
  }

  const staffIds = Array.isArray(raw.staffIds)
    ? raw.staffIds.filter((id) => Number.isFinite(id))
    : [];
  const studentIds = Array.isArray(raw.studentIds)
    ? raw.studentIds.filter((id) => Number.isFinite(id))
    : [];

  return {
    title,
    ...meta,
    items: dedupeItems([
      ...staffIds.map((id) => ({ entity: "staff" as const, id })),
      ...studentIds.map((id) => ({ entity: "student" as const, id })),
    ]),
  };
}

export function normalizeGroupingContainers(
  containers: LegacyGroupingContainer[] | null | undefined
): GroupingContainerData[] {
  if (!containers?.length) {
    return [{ title: "", items: [] }];
  }
  return containers.map(normalizeGroupingContainer);
}

export function emptyGroupingContainer(): GroupingContainerData {
  return { title: "", items: [] };
}

export function emptyGroupingContainers(): GroupingContainerData[] {
  return [emptyGroupingContainer()];
}

export function countContainerItems(items: GroupingContainerItem[]) {
  let students = 0;
  let staff = 0;
  for (const item of items) {
    if (item.entity === "student") students += 1;
    else staff += 1;
  }
  return { students, staff };
}

export function itemKey(item: GroupingContainerItem) {
  return `${item.entity}:${item.id}`;
}

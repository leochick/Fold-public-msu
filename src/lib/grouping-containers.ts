import type { GroupingContainerData, GroupingContainerItem } from "../../drizzle/schema";

type LegacyGroupingContainer = {
  title?: string;
  studentIds?: number[];
  staffIds?: number[];
  items?: GroupingContainerItem[];
};

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
  if (Array.isArray(raw.items)) {
    return {
      title,
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

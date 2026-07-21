import type { GroupingContainerData } from "../../drizzle/schema";
import { GROUPING_CONTAINER_DAY_SET, type GroupingContainerDay } from "@/lib/grouping-containers";

export type StaffSpouseRef = {
  id: number;
  spouseId: number | null;
};

export type SpouseDayConflictResult = {
  staffIds: Set<number>;
  containerIndexes: Set<number>;
};

/** Build bidirectional spouse links from whichever side(s) store spouseId. */
export function buildSpouseByStaffId(staff: StaffSpouseRef[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const member of staff) {
    if (member.spouseId == null || member.spouseId === member.id) continue;
    map.set(member.id, member.spouseId);
    if (!map.has(member.spouseId)) {
      map.set(member.spouseId, member.id);
    }
  }
  return map;
}

/**
 * Spouses conflict when they are placed in different containers that meet on the same day.
 * Containers without a day are ignored.
 */
export function findSpouseDayConflicts(
  containers: GroupingContainerData[],
  staff: StaffSpouseRef[]
): SpouseDayConflictResult {
  const spouseByStaffId = buildSpouseByStaffId(staff);
  const staffIds = new Set<number>();
  const containerIndexes = new Set<number>();

  type Placement = { containerIndex: number; day: GroupingContainerDay };
  const placementByStaffId = new Map<number, Placement>();

  for (let containerIndex = 0; containerIndex < containers.length; containerIndex += 1) {
    const container = containers[containerIndex];
    const day = container.time;
    if (!day || !GROUPING_CONTAINER_DAY_SET.has(day)) continue;

    for (const item of container.items) {
      if (item.entity !== "staff") continue;
      placementByStaffId.set(item.id, {
        containerIndex,
        day: day as GroupingContainerDay,
      });
    }
  }

  for (const [staffId, placement] of placementByStaffId) {
    const spouseId = spouseByStaffId.get(staffId);
    if (spouseId == null) continue;
    const spousePlacement = placementByStaffId.get(spouseId);
    if (!spousePlacement) continue;
    if (spousePlacement.day !== placement.day) continue;
    if (spousePlacement.containerIndex === placement.containerIndex) continue;

    staffIds.add(staffId);
    staffIds.add(spouseId);
    containerIndexes.add(placement.containerIndex);
    containerIndexes.add(spousePlacement.containerIndex);
  }

  return { staffIds, containerIndexes };
}

import type { GroupingContainerData } from "../../drizzle/schema";
import { GROUPING_CONTAINER_DAY_SET, type GroupingContainerDay } from "@/lib/grouping-containers";
import { buildSpouseByStaffId, type StaffSpouseRef } from "@/lib/grouping-spouse-day-conflicts";

export type StaffChildcareRef = StaffSpouseRef & {
  /** True when this staff member has one or more children recorded. */
  hasChildren: boolean;
};

export type SpouseChildcareConflictResult = {
  staffIds: Set<number>;
  containerIndexes: Set<number>;
};

/**
 * Spouses need childcare when both are placed on containers with the same day set
 * and at least one of them has children recorded.
 * Containers without a day are ignored.
 */
export function findSpouseChildcareConflicts(
  containers: GroupingContainerData[],
  staff: StaffChildcareRef[]
): SpouseChildcareConflictResult {
  const spouseByStaffId = buildSpouseByStaffId(staff);
  const hasChildrenByStaffId = new Map(staff.map((member) => [member.id, member.hasChildren]));
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

  const seenPairs = new Set<string>();

  for (const [staffId, placement] of placementByStaffId) {
    const spouseId = spouseByStaffId.get(staffId);
    if (spouseId == null) continue;
    const spousePlacement = placementByStaffId.get(spouseId);
    if (!spousePlacement) continue;
    if (spousePlacement.day !== placement.day) continue;

    const pairKey = staffId < spouseId ? `${staffId}:${spouseId}` : `${spouseId}:${staffId}`;
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);

    const eitherHasChildren =
      Boolean(hasChildrenByStaffId.get(staffId)) || Boolean(hasChildrenByStaffId.get(spouseId));
    if (!eitherHasChildren) continue;

    staffIds.add(staffId);
    staffIds.add(spouseId);
    containerIndexes.add(placement.containerIndex);
    containerIndexes.add(spousePlacement.containerIndex);
  }

  return { staffIds, containerIndexes };
}

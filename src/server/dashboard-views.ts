import { db } from "@/lib/db";
import { views, type View } from "../../drizzle/schema";
import { asc, desc, eq } from "drizzle-orm";
import { formatDashboardDate } from "@/lib/dashboard-date-range";

export type DashboardViewItem = {
  id: number;
  name: string;
  from: string;
  to: string;
  isDefault: boolean;
};

function toDashboardViewItem(view: View): DashboardViewItem {
  return {
    id: view.id,
    name: view.name,
    from: formatDashboardDate(view.startDate),
    to: formatDashboardDate(view.endDate),
    isDefault: view.isDefault,
  };
}

export async function listDashboardViews(): Promise<DashboardViewItem[]> {
  const rows = await db.select().from(views).orderBy(desc(views.isDefault), asc(views.name));
  return rows.map(toDashboardViewItem);
}

export async function getDefaultDashboardView(): Promise<DashboardViewItem | null> {
  const [defaultRow] = await db.select().from(views).where(eq(views.isDefault, true)).limit(1);
  if (defaultRow) return toDashboardViewItem(defaultRow);

  const [onlyRow] = await db.select().from(views).orderBy(asc(views.id)).limit(1);
  return onlyRow ? toDashboardViewItem(onlyRow) : null;
}

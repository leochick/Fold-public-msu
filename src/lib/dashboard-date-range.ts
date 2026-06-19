const DAY_MS = 86400_000;

function parseDateStart(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateEnd(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDashboardDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function formatDashboardDateLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
}

export function resolveDashboardDateRange(sp: { from?: string; to?: string }) {
  const parsedFrom = sp.from ? parseDateStart(sp.from) : null;
  const parsedTo = sp.to ? parseDateEnd(sp.to) : null;

  if (parsedFrom && parsedTo && parsedFrom <= parsedTo) {
    return {
      from: parsedFrom,
      to: parsedTo,
      fromStr: formatDashboardDate(parsedFrom),
      toStr: formatDashboardDate(parsedTo),
    };
  }

  const to = parseDateEnd(formatDashboardDate(new Date()))!;
  const from = new Date(to.getTime() - 30 * DAY_MS);
  from.setUTCHours(0, 0, 0, 0);

  return {
    from,
    to,
    fromStr: formatDashboardDate(from),
    toStr: formatDashboardDate(to),
  };
}

export function dashboardDateRangeLabel(from: Date, to: Date): string {
  return `${formatDashboardDateLabel(from)} – ${formatDashboardDateLabel(to)}`;
}

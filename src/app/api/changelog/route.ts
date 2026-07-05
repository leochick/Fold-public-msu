import { withAuth } from "@/lib/http";
import { listChangelog } from "@/server/changelog";

export const GET = withAuth(async ({ req }) => {
  const url = new URL(req.url);
  const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));
  return listChangelog(offset, limit);
}, { parseJson: false });

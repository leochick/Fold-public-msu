import { withAuth } from "@/lib/http";
import { importBody } from "@/lib/contracts/import";
import { processImport } from "@/server/import";

export const POST = withAuth(
  async ({ body }) => processImport(body),
  { bodySchema: importBody }
);

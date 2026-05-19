import { withAuth } from "@/lib/http";
import { commitUpdatesBody } from "@/lib/contracts/students";
import { commitUpdates } from "@/server/students";

export const POST = withAuth(
  async ({ user, body }) => commitUpdates(user.id, body),
  { bodySchema: commitUpdatesBody }
);

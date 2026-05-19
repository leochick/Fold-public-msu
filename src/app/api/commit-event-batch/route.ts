import { withAuth } from "@/lib/http";
import { commitEventBatchBody } from "@/lib/contracts/events";
import { commitEventBatch } from "@/server/events";

export const POST = withAuth(
  async ({ user, body }) => commitEventBatch(user.id, body),
  { bodySchema: commitEventBatchBody }
);

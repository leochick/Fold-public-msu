import { withAuth } from "@/lib/http";
import { commitStudentsBatchBody } from "@/lib/contracts/students";
import { commitStudentsBatch } from "@/server/students-batch";

export const POST = withAuth(
  async ({ user, body }) => commitStudentsBatch(user.id, body),
  { bodySchema: commitStudentsBatchBody }
);

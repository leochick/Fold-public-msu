import { withAuth } from "@/lib/http";
import { parseStudentsBatchBody } from "@/lib/contracts/students";
import { parseStudentsBatch } from "@/server/students-batch";

export const POST = withAuth(
  async ({ body }) => parseStudentsBatch(body.text),
  { bodySchema: parseStudentsBatchBody }
);

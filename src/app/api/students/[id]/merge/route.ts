import { withAuth, httpErr } from "@/lib/http";
import { mergeStudentBody } from "@/lib/contracts/students";
import { mergeStudents } from "@/server/students-merge";

export const POST = withAuth<{ id: string }, typeof mergeStudentBody>(
  async ({ user, params, body }) => {
    const keepId = Number(params.id);
    if (!Number.isFinite(keepId)) throw httpErr.badRequest("bad id");
    return mergeStudents(user.id, keepId, body.mergeWithId, body.overrides ?? {});
  },
  { bodySchema: mergeStudentBody }
);

import { withAuth } from "@/lib/http";
import { intakeCommitBody } from "@/lib/contracts/intake";
import { commitIntake } from "@/server/intake";
import type { ParsedContact } from "@/lib/funnel/types";

export const POST = withAuth(
  async ({ user, body }) => commitIntake(user.id, body.contacts as ParsedContact[]),
  { bodySchema: intakeCommitBody }
);

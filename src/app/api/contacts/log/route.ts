import { withAuth } from "@/lib/http";
import { contactLogBody } from "@/lib/contracts/students";
import { logContact } from "@/server/students";

export const POST = withAuth(
  async ({ user, body }) => logContact(user.id, body),
  { bodySchema: contactLogBody }
);

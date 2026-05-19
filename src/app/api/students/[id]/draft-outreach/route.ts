export const maxDuration = 60;

import { withAuth, httpErr } from "@/lib/http";
import { mockDraftOutreach } from "@/lib/demo-data";
import { draftOutreachBody } from "@/lib/contracts/students";
import { draftOutreach } from "@/server/students";

export const POST = withAuth<{ id: string }, typeof draftOutreachBody>(
  async ({ user, params, body }) => {
    const sid = Number(params.id);
    if (!Number.isFinite(sid)) throw httpErr.badRequest("bad id");
    return draftOutreach(user.displayName, sid, body);
  },
  {
    bodySchema: draftOutreachBody,
    demoMock: () => mockDraftOutreach("ig_dm"),
  }
);

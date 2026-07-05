import { withAuth, httpErr } from "@/lib/http";
import { funnelStageBody } from "@/lib/contracts/students";
import { setFunnelStage } from "@/server/students";

export const POST = withAuth<{ id: string }, typeof funnelStageBody>(
  async ({ user, params, body }) => {
    const sid = Number(params.id);
    if (!Number.isFinite(sid)) throw httpErr.badRequest("bad id");
    return setFunnelStage(user.id, sid, body.stage);
  },
  { bodySchema: funnelStageBody }
);

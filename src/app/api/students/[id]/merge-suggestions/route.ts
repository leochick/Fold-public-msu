import { withAuth, httpErr } from "@/lib/http";
import { listMergeSuggestions } from "@/server/students-merge";

export const GET = withAuth<{ id: string }>(
  async ({ params }) => {
    const studentId = Number(params.id);
    if (!Number.isFinite(studentId)) throw httpErr.badRequest("bad id");
    const result = await listMergeSuggestions(studentId);
    return {
      suggestions: result.suggestions.map(({ candidate, student }) => ({
        candidate,
        student,
      })),
    };
  },
  { parseJson: false }
);

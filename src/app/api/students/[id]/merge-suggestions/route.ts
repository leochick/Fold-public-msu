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
        student: {
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          studentId: student.studentId,
          gender: student.gender,
          year: student.year,
          phone: student.phone,
          email: student.email,
          igHandle: student.igHandle,
          memberStatus: student.memberStatus,
          isActive: student.isActive,
          newsletter: student.newsletter,
          groupme: student.groupme,
          contactedViaIg: student.contactedViaIg,
          primaryContact: student.primaryContact,
          goals: student.goals,
          notes: student.notes,
          courseMaterial: student.courseMaterial,
          funnelStage: student.funnelStage,
        },
      })),
    };
  },
  { parseJson: false }
);

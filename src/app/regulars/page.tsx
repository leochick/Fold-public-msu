import { getRegularsPayload } from "@/server/regulars";
import RegularsEditor from "./RegularsEditor";

export const dynamic = "force-dynamic";

export default async function RegularsPage() {
  const payload = await getRegularsPayload();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Regulars (Current Semester)</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          {payload
            ? `Group events from ${payload.semesterName} and see who attended enough of them to count as a regular.`
            : "Choose a semester from the Semesters menu in the header."}
        </p>
      </div>
      {payload && <RegularsEditor key={payload.semesterId} payload={payload} />}
    </div>
  );
}

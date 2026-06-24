export default function TotalStudentsCard({
  eventId,
  totalStudents,
  saveAction,
}: {
  eventId: number;
  totalStudents: number | null;
  saveAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={saveAction} className="card flex flex-col sm:flex-row sm:items-end gap-3">
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
        <label className="label shrink-0" htmlFor={`totalStudents-${eventId}`}>
          Total # of Students
        </label>
        <input
          id={`totalStudents-${eventId}`}
          name="totalStudents"
          type="number"
          min={0}
          step={1}
          className="input max-w-xs sm:ml-2"
          placeholder="Headcount for this event"
          defaultValue={totalStudents ?? ""}
        />
      </div>
      <button type="submit" className="btn-ghost shrink-0">
        Save
      </button>
    </form>
  );
}

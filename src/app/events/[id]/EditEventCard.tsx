function formatDateForInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function EditEventCard({
  eventId,
  startDate,
  type,
  location,
  saveAction,
}: {
  eventId: number;
  startDate: Date;
  type: string | null;
  location: string | null;
  saveAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={saveAction} className="card space-y-3">
      <h2 className="font-semibold">Edit Event</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="label" htmlFor={`date-${eventId}`}>
            Date
          </label>
          <input
            id={`date-${eventId}`}
            name="date"
            type="date"
            required
            className="input"
            defaultValue={formatDateForInput(new Date(startDate))}
          />
        </div>
        <div>
          <label className="label" htmlFor={`type-${eventId}`}>
            Type
          </label>
          <input
            id={`type-${eventId}`}
            name="type"
            className="input"
            placeholder="retreat / weekly / bbq"
            defaultValue={type ?? ""}
          />
        </div>
        <div>
          <label className="label" htmlFor={`location-${eventId}`}>
            Location
          </label>
          <input
            id={`location-${eventId}`}
            name="location"
            className="input"
            defaultValue={location ?? ""}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <button type="submit" className="btn-ghost">
          Save
        </button>
      </div>
    </form>
  );
}

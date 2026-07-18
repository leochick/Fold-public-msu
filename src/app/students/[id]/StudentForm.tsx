import type { Student } from "../../../../drizzle/schema";
import { COURSE_MATERIAL_OPTIONS } from "@/lib/courses";
import { formatDateInput, formatPersonRef } from "@/lib/parse-student";

export type PersonOption = {
  entity: "student" | "staff";
  id: number;
  name: string;
};

export type EventOption = {
  id: number;
  name: string;
  dateLabel: string;
};

export default function StudentForm({
  action,
  student,
  people = [],
  events = [],
}: {
  action: (fd: FormData) => Promise<void>;
  student?: Student;
  people?: PersonOption[];
  events?: EventOption[];
}) {
  const s = student ?? ({} as Partial<Student>);
  const invitedByDefault = s.invitedByStaffId
    ? formatPersonRef("staff", s.invitedByStaffId)
    : formatPersonRef("student", s.invitedByStudentId ?? null);
  const ledToChristDefault = s.ledToChristByStaffId
    ? formatPersonRef("staff", s.ledToChristByStaffId)
    : formatPersonRef("student", s.ledToChristByStudentId ?? null);
  const staffPeople = people.filter((p) => p.entity === "staff");
  const studentPeople = people.filter((p) => p.entity === "student" && p.id !== s.id);

  return (
    <form action={action} className="card space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" name="firstName" defaultValue={s.firstName ?? ""} required />
        <Field label="Last name" name="lastName" defaultValue={s.lastName ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select label="Gender" name="gender" defaultValue={s.gender ?? ""} options={[["", "—"], ["M", "Male"], ["F", "Female"]]} />
        <Select
          label="Year"
          name="year"
          defaultValue={s.year ?? ""}
          options={[
            ["", "—"], ["freshman", "Freshman"], ["sophomore", "Sophomore"],
            ["junior", "Junior"], ["senior", "Senior"], ["grad", "Grad"], ["other", "Other"],
          ]}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Phone" name="phone" defaultValue={s.phone ?? ""} />
        <Field label="Email" name="email" type="email" defaultValue={s.email ?? ""} />
        <Field label="IG handle" name="igHandle" defaultValue={s.igHandle ?? ""} placeholder="(without @)" />
      </div>
      <div className="grid grid-cols-2 gap-3 items-end">
        <Checkbox label="Newsletter" name="newsletter" defaultChecked={s.newsletter ?? false} />
        <Checkbox label="Groupme" name="groupme" defaultChecked={s.groupme ?? false} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="label">Invited By</span>
          <select name="invitedBy" defaultValue={invitedByDefault} className="input">
            <option value="">—</option>
            {staffPeople.length > 0 && (
              <optgroup label="Staff">
                {staffPeople.map((p) => (
                  <option key={`staff-${p.id}`} value={formatPersonRef("staff", p.id)}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            )}
            {studentPeople.length > 0 && (
              <optgroup label="Students">
                {studentPeople.map((p) => (
                  <option key={`student-${p.id}`} value={formatPersonRef("student", p.id)}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="label">Event Invited To</span>
          <select name="eventInvitedToId" defaultValue={s.eventInvitedToId ?? ""} className="input">
            <option value="">—</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.dateLabel})
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block space-y-1">
        <span className="label">Led to Christ By</span>
        <select name="ledToChristBy" defaultValue={ledToChristDefault} className="input">
          <option value="">—</option>
          {staffPeople.length > 0 && (
            <optgroup label="Staff">
              {staffPeople.map((p) => (
                <option key={`led-staff-${p.id}`} value={formatPersonRef("staff", p.id)}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          )}
          {studentPeople.length > 0 && (
            <optgroup label="Students">
              {studentPeople.map((p) => (
                <option key={`led-student-${p.id}`} value={formatPersonRef("student", p.id)}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      <div className="grid grid-cols-3 gap-3">
        <Field
          label="Salvation Decision Date"
          name="salvationDecisionAt"
          type="date"
          defaultValue={formatDateInput(s.salvationDecisionAt)}
        />
        <Select
          label="Salvation Decision Type"
          name="salvationDecisionType"
          defaultValue={s.salvationDecisionType ?? ""}
          options={[
            ["", "—"],
            ["salvation", "Salvation"],
            ["lordship", "Lordship"],
          ]}
        />
        <Field
          label="Salvation Decision Notes"
          name="salvationDecisionNotes"
          defaultValue={s.salvationDecisionNotes ?? ""}
        />
      </div>
      <Textarea label="Goals" name="goals" defaultValue={s.goals ?? ""} />
      <Textarea label="Notes" name="notes" defaultValue={s.notes ?? ""} />
      <CourseChecks defaultValues={(s.courseMaterial as string[] | undefined) ?? []} />
      <div className="flex justify-end">
        <button className="btn-primary" type="submit">Save</button>
      </div>
    </form>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block space-y-1">
      <span className="label">{label}</span>
      <input className="input" {...rest} />
    </label>
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block space-y-1">
      <span className="label">{label}</span>
      <textarea rows={3} className="input" {...rest} />
    </label>
  );
}

function Select({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: [string, string][];
}) {
  return (
    <label className="block space-y-1">
      <span className="label">{label}</span>
      <select name={name} defaultValue={defaultValue} className="input">
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}

function Checkbox({ label, name, defaultChecked }: { label: string; name: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4" />
      <span>{label}</span>
    </label>
  );
}

function CourseChecks({ defaultValues }: { defaultValues: string[] }) {
  return (
    <div className="space-y-2">
      <span className="label">Course material in progress or completed</span>
      <div className="grid grid-cols-2 gap-2">
        {COURSE_MATERIAL_OPTIONS.map((c) => (
          <label key={c} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="courseMaterial" value={c} defaultChecked={defaultValues.includes(c)} className="h-4 w-4" />
            <span>{c}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

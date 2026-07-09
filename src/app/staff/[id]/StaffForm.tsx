import type { Staff } from "../../../../drizzle/schema";

export default function StaffForm({
  action,
  staff,
}: {
  action: (fd: FormData) => Promise<void>;
  staff?: Staff;
}) {
  const s = staff ?? ({} as Partial<Staff>);
  return (
    <form action={action} className="card space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" name="firstName" defaultValue={s.firstName ?? ""} required />
        <Field label="Last name" name="lastName" defaultValue={s.lastName ?? ""} />
      </div>
      <Select
        label="Gender"
        name="gender"
        defaultValue={s.gender ?? ""}
        options={[["", "—"], ["M", "Male"], ["F", "Female"]]}
      />
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

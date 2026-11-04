import type { FieldA11y } from "@/shared/form/field";
import { roleLabel, type Role } from "../lib/roles";

export function StaffRoleSelect({ value, onChange, ...a11y }: FieldA11y & { value: Role; onChange: (role: Role) => void }) {
  return (
    <select {...a11y} value={value} onChange={(e) => onChange(e.target.value as Role)}>
      {Object.entries(roleLabel).map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

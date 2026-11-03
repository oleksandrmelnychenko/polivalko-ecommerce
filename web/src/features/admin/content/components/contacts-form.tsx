"use client";

import { useState, type FormEvent } from "react";
import { Field } from "@/shared/admin/form/field";
import { FormStatus } from "@/shared/admin/form/form-status";
import { SaveButton } from "@/shared/admin/form/save-button";
import { useAdminForm } from "@/shared/admin/form/use-admin-form";
import type { Contacts } from "@/shared/api/types";
import { saveContacts } from "../api/client";
import { contactGroups, toContactValues } from "../lib/contacts-fields";

export function ContactsForm({ initial }: { initial: Contacts }) {
  const form = useAdminForm();
  const [values, setValues] = useState(() => toContactValues(initial));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const body = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim() || null])) as Contacts;
    const result = await form.submit((headers) => saveContacts(headers, body), {
      done: "Контакти збережено.",
      failed: "Контакти не збережено.",
    });
    if (result?.data) setValues(toContactValues(result.data));
  }

  return (
    <form className="admin-form admin-narrow" onSubmit={onSubmit} noValidate>
      {contactGroups.map((g) => (
        <fieldset key={g.legend} className="admin-fieldset">
          <legend>{g.legend}</legend>
          <div className="admin-grid">
            {g.fields.map((f) => (
              <Field key={f.name} id={f.name} label={f.label} errors={form.errors[f.name]}>
                {(a11y) =>
                  f.multiline ? (
                    <textarea {...a11y} rows={3} value={values[f.name]} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
                  ) : (
                    <input
                      {...a11y}
                      type={f.type ?? "text"}
                      inputMode={f.type === "tel" ? "tel" : undefined}
                      placeholder={f.placeholder}
                      value={values[f.name]}
                      onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                    />
                  )
                }
              </Field>
            ))}
          </div>
        </fieldset>
      ))}
      <FormStatus form={form} />
      <div className="admin-actions">
        <SaveButton busy={form.busy} />
      </div>
    </form>
  );
}

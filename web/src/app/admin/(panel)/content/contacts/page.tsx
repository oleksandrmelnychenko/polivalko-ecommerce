"use client";

import { useState, type FormEvent } from "react";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { useAdminData } from "@/lib/admin";
import { StateBox } from "../../ui";
import { Field, FormStatus, SaveButton, useAdminForm } from "../_lib";

type Contacts = components["schemas"]["ContactsDto"];
type Name = keyof Contacts;

const groups: { legend: string; fields: { name: Name; label: string; type?: "tel" | "email" | "url"; multiline?: boolean; placeholder?: string }[] }[] = [
  {
    legend: "Зв'язок",
    fields: [
      { name: "storePhone", label: "Телефон магазину", type: "tel", placeholder: "+380 67 123 45 67" },
      { name: "servicesPhone", label: "Телефон послуг", type: "tel", placeholder: "+380 67 123 45 67" },
      { name: "email", label: "Email", type: "email" },
    ],
  },
  {
    legend: "Магазин",
    fields: [
      { name: "address", label: "Адреса" },
      { name: "mapUrl", label: "Посилання на карту", type: "url", placeholder: "https://maps.app.goo.gl/…" },
      { name: "schedule", label: "Графік роботи", multiline: true },
    ],
  },
  {
    legend: "Соцмережі",
    fields: [
      { name: "instagram", label: "Instagram", type: "url", placeholder: "https://instagram.com/…" },
      { name: "facebook", label: "Facebook", type: "url", placeholder: "https://facebook.com/…" },
      { name: "telegram", label: "Telegram", type: "url", placeholder: "https://t.me/…" },
      { name: "youTube", label: "YouTube", type: "url", placeholder: "https://youtube.com/@…" },
    ],
  },
];

export default function AdminContactsPage() {
  const contacts = useAdminData("contacts", () => browserApi.GET("/api/v1/admin/content/contacts"));
  return (
    <>
      <h1 className="admin-title">Контакти</h1>
      <p className="muted admin-lead">Видно на сторінці контактів, на головній і у футері сайту. Порожнє поле вітрина не показує.</p>
      <StateBox state={contacts}>{contacts.data && <ContactsForm initial={contacts.data} />}</StateBox>
    </>
  );
}

const toValues = (c: Contacts) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v ?? ""])) as Record<Name, string>;

function ContactsForm({ initial }: { initial: Contacts }) {
  const form = useAdminForm();
  const [values, setValues] = useState(() => toValues(initial));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const body = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim() || null])) as Contacts;
    const result = await form.submit((headers) => browserApi.PUT("/api/v1/admin/content/contacts", { headers, body }), {
      done: "Контакти збережено.",
      failed: "Контакти не збережено.",
    });
    if (result?.data) setValues(toValues(result.data));
  }

  return (
    <form className="admin-form admin-narrow" onSubmit={onSubmit} noValidate>
      {groups.map((g) => (
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

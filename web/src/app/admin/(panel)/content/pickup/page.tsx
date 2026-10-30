"use client";

import { useState, type FormEvent } from "react";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { useAdminData } from "@/lib/admin";
import { StateBox } from "../../ui";
import { CheckField, Field, FormStatus, SaveButton, useAdminForm } from "../_lib";

type PickupPoint = components["schemas"]["AdminPickupPointDto"];
type TextField = Exclude<keyof ReturnType<typeof toValues>, "isActive">;

export default function AdminPickupPage() {
  const points = useAdminData("pickup", () => browserApi.GET("/api/v1/admin/delivery/pickup-points"));
  return (
    <>
      <h1 className="admin-title">Точки самовивозу</h1>
      <p className="muted admin-lead">Адресу, графік та інструкцію покупець бачить, коли обирає самовивіз під час оформлення.</p>
      <StateBox state={points} empty={points.data?.length === 0 ? "Точок самовивозу немає." : undefined}>
        {points.data && (
          <ul className="admin-items">
            {points.data.map((p) => (
              <li key={p.code}>
                <PickupForm initial={p} />
              </li>
            ))}
          </ul>
        )}
      </StateBox>
    </>
  );
}

function PickupForm({ initial }: { initial: PickupPoint }) {
  const form = useAdminForm();
  const [saved, setSaved] = useState(initial);
  const [values, setValues] = useState(() => toValues(initial));
  const id = (field: string) => `${field}-${initial.code}`;
  const set = (field: TextField) => (e: { target: { value: string } }) => setValues({ ...values, [field]: e.target.value });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await form.submit(
      (headers) =>
        browserApi.PUT("/api/v1/admin/delivery/pickup-points/{code}", {
          params: { path: { code: initial.code } },
          headers,
          body: { ...values, mapUrl: values.mapUrl.trim() || null, isActive: values.isActive },
        }),
      { done: "Точку збережено.", failed: "Точку не збережено." },
    );
    if (result?.data) {
      setSaved(result.data);
      setValues(toValues(result.data));
    }
  }

  return (
    <form className="admin-form" onSubmit={onSubmit} noValidate aria-labelledby={id("title")}>
      <div className="admin-item__head">
        <h2 id={id("title")}>{saved.name}</h2>
        <span className="code">{saved.code}</span>
        {!saved.isActive && <span className="muted">вимкнена</span>}
      </div>
      <div className="admin-grid">
        <Field id={id("name")} label="Назва" errors={form.errors.name}>
          {(a11y) => <input {...a11y} value={values.name} onChange={set("name")} />}
        </Field>
        <Field id={id("address")} label="Адреса" errors={form.errors.address}>
          {(a11y) => <input {...a11y} value={values.address} onChange={set("address")} />}
        </Field>
        <Field id={id("schedule")} label="Графік роботи" errors={form.errors.schedule}>
          {(a11y) => <textarea {...a11y} rows={2} value={values.schedule} onChange={set("schedule")} />}
        </Field>
        <Field id={id("instructions")} label="Інструкція покупцю" help="Як знайти точку й що мати із собою." errors={form.errors.instructions}>
          {(a11y) => <textarea {...a11y} rows={2} value={values.instructions} onChange={set("instructions")} />}
        </Field>
        <Field id={id("mapUrl")} label="Посилання на карту" help="Можна лишити порожнім." errors={form.errors.mapUrl}>
          {(a11y) => <input {...a11y} type="url" placeholder="https://maps.app.goo.gl/…" value={values.mapUrl} onChange={set("mapUrl")} />}
        </Field>
      </div>
      <div className="admin-item__row">
        <CheckField
          id={id("active")}
          label="Доступна для самовивозу"
          checked={values.isActive}
          onChange={(isActive) => setValues({ ...values, isActive })}
          errors={form.errors.isActive}
        />
        <SaveButton busy={form.busy} />
      </div>
      <FormStatus form={form} />
    </form>
  );
}

function toValues(p: PickupPoint) {
  return { name: p.name, address: p.address, schedule: p.schedule, instructions: p.instructions, mapUrl: p.mapUrl ?? "", isActive: p.isActive };
}

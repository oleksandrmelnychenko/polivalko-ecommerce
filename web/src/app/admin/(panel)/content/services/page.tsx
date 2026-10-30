"use client";

import { useState, type FormEvent } from "react";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { useAdminData } from "@/lib/admin";
import { StateBox } from "../../ui";
import { CheckField, Field, FormStatus, SaveButton, useAdminForm } from "../_lib";

type Direction = components["schemas"]["AdminServiceDirectionDto"];

export default function AdminServicesPage() {
  const services = useAdminData("services", () => browserApi.GET("/api/v1/admin/content/services"));
  return (
    <>
      <h1 className="admin-title">Напрямки послуг</h1>
      <p className="muted admin-lead">Опис стоїть під назвою напрямку на сторінці послуг. Напрямки йдуть за порядком від меншого числа до більшого.</p>
      <StateBox state={services} empty={services.data?.length === 0 ? "Напрямків послуг немає." : undefined}>
        {services.data && (
          <ul className="admin-items">
            {services.data.map((d) => (
              <li key={d.code}>
                <DirectionForm initial={d} />
              </li>
            ))}
          </ul>
        )}
      </StateBox>
    </>
  );
}

function DirectionForm({ initial }: { initial: Direction }) {
  const form = useAdminForm();
  const [description, setDescription] = useState(initial.description ?? "");
  const [sortOrder, setSortOrder] = useState(String(initial.sortOrder));
  const [visible, setVisible] = useState(initial.isVisible);
  const [saved, setSaved] = useState(initial);
  const id = (field: string) => `${field}-${initial.code}`;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const order = Number(sortOrder);
    if (sortOrder.trim() === "" || !Number.isInteger(order)) {
      form.invalid({ sortOrder: ["Вкажіть ціле число."] });
      return;
    }
    const result = await form.submit(
      (headers) =>
        browserApi.PUT("/api/v1/admin/content/services/{code}", {
          params: { path: { code: initial.code } },
          headers,
          body: { description: description.trim() || null, sortOrder: order, isVisible: visible },
        }),
      { done: "Збережено.", failed: "Напрямок не збережено." },
    );
    if (result?.data) {
      setSaved(result.data);
      setDescription(result.data.description ?? "");
    }
  }

  return (
    <form className="admin-form" onSubmit={onSubmit} noValidate aria-labelledby={id("name")}>
      <div className="admin-item__head">
        <h2 id={id("name")}>{saved.name}</h2>
        <span className="code">{saved.code}</span>
        {!saved.isVisible && <span className="muted">прихований на сайті</span>}
      </div>
      <Field id={id("description")} label="Опис" help="До 1000 символів." errors={form.errors.description}>
        {(a11y) => <textarea {...a11y} rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />}
      </Field>
      <div className="admin-item__row">
        <Field id={id("sortOrder")} label="Порядок" errors={form.errors.sortOrder}>
          {(a11y) => <input {...a11y} type="number" step={1} inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />}
        </Field>
        <CheckField id={id("visible")} label="Показувати на сайті" checked={visible} onChange={setVisible} errors={form.errors.isVisible} />
        <SaveButton busy={form.busy} />
      </div>
      <FormStatus form={form} />
    </form>
  );
}

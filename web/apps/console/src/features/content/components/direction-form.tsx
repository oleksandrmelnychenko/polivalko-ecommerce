"use client";

import { useState, type FormEvent } from "react";
import { CheckField } from "@/shared/form/check-field";
import { Field } from "@/shared/form/field";
import { FormStatus } from "@/shared/form/form-status";
import { SaveButton } from "@/shared/form/save-button";
import { useConsoleForm } from "@/shared/form/use-console-form";
import type { components } from "@polivalko/shared/api/schema";
import { saveService } from "../api/client";

type Direction = components["schemas"]["ConsoleServiceDirectionDto"];

export function DirectionForm({ initial }: { initial: Direction }) {
  const form = useConsoleForm();
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
      (headers) => saveService(headers, initial.code, { description: description.trim() || null, sortOrder: order, isVisible: visible }),
      { done: "Збережено.", failed: "Напрямок не збережено." },
    );
    if (result?.data) {
      setSaved(result.data);
      setDescription(result.data.description ?? "");
    }
  }

  return (
    <form className="console-form" onSubmit={onSubmit} noValidate aria-labelledby={id("name")}>
      <div className="console-item__head">
        <h2 id={id("name")}>{saved.name}</h2>
        <span className="code">{saved.code}</span>
        {!saved.isVisible && <span className="muted">прихований на сайті</span>}
      </div>
      <Field id={id("description")} label="Опис" help="До 1000 символів." errors={form.errors.description}>
        {(a11y) => <textarea {...a11y} rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />}
      </Field>
      <div className="console-item__row">
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

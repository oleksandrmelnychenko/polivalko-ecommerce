"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckoutCourierFields, CheckoutWarehouseSelect, deliveryHint, fieldProps, SettlementPicker, useDeliveryPoint } from "@/features/checkout";
import { postAddress, withCsrf, type CustomerAddress, type SaveAddressRequest } from "@/features/customer";
import { deliveryMethodLabel } from "@polivalko/shared/lib/labels";
import { putAddress } from "../api/client";
import { useFormState } from "../hooks/use-form-state";
import { text } from "../lib/form-status";
import { FormStatus } from "./form-status";
import { TextField } from "./text-field";

const METHODS = ["nova_poshta", "nova_poshta_courier"];

export function AddressForm({
  address,
  first,
  onDone,
  onCancel,
}: {
  address?: CustomerAddress;
  first: boolean;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [method, setMethod] = useState(address?.method ?? "nova_poshta");
  const point = useDeliveryPoint(address);
  const formRef = useRef<HTMLFormElement>(null);
  const form = useFormState(formRef);
  const errors = Object.fromEntries(Object.entries(form.errors).map(([k, v]) => [k === "label" ? k : `delivery.${k}`, v]));
  const { field, fieldError } = fieldProps(errors);

  useEffect(() => {
    formRef.current?.scrollIntoView({ block: "nearest" });
    formRef.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const courier = method === "nova_poshta_courier";
    const body: SaveAddressRequest = {
      label: text(data, "label") || null,
      method,
      settlementRef: point.settlement?.ref ?? null,
      warehouseRef: courier ? null : point.warehouseRef || null,
      address: courier ? { street: text(data, "street"), house: text(data, "house"), apartment: text(data, "apartment") || null } : null,
      isDefault: data.get("isDefault") === "on",
    };
    const result = await form.submit(() => withCsrf((h) => (address ? putAddress(h, address.id, body) : postAddress(h, body))));
    if (result?.response.ok) onDone(address ? "Адресу оновлено." : "Адресу збережено.");
  }

  return (
    <form ref={formRef} className="address-form" onSubmit={onSubmit} noValidate aria-labelledby="address-form-title">
      <h3 id="address-form-title">{address ? "Змінити адресу" : "Нова адреса"}</h3>
      <TextField name="label" label="Назва, якщо хочете" placeholder="Наприклад, Дім або Робота" maxLength={50} defaultValue={address?.label ?? ""} errors={form.errors} />
      <fieldset className="seg seg--cards">
        <legend className="visually-hidden">Спосіб доставки</legend>
        {METHODS.map((code) => (
          <span key={code}>
            <input type="radio" id={`address-method-${code}`} name="method" value={code} checked={method === code} onChange={() => setMethod(code)} />
            <label htmlFor={`address-method-${code}`}>
              <b>{deliveryMethodLabel[code]}</b>
              <small>{deliveryHint[code]}</small>
            </label>
          </span>
        ))}
      </fieldset>
      {method === "nova_poshta_courier" ? (
        <CheckoutCourierFields
          settlement={point.settlement}
          chooseSettlement={point.chooseSettlement}
          settlementError={errors["delivery.settlementRef"]}
          defaults={address?.address ?? undefined}
          field={field}
          fieldError={fieldError}
        />
      ) : (
        <div className="fields-2">
          <SettlementPicker value={point.settlement} onChange={point.chooseSettlement} error={errors["delivery.settlementRef"]} />
          <CheckoutWarehouseSelect
            settlement={point.settlement}
            warehouses={point.warehouses}
            warehouseRef={point.warehouseRef}
            setWarehouseRef={point.setWarehouseRef}
            field={field}
            fieldError={fieldError}
          />
        </div>
      )}
      <label className="consent">
        <input type="checkbox" name="isDefault" defaultChecked={address?.isDefault || first} disabled={address?.isDefault} />
        <span>Основна адреса: підставимо її під час оформлення замовлення</span>
      </label>
      <FormStatus status={form.status} />
      <div className="address-form__actions">
        <button type="submit" className="btn" disabled={form.busy} aria-busy={form.busy}>
          {form.busy ? "Зберігаємо…" : "Зберегти адресу"}
        </button>
        <button type="button" className="btn btn--quiet" onClick={onCancel} disabled={form.busy}>
          Скасувати
        </button>
      </div>
    </form>
  );
}

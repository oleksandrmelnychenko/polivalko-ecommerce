"use client";

import { useState } from "react";
import { addressPlace, addressTitle, expireOn401, withCsrf, type CustomerAddress } from "@/features/customer";
import { problemTitle } from "@polivalko/shared/api/problem";
import { deliveryMethodLabel } from "@polivalko/shared/lib/labels";
import { deleteAddress, putAddress } from "../api/client";

export function AddressCard({
  address,
  onEdit,
  onChanged,
  locked,
}: {
  address: CustomerAddress;
  onEdit: () => void;
  onChanged: (message: string) => void;
  locked: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const title = addressTitle(address);

  async function run(send: () => Promise<{ response: Response; error?: unknown }>, message: string) {
    setBusy(true);
    setError("");
    try {
      const { response, error: problem } = expireOn401(await send());
      if (response.ok) {
        onChanged(message);
        return;
      }
      setError(problemTitle(problem, "Не вдалося зберегти зміни. Спробуйте ще раз."));
    } catch {
      setError("Немає зв'язку з сервером. Спробуйте ще раз.");
    }
    setBusy(false);
  }

  const makeDefault = () =>
    run(
      () =>
        withCsrf((h) =>
          putAddress(h, address.id, {
            label: address.label,
            method: address.method,
            settlementRef: address.settlementRef,
            warehouseRef: address.warehouseRef,
            address: address.address,
            isDefault: true,
          }),
        ),
      "Основну адресу змінено.",
    );

  const remove = () => run(() => withCsrf((h) => deleteAddress(h, address.id)), "Адресу видалено.");

  return (
    <li className={address.isDefault ? "address-card address-card--default" : "address-card"}>
      <p className="address-card__title">
        <b>{title}</b>
        {address.isDefault && <span className="status-chip status-chip--ok">Основна</span>}
      </p>
      <p>{address.settlementName}</p>
      <p className="muted">
        {deliveryMethodLabel[address.method] ?? address.method}: {addressPlace(address)}
      </p>
      {confirming ? (
        <div className="address-card__actions" role="group" aria-label={`Видалення адреси: ${title}`}>
          <span>Видалити цю адресу?</span>
          <button type="button" className="text-btn text-btn--danger" onClick={remove} disabled={busy} aria-busy={busy}>
            Так, видалити
          </button>
          <button type="button" className="text-btn" onClick={() => setConfirming(false)} disabled={busy}>
            Ні
          </button>
        </div>
      ) : (
        <div className="address-card__actions">
          <button type="button" className="text-btn" onClick={onEdit} disabled={locked || busy} aria-label={`Змінити адресу: ${title}`}>
            Змінити
          </button>
          {!address.isDefault && (
            <button type="button" className="text-btn" onClick={makeDefault} disabled={locked || busy} aria-label={`Зробити основною: ${title}`}>
              Зробити основною
            </button>
          )}
          <button type="button" className="text-btn text-btn--danger" onClick={() => setConfirming(true)} disabled={locked || busy} aria-label={`Видалити адресу: ${title}`}>
            Видалити
          </button>
        </div>
      )}
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

"use client";

import { useState } from "react";
import { getAddresses } from "@/features/customer";
import { PlusIcon } from "@polivalko/shared/ui/icons";
import { useAccountData } from "../hooks/use-account-data";
import type { Status } from "../lib/form-status";
import { AddressCard } from "./address-card";
import { AddressForm } from "./address-form";
import { CabinetHead } from "./cabinet-head";
import { FormStatus } from "./form-status";
import { RowsSkeleton } from "./rows-skeleton";
import { StateBox } from "./state-box";

const LIMIT = 10;

export function AddressesScreen() {
  const { data, loading, failed, reload } = useAccountData("addresses", getAddresses);
  const [editing, setEditing] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const list = data ?? [];
  const canAdd = !loading && !failed && editing === null && list.length < LIMIT;

  function start(id: string) {
    setStatus(null);
    setEditing(id);
  }

  function done(message: string) {
    setEditing(null);
    setStatus({ kind: "ok", title: message });
    reload();
  }

  const addButton = (
    <button type="button" className="btn btn--small" onClick={() => start("new")}>
      <PlusIcon />
      Додати адресу
    </button>
  );

  return (
    <section aria-labelledby="cabinet-title">
      <CabinetHead title="Мої адреси">{canAdd && list.length > 0 && addButton}</CabinetHead>
      <FormStatus status={status} />
      {editing && (
        <AddressForm key={editing} address={list.find((a) => a.id === editing)} first={list.length === 0} onDone={done} onCancel={() => setEditing(null)} />
      )}
      {loading ? (
        <RowsSkeleton count={2} />
      ) : failed ? (
        <StateBox
          title="Не вдалося завантажити адреси"
          text="Перевірте зв'язок і спробуйте ще раз."
          action={
            <button type="button" className="btn" onClick={reload}>
              Спробувати ще раз
            </button>
          }
        />
      ) : list.length === 0 ? (
        editing === null && (
          <StateBox
            title="Збережених адрес ще немає"
            text="Додайте відділення Нової пошти або адресу для кур'єра, і під час оформлення її можна буде обрати одним натиском."
            action={addButton}
          />
        )
      ) : (
        <ul className="address-cards">
          {list.map((a) => (
            <AddressCard key={a.id} address={a} onEdit={() => start(a.id)} onChanged={done} locked={editing !== null} />
          ))}
        </ul>
      )}
      {list.length >= LIMIT && <p className="field__help">Можна зберегти до {LIMIT} адрес. Щоб додати нову, видаліть одну зі старих.</p>}
    </section>
  );
}

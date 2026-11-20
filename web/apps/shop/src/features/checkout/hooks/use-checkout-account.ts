"use client";

import { useEffect, useEffectEvent, useRef, useState, type RefObject } from "react";
import { getAddresses, postAddress, useCustomer, withAccountCsrf, withActiveSession, type CustomerAddress } from "@/features/customer";
import type { CreateOrderRequest } from "@polivalko/shared/api/types";

const ADDRESS_LIMIT = 10;

function fillEmpty(form: HTMLFormElement, name: string, value: string | null) {
  const input = form.elements.namedItem(name);
  if (value && input instanceof HTMLInputElement && !input.value) input.value = value;
}

export function useCheckoutAccount(formRef: RefObject<HTMLFormElement | null>, hasForm: boolean, apply: (address: CustomerAddress) => void) {
  const customer = useCustomer();
  const [addresses, setAddresses] = useState<CustomerAddress[] | null>(null);
  const [chosen, setChosen] = useState("new");
  const interacted = useRef(false);
  const owner = customer.me?.id ?? null;

  useEffect(() => {
    const form = formRef.current;
    const me = customer.me;
    if (!hasForm || !form || !me) return;
    fillEmpty(form, "name", me.name);
    fillEmpty(form, "phone", me.phone);
    fillEmpty(form, "email", me.email);
  }, [formRef, hasForm, customer.me]);

  const applyDefault = useEffectEvent((list: CustomerAddress[]) => {
    if (interacted.current) return;
    const preferred = list.find((a) => a.isDefault);
    if (!preferred) return;
    setChosen(preferred.id);
    apply(preferred);
  });

  useEffect(() => {
    if (!owner) return;
    let cancelled = false;
    void withActiveSession(getAddresses, owner).then(({ data }) => {
      if (cancelled || !data) return;
      setAddresses(data);
      applyDefault(data);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [owner]);

  function choose(id: string) {
    interacted.current = true;
    setChosen(id);
    const address = addresses?.find((a) => a.id === id);
    if (address) apply(address);
  }

  function release() {
    interacted.current = true;
    if (chosen !== "new") setChosen("new");
  }

  async function saveAfterOrder(form: FormData, delivery: CreateOrderRequest["delivery"]) {
    if (!owner || !delivery || form.get("saveAddress") !== "on" || delivery.method === "pickup") return;
    try {
      await withAccountCsrf(
        (h) => postAddress(h, {
          label: null,
          method: delivery.method,
          settlementRef: delivery.settlementRef,
          warehouseRef: delivery.warehouseRef,
          address: delivery.address ?? null,
          isDefault: !addresses?.length,
        }),
        owner,
      );
    } catch {}
  }

  return {
    signedIn: owner !== null,
    addresses: owner ? (addresses ?? []) : [],
    chosen,
    choose,
    release,
    canSave: owner !== null && chosen === "new" && (addresses?.length ?? 0) < ADDRESS_LIMIT,
    saveAfterOrder,
  };
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { track } from "@/features/analytics";
import { useCart, useCartQuote } from "@/features/cart";
import { newIdempotencyKey } from "@polivalko/shared/api/browser";
import type { Problem } from "@polivalko/shared/api/problem";
import type { Settlement, Warehouse } from "@polivalko/shared/api/types";
import { createOrder, getWarehouses } from "../api/client";
import { orderRequest } from "../lib/order-request";
import type { Errors, Notice } from "../lib/types";

export function useCheckout(formRef: RefObject<HTMLFormElement | null>) {
  const router = useRouter();
  const { lines, setQuantity, remove, clear } = useCart();
  const { items, quote, failed: quoteError, refresh: refreshQuote } = useCartQuote();
  const [delivery, setDelivery] = useState("nova_poshta");
  const [payment, setPayment] = useState("");
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseRef, setWarehouseRef] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sending, setSending] = useState(false);
  const idempotencyKey = useRef<string | null>(null);
  const focusInvalid = useRef(false);

  useEffect(() => {
    if (!focusInvalid.current) return;
    focusInvalid.current = false;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors, formRef]);

  const checkoutTracked = useRef(false);
  useEffect(() => {
    if (!quote || checkoutTracked.current) return;
    checkoutTracked.current = true;
    track("begin_checkout", {
      currency: "UAH",
      value: Number(quote.total.value),
      items: quote.items.map((i) => ({ item_id: i.sku, item_name: i.name, price: Number(i.unitPrice.value), quantity: i.quantity })),
    });
  }, [quote]);

  const deliveryOption = quote?.deliveryMethods.find((d) => d.code === delivery);
  const paymentOptions = deliveryOption?.paymentMethods ?? [];
  const effectivePayment = paymentOptions.some((p) => p.code === payment) ? payment : (paymentOptions[0]?.code ?? "");

  async function chooseSettlement(next: Settlement | null) {
    setSettlement(next);
    setWarehouseRef("");
    setWarehouses([]);
    if (!next) return;
    const { data } = await getWarehouses(next.ref);
    setWarehouses(data ?? []);
  }

  const blocking = quote?.items.some((i) => i.issue) ?? false;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quote) return;
    if (blocking) {
      setNotice({ kind: "error", title: "Частини товарів не вистачає", text: "Змініть кількість або приберіть позиції, позначені в замовленні." });
      return;
    }
    const form = new FormData(event.currentTarget);
    setSending(true);
    setNotice(null);
    idempotencyKey.current ??= newIdempotencyKey();

    try {
      const { data, error, response } = await createOrder(
        idempotencyKey.current,
        orderRequest(form, { items, quote, delivery, settlement, warehouseRef, payment: effectivePayment }),
      );

      if (data) {
        clear();
        router.push(`/order/${data.number}?token=${encodeURIComponent(data.accessToken)}`);
        return;
      }

      const problem = (error ?? {}) as Problem;
      if (response.status === 400 && problem.errors) {
        const fieldErrors = Object.fromEntries(Object.entries(problem.errors).map(([k, v]) => [k, v[0]]));
        focusInvalid.current = true;
        setErrors(fieldErrors);
        setNotice({ kind: "error", title: "Замовлення не оформлено. Виправте поля:", items: [...new Set(Object.values(fieldErrors))] });
      } else if (problem.code === "checkout.price_changed") {
        await refreshQuote();
        setNotice({ kind: "info", title: "Ціни змінилися", text: "Ми оновили суму. Перевірте її й підтвердіть замовлення ще раз." });
      } else if (problem.code === "checkout.insufficient_stock") {
        await refreshQuote();
        setNotice({ kind: "error", title: "Частини товарів не вистачає", text: "Змініть кількість або приберіть позиції, позначені нижче." });
      } else if (response.status === 429) {
        setNotice({ kind: "error", title: "Забагато замовлень за короткий час", text: "Спробуйте за кілька хвилин або зателефонуйте нам." });
      } else if (problem.code === "idempotency.key_mismatch") {
        idempotencyKey.current = null;
        setNotice({ kind: "error", title: "Спробуйте ще раз", text: "Дані змінилися з моменту попередньої спроби." });
      } else {
        setNotice({ kind: "error", title: problem.title ?? "Не вдалося оформити замовлення", text: problem.detail });
      }
    } catch {
      setNotice({ kind: "error", title: "Немає зв'язку з сервером", text: "Повторне натискання безпечне: дубль замовлення не створиться." });
    } finally {
      setSending(false);
    }
  }

  return {
    lines,
    setQuantity,
    remove,
    quote,
    quoteError,
    delivery,
    setDelivery,
    paymentOptions,
    effectivePayment,
    setPayment,
    settlement,
    chooseSettlement,
    warehouses,
    warehouseRef,
    setWarehouseRef,
    errors,
    notice,
    sending,
    onSubmit,
  };
}

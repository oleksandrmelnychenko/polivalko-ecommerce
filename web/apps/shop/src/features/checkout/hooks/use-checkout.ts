"use client";

import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { track } from "@/features/analytics";
import { cartRows, useCart, useCartQuote } from "@/features/cart";
import { withActiveSession, type CustomerAddress } from "@/features/customer";
import { checkoutCart } from "@/features/cart";
import type { Problem } from "@polivalko/shared/api/problem";
import { orderRequest } from "../lib/order-request";
import { validateOrder } from "../lib/validate-order";
import type { CourierPrefill, Errors, Notice } from "../lib/types";
import { useCheckoutAccount } from "./use-checkout-account";
import { useDeliveryPoint } from "./use-delivery-point";
import { cardProviderOf } from "../lib/card-provider";

export function useCheckout(formRef: RefObject<HTMLFormElement | null>, phone: string | null) {
  const cartState = useCart();
  const { lines, setQuantity, remove } = cartState;
  const { items, quote, deliveryQuote, current: quoteCurrent, failed: quoteError, refresh: refreshQuote } = useCartQuote();
  const [chosenDelivery, setDelivery] = useState("nova_poshta");
  const [payment, setPayment] = useState("");
  const [cardChoice, setCardProvider] = useState("");
  const point = useDeliveryPoint();
  const [courier, setCourier] = useState<CourierPrefill>({ key: 0, values: null });
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sending, setSending] = useState(false);
  const submitting = useRef(false);
  const focusInvalid = useRef(false);
  const recoveredOrder = cartState.ready && lines.length === 0 ? cartState.cart?.lastOrder : null;
  useEffect(() => {
    if (recoveredOrder) {
      // Full navigation clears any client-side scripts (e.g. GA4) before a token-bearing /order URL loads.
      window.location.replace(`/order/${recoveredOrder.number}?token=${encodeURIComponent(recoveredOrder.accessToken)}`);
    }
  }, [recoveredOrder]);

  function applyAddress(address: CustomerAddress) {
    setDelivery(address.method);
    setCourier((c) => ({ key: c.key + 1, values: address.address }));
    void point.applyPoint(address);
  }

  const account = useCheckoutAccount(formRef, lines.length > 0, applyAddress);

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

  const deliveryMethods = deliveryQuote?.deliveryMethods ?? [];
  const deliveryOption = deliveryMethods.find((d) => d.code === chosenDelivery) ?? deliveryMethods[0];
  const delivery = deliveryOption?.code ?? chosenDelivery;
  const paymentOptions = deliveryOption?.paymentMethods ?? [];
  const effectivePayment = paymentOptions.some((p) => p.code === payment) ? payment : (paymentOptions[0]?.code ?? "");
  const cardProvider = effectivePayment === "card" ? cardProviderOf(paymentOptions, cardChoice) : null;

  const blocking = quote?.items.some((i) => i.issue) ?? false;
  const canConfirm = quoteCurrent && !!quote && !!deliveryOption && !!effectivePayment && !blocking && !cartState.error;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quote && quoteError) {
      setNotice({ kind: "error", title: "Не вдалося перевірити ціни", text: "Перевірте зв'язок і підтвердіть замовлення ще раз." });
      void refreshQuote();
      return;
    }
    if (!quote || !canConfirm || submitting.current || !cartState.ready || !cartState.owner || cartState.saving) return;
    const form = new FormData(event.currentTarget);
    const request = orderRequest(form, {
      items, quote, delivery, settlement: point.settlement, warehouseRef: point.warehouseRef, payment: effectivePayment,
    });
    const validation = validateOrder(request);
    if (Object.keys(validation).length) {
      focusInvalid.current = true;
      setErrors(validation);
      setNotice({ kind: "error", title: "Перевірте дані замовлення", items: Object.values(validation) });
      return;
    }
    setErrors({});
    submitting.current = true;
    setSending(true);
    setNotice(null);

    try {
      const request = orderRequest(form, {
        items,
        quote,
        delivery,
        settlement: point.settlement,
        warehouseRef: point.warehouseRef,
        payment: effectivePayment,
      });
      const { data, error, response } = await withActiveSession(async (assertActive) => {
        const serverCart = await cartState.settled();
        assertActive();
        const result = await checkoutCart(serverCart, request);
        if (result.data) {
          assertActive();
          await account.saveAfterOrder(form, request.delivery);
          assertActive();
          await cartState.refresh();
        }
        return result;
      }, cartState.owner === "guest" ? null : cartState.owner);

      if (data) {
        const key = `pv-purchase-${data.number}`;
        let alreadyTracked = false;
        try {
          alreadyTracked = Boolean(window.localStorage.getItem(key));
          if (!alreadyTracked) window.localStorage.setItem(key, "1");
        } catch {}
        if (!alreadyTracked) {
          track("purchase", {
            transaction_id: data.number,
            currency: "UAH",
            value: Number(quote.total.value),
            payment_type: effectivePayment,
            shipping_tier: delivery,
            items: quote.items.map((i) => ({ item_id: i.sku, item_name: i.name, price: Number(i.unitPrice.value), quantity: i.quantity })),
          });
        }
        const pay = cardProvider ? `&pay=${encodeURIComponent(cardProvider)}` : "";
        // Hard navigation ensures GA4 scripts loaded on /checkout are completely unloaded before /order?token=... opens.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Intentional full navigation to unload analytics before a token-bearing /order URL.
        window.location.assign(`/order/${data.number}?token=${encodeURIComponent(data.accessToken)}${pay}`);
        return;
      }

      const problem = (error ?? {}) as Problem;
      if (response.status === 400 && problem.errors) {
        const fieldErrors = Object.fromEntries(Object.entries(problem.errors).map(([k, v]) => [k, v[0]]));
        focusInvalid.current = true;
        setErrors(fieldErrors);
        setNotice({ kind: "error", title: "Замовлення не оформлено. Виправте поля:", items: [...new Set(Object.values(fieldErrors))] });
        if (fieldErrors["delivery.method"] || fieldErrors["payment.method"]) await refreshQuote();
      } else if (problem.code === "checkout.price_changed") {
        await refreshQuote();
        setNotice({ kind: "info", title: "Ціни змінилися", text: "Ми оновили суму. Перевірте її й підтвердіть замовлення ще раз." });
      } else if (problem.code === "checkout.insufficient_stock") {
        await refreshQuote();
        setNotice({ kind: "error", title: "Частини товарів не вистачає", text: "Змініть кількість або приберіть позиції, позначені нижче." });
      } else if (response.status === 429) {
        setNotice({ kind: "error", title: "Забагато замовлень за короткий час", text: phone ? `Спробуйте за кілька хвилин або зателефонуйте нам: ${phone}.` : "Спробуйте за кілька хвилин. Якщо не вийде, зверніться в магазин: контакти на сторінці «Контакти»." });
      } else if (problem.code === "cart.changed") {
        await cartState.refresh();
        setNotice({ kind: "error", title: "Кошик змінився", text: "Перевірте склад і суму замовлення ще раз." });
      } else {
        setNotice({ kind: "error", title: problem.title ?? "Не вдалося оформити замовлення", text: problem.detail });
      }
    } catch {
      await cartState.refresh();
      setNotice({ kind: "error", title: "Перевіряємо оформлення", text: "Якщо з’єднання не відновилося, оновіть сторінку. Сервер збереже результат і не створить дубль." });
    } finally {
      submitting.current = false;
      setSending(false);
    }
  }

  return {
    ready: cartState.ready,
    cartError: cartState.error,
    refreshCart: cartState.refresh,
    recovering: !!recoveredOrder,
    lines,
    rows: cartRows(quote, lines),
    setQuantity,
    remove,
    quote,
    deliveryQuote,
    quoteError,
    refreshQuote,
    delivery,
    deliveryOption,
    setDelivery: (code: string) => {
      if (delivery === "nova_poshta_courier" && formRef.current) {
        const data = new FormData(formRef.current);
        setCourier(current => ({ key: current.key + 1, values: { street: String(data.get("street") ?? ""), house: String(data.get("house") ?? ""), apartment: String(data.get("apartment") ?? "") || null } }));
      }
      setDelivery(code);
      account.release();
    },
    paymentOptions,
    effectivePayment,
    setPayment,
    cardProvider,
    setCardProvider,
    settlement: point.settlement,
    chooseSettlement: (next: Parameters<typeof point.chooseSettlement>[0]) => {
      account.release();
      return point.chooseSettlement(next);
    },
    warehouses: point.warehouses,
    warehouseStatus: point.warehouseStatus,
    retryWarehouses: point.retryWarehouses,
    warehouseRef: point.warehouseRef,
    setWarehouseRef: (ref: string) => {
      point.setWarehouseRef(ref);
      account.release();
    },
    courier,
    account,
    errors,
    notice,
    sending: sending || cartState.saving || !cartState.ready,
    canConfirm,
    onSubmit,
  };
}

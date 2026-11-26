const MONO_CHECKOUT_ORIGIN = "https://pay.mbnk.biz";
const LIQPAY_ORIGIN = "https://www.liqpay.ua";
const LIQPAY_CHECKOUT_PATH = "/api/3/checkout";

function parseDestination(value: string, shopOrigin: string): URL | null {
  try {
    const url = new URL(value, shopOrigin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.username || url.password ? null : url;
  } catch {
    return null;
  }
}

export function paymentPageUrl(value: string, shopOrigin: string): string | null {
  const url = parseDestination(value, shopOrigin);
  if (!url) return null;
  if (url.origin === MONO_CHECKOUT_ORIGIN) return url.href;
  if (url.origin === LIQPAY_ORIGIN && url.pathname === LIQPAY_CHECKOUT_PATH && url.searchParams.has("data") && url.searchParams.has("signature")) return url.href;
  if (url.origin === shopOrigin && /^\/pay\/sandbox\/sbx_[a-f0-9]{32}$/.test(url.pathname) && !url.search && !url.hash) return url.href;
  return null;
}

export function sandboxReturnUrl(value: string, shopOrigin: string, orderNumber: string): string | null {
  const url = parseDestination(value, shopOrigin);
  if (!url || url.origin !== shopOrigin || url.searchParams.get("payment") !== "return") return null;
  const order = encodeURIComponent(orderNumber);
  return url.pathname === `/order/${order}` || url.pathname === `/account/orders/${order}` ? url.href : null;
}

"use client";

import { useState } from "react";
import { useSummary } from "@/features/shell";
import { withCsrf } from "@/shared/csrf";
import { problemTitle } from "@polivalko/shared/api/problem";
import type { OrderStatus } from "@polivalko/shared/api/types";
import { changeOrderStatus } from "../api/client";
import type { ConsoleOrder } from "../lib/types";

export function useOrderStatusChange(number: string, onChanged: (order: ConsoleOrder) => void) {
  const { reload: reloadSummary } = useSummary();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function change(status: OrderStatus) {
    setBusy(status);
    setError(null);
    const result = await withCsrf((headers) => changeOrderStatus(headers, number, { status, reason: reason.trim() || null }));
    setBusy(null);
    if (result.data) {
      onChanged(result.data);
      setReason("");
      reloadSummary();
    } else {
      setError(problemTitle(result.error, "Статус не змінено."));
    }
  }

  return { reason, setReason, busy, error, change };
}

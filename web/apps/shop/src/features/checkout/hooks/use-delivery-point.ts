"use client";

import { useEffect, useRef, useState } from "react";
import type { Settlement, Warehouse } from "@polivalko/shared/api/types";
import { getWarehouses } from "../api/client";

export type SavedPoint = { settlementRef: string; settlementName: string; warehouseRef: string | null };
export type WarehouseStatus = "idle" | "loading" | "ready" | "error";

const toSettlement = (point: SavedPoint): Settlement => ({ ref: point.settlementRef, name: point.settlementName, area: "" });

export function useDeliveryPoint(initial?: SavedPoint) {
  const [settlement, setSettlement] = useState<Settlement | null>(initial ? toSettlement(initial) : null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseRef, setWarehouseRef] = useState(initial?.warehouseRef ?? "");
  const request = useRef<AbortController | null>(null);
  const [warehouseStatus, setWarehouseStatus] = useState<WarehouseStatus>("idle");
  const retrySelection = useRef("");
  const start = useRef(initial);

  async function load(next: Settlement, keep: string) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    retrySelection.current = keep;
    setWarehouseStatus("loading");
    try {
      const { data } = await getWarehouses(next.ref, AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]));
      if (controller.signal.aborted) return;
      if (!data) throw new Error("Не вдалося завантажити відділення");
      setWarehouses(data);
      setWarehouseRef(data.some((warehouse) => warehouse.ref === keep) ? keep : "");
      setWarehouseStatus("ready");
    } catch {
      if (!controller.signal.aborted) {
        setWarehouses([]);
        setWarehouseRef("");
        setWarehouseStatus("error");
      }
    }
  }

  useEffect(() => {
    const point = start.current;
    if (point) void load(toSettlement(point), point.warehouseRef ?? "");
    return () => request.current?.abort();
  }, []);

  async function chooseSettlement(next: Settlement | null) {
    setSettlement(next);
    setWarehouseRef("");
    setWarehouses([]);
    if (!next) {
      request.current?.abort();
      setWarehouseStatus("idle");
      return;
    }
    await load(next, "");
  }

  async function applyPoint(point: SavedPoint) {
    const next = toSettlement(point);
    setSettlement(next);
    setWarehouseRef("");
    setWarehouses([]);
    await load(next, point.warehouseRef ?? "");
  }

  function retryWarehouses() {
    if (settlement) void load(settlement, retrySelection.current);
  }

  return { settlement, chooseSettlement, warehouses, warehouseStatus, retryWarehouses, warehouseRef, setWarehouseRef, applyPoint };
}

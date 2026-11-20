"use client";

import { useEffect, useRef, useState } from "react";
import type { Settlement, Warehouse } from "@polivalko/shared/api/types";
import { getWarehouses } from "../api/client";

export type SavedPoint = { settlementRef: string; settlementName: string; warehouseRef: string | null };

const toSettlement = (point: SavedPoint): Settlement => ({ ref: point.settlementRef, name: point.settlementName, area: "" });

export function useDeliveryPoint(initial?: SavedPoint) {
  const [settlement, setSettlement] = useState<Settlement | null>(initial ? toSettlement(initial) : null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseRef, setWarehouseRef] = useState(initial?.warehouseRef ?? "");
  const request = useRef<AbortController | null>(null);
  const start = useRef(initial);

  async function load(next: Settlement, keep: string) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      const { data } = await getWarehouses(next.ref, controller.signal);
      if (controller.signal.aborted) return;
      const available = data ?? [];
      setWarehouses(available);
      setWarehouseRef(available.some((warehouse) => warehouse.ref === keep) ? keep : "");
    } catch {
      if (!controller.signal.aborted) {
        setWarehouses([]);
        setWarehouseRef("");
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

  return { settlement, chooseSettlement, warehouses, warehouseRef, setWarehouseRef, applyPoint };
}

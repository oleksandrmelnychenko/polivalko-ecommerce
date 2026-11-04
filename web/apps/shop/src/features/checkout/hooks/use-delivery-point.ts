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
  const request = useRef(0);
  const start = useRef(initial);

  async function load(next: Settlement, keep: string) {
    const current = ++request.current;
    const { data } = await getWarehouses(next.ref);
    if (current !== request.current) return;
    setWarehouses(data ?? []);
    if (keep) setWarehouseRef(keep);
  }

  useEffect(() => {
    const point = start.current;
    if (!point) return;
    const current = ++request.current;
    void getWarehouses(point.settlementRef).then(({ data }) => {
      if (current === request.current) setWarehouses(data ?? []);
    });
  }, []);

  async function chooseSettlement(next: Settlement | null) {
    setSettlement(next);
    setWarehouseRef("");
    setWarehouses([]);
    if (!next) return;
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

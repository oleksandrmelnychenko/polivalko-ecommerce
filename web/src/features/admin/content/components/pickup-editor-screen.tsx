"use client";

import { useAdminData } from "@/shared/admin/use-admin-data";
import { StateBox } from "@/shared/admin/ui/state-box";
import { getPickupPoints } from "../api/client";
import { PickupForm } from "./pickup-form";

export function PickupEditorScreen() {
  const points = useAdminData("pickup", () => getPickupPoints());
  return (
    <>
      <h1 className="admin-title">Точки самовивозу</h1>
      <p className="muted admin-lead">Адресу, графік та інструкцію покупець бачить, коли обирає самовивіз під час оформлення.</p>
      <StateBox state={points} empty={points.data?.length === 0 ? "Точок самовивозу немає." : undefined}>
        {points.data && (
          <ul className="admin-items">
            {points.data.map((p) => (
              <li key={p.code}>
                <PickupForm initial={p} />
              </li>
            ))}
          </ul>
        )}
      </StateBox>
    </>
  );
}

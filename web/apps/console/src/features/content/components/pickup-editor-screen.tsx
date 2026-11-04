"use client";

import { useConsoleData } from "@/shared/use-console-data";
import { StateBox } from "@/shared/ui/state-box";
import { getPickupPoints } from "../api/client";
import { PickupForm } from "./pickup-form";

export function PickupEditorScreen() {
  const points = useConsoleData("pickup", () => getPickupPoints());
  return (
    <>
      <h1 className="console-title">Точки самовивозу</h1>
      <p className="muted console-lead">Адресу, графік та інструкцію покупець бачить, коли обирає самовивіз під час оформлення.</p>
      <StateBox state={points} empty={points.data?.length === 0 ? "Точок самовивозу немає." : undefined}>
        {points.data && (
          <ul className="console-items">
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

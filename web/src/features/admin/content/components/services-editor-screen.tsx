"use client";

import { useAdminData } from "@/shared/admin/use-admin-data";
import { StateBox } from "@/shared/admin/ui/state-box";
import { getServices } from "../api/client";
import { DirectionForm } from "./direction-form";

export function ServicesEditorScreen() {
  const services = useAdminData("services", () => getServices());
  return (
    <>
      <h1 className="admin-title">Напрямки послуг</h1>
      <p className="muted admin-lead">Опис стоїть під назвою напрямку на сторінці послуг. Напрямки йдуть за порядком від меншого числа до більшого.</p>
      <StateBox state={services} empty={services.data?.length === 0 ? "Напрямків послуг немає." : undefined}>
        {services.data && (
          <ul className="admin-items">
            {services.data.map((d) => (
              <li key={d.code}>
                <DirectionForm initial={d} />
              </li>
            ))}
          </ul>
        )}
      </StateBox>
    </>
  );
}

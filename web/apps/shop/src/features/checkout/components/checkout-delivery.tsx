import Link from "next/link";
import type { ReactNode } from "react";
import type { PickupPoint, Quote, Settlement, Warehouse } from "@polivalko/shared/api/types";
import { PinIcon, StoreIcon, TruckIcon } from "@polivalko/shared/ui/icons";
import { deliveryHint, deliveryTitle } from "../lib/delivery";
import type { FieldProps } from "../lib/field-props";
import type { CourierPrefill, Errors } from "../lib/types";
import { CheckoutCourierFields } from "./checkout-courier-fields";
import { CheckoutOptions } from "./checkout-options";
import { CheckoutStep } from "./checkout-step";
import { CheckoutWarehouseSelect } from "./checkout-warehouse-select";
import { SettlementPicker } from "./settlement-picker";

const ICONS: Record<string, ReactNode> = { nova_poshta: <TruckIcon />, nova_poshta_courier: <PinIcon />, pickup: <StoreIcon /> };

function stepHint(codes: string[]) {
  const carrier = codes.some((code) => code !== "pickup");
  const pickup = codes.includes("pickup");
  if (carrier && !pickup) return "Нова пошта по Україні";
  if (pickup && !carrier) return "Самовивіз з магазину";
  return "Нова пошта по Україні або самовивіз з магазину";
}

export function CheckoutDelivery({
  quote,
  delivery,
  setDelivery,
  settlement,
  chooseSettlement,
  warehouses,
  warehouseRef,
  setWarehouseRef,
  errors,
  field,
  fieldError,
  courier,
  saved,
  save,
  phone,
  pickupPoint,
}: FieldProps & {
  quote: Quote | null;
  delivery: string;
  setDelivery: (code: string) => void;
  settlement: Settlement | null;
  chooseSettlement: (next: Settlement | null) => void;
  warehouses: Warehouse[];
  warehouseRef: string;
  setWarehouseRef: (ref: string) => void;
  errors: Errors;
  courier?: CourierPrefill;
  saved?: ReactNode;
  save?: ReactNode;
  phone: string | null;
  pickupPoint: PickupPoint | null;
}) {
  const methods = quote?.deliveryMethods ?? [];
  const options = methods.map((d) => ({
    code: d.code,
    title: deliveryTitle[d.code] ?? d.name,
    icon: ICONS[d.code] ?? <TruckIcon />,
    notes: [deliveryHint[d.code] ?? "", d.description ?? "", d.priceNote ?? ""],
  }));

  return (
    <CheckoutStep id="delivery-title" icon={<TruckIcon />} title="Отримання" hint={stepHint(methods.map((d) => d.code))}>
      {saved}
      <CheckoutOptions name="delivery" legend="Спосіб отримання" options={options} value={delivery} onChange={setDelivery} />
      {fieldError("delivery.method")}

      {quote && methods.length === 0 ? (
        <p className="notice">
          <strong>Зараз немає доступних способів отримання</strong>
          {phone ? (
            `Телефон: ${phone}, і менеджер допоможе оформити замовлення.`
          ) : (
            <>
              Зверніться в магазин, і менеджер допоможе оформити замовлення. Контакти на сторінці{" "}
              <Link href="/contacts" className="link">
                «Контакти»
              </Link>
              .
            </>
          )}
        </p>
      ) : delivery === "nova_poshta_courier" ? (
        <CheckoutCourierFields
          key={courier?.key}
          defaults={courier?.values ?? undefined}
          settlement={settlement}
          chooseSettlement={chooseSettlement}
          settlementError={errors["delivery.settlementRef"]}
          field={field}
          fieldError={fieldError}
        />
      ) : delivery !== "pickup" ? (
        <div className="fields-2">
          <SettlementPicker value={settlement} onChange={chooseSettlement} error={errors["delivery.settlementRef"]} />
          <CheckoutWarehouseSelect
            settlement={settlement}
            warehouses={warehouses}
            warehouseRef={warehouseRef}
            setWarehouseRef={setWarehouseRef}
            field={field}
            fieldError={fieldError}
          />
        </div>
      ) : (
        <div className="co-info">
          <StoreIcon />
          <div className="co-pickup-details">
            <strong>{pickupPoint?.name || "Самовивіз з магазину"}</strong>
            {pickupPoint ? <>
              <p>{pickupPoint.address}</p>
              <p>{pickupPoint.schedule}</p>
              <p>{pickupPoint.instructions}</p>
              {pickupPoint.mapUrl && <a className="link" href={pickupPoint.mapUrl} target="_blank" rel="noopener noreferrer">Прокласти маршрут ↗</a>}
            </> : <Link className="link" href="/contacts">Адреса й графік магазину</Link>}
          </div>
        </div>
      )}
      {save}
      {quote && delivery !== "pickup" && <p className="co-note">{quote.deliveryNote}</p>}
    </CheckoutStep>
  );
}

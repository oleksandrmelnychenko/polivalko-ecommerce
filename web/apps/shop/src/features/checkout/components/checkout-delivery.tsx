import type { ReactNode } from "react";
import type { Quote, Settlement, Warehouse } from "@polivalko/shared/api/types";
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
}) {
  const methods = quote?.deliveryMethods ?? [];
  const options = methods.map((d) => ({
    code: d.code,
    title: deliveryTitle[d.code] ?? d.name,
    icon: ICONS[d.code] ?? <TruckIcon />,
    notes: [deliveryHint[d.code] ?? "", d.description ?? "", d.priceNote ?? ""],
  }));

  return (
    <CheckoutStep id="delivery-title" icon={<TruckIcon />} title="Отримання" hint="Нова пошта по Україні або самовивіз з магазину">
      {saved}
      <CheckoutOptions name="delivery" legend="Спосіб отримання" options={options} value={delivery} onChange={setDelivery} />
      {fieldError("delivery.method")}

      {quote && methods.length === 0 ? (
        <p className="notice">
          <strong>Зараз немає доступних способів отримання</strong>
          Зателефонуйте нам, і менеджер допоможе оформити замовлення.
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
          <p>
            <strong>Самовивіз з магазину</strong>
            Адресу й графік менеджер підтвердить, коли замовлення буде готове.
          </p>
        </div>
      )}
      {save}
      {quote && delivery !== "pickup" && <p className="co-note">{quote.deliveryNote}</p>}
    </CheckoutStep>
  );
}

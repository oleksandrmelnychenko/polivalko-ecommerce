import type { ReactNode } from "react";
import type { Quote, Settlement, Warehouse } from "@polivalko/shared/api/types";
import { deliveryHint } from "../lib/delivery";
import type { FieldProps } from "../lib/field-props";
import type { CourierPrefill, Errors } from "../lib/types";
import { CheckoutCourierFields } from "./checkout-courier-fields";
import { CheckoutWarehouseSelect } from "./checkout-warehouse-select";
import { SettlementPicker } from "./settlement-picker";

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
  return (
    <section aria-labelledby="delivery-title">
      <h2 id="delivery-title">
        <span>2</span> Отримання
      </h2>
      {saved}
      <fieldset className="seg seg--cards">
        <legend className="visually-hidden">Спосіб отримання</legend>
        {methods.map((d) => (
          <span key={d.code}>
            <input type="radio" id={`delivery-${d.code}`} name="delivery" value={d.code} checked={delivery === d.code} onChange={() => setDelivery(d.code)} />
            <label htmlFor={`delivery-${d.code}`}>
              <b>{d.name}</b>
              <small>{deliveryHint[d.code] ?? ""}</small>
              {d.description && <small>{d.description}</small>}
              {d.priceNote && <small>{d.priceNote}</small>}
            </label>
          </span>
        ))}
      </fieldset>
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
        <p className="notice">
          <strong>Самовивіз з магазину в Бучі</strong>
          Адресу й графік менеджер підтвердить, коли замовлення буде готове.
        </p>
      )}
      {save}
      {quote && <p className="field__help">{quote.deliveryNote}</p>}
    </section>
  );
}

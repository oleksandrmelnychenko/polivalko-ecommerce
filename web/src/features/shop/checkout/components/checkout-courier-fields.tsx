import type { Settlement } from "@/shared/api/types";
import type { FieldProps } from "../lib/field-props";
import { SettlementPicker } from "./settlement-picker";

export function CheckoutCourierFields({
  settlement,
  chooseSettlement,
  settlementError,
  field,
  fieldError,
}: FieldProps & {
  settlement: Settlement | null;
  chooseSettlement: (next: Settlement | null) => void;
  settlementError?: string;
}) {
  return (
    <>
      <div className="fields-2">
        <SettlementPicker value={settlement} onChange={chooseSettlement} error={settlementError} />
        <div className="field">
          <label htmlFor="street">Вулиця</label>
          <input id="street" name="street" autoComplete="address-line1" maxLength={150} required {...field("delivery.address.street")} />
          {fieldError("delivery.address.street")}
        </div>
      </div>
      <div className="fields-2">
        <div className="field">
          <label htmlFor="house">Будинок</label>
          <input id="house" name="house" autoComplete="off" maxLength={20} required {...field("delivery.address.house")} />
          {fieldError("delivery.address.house")}
        </div>
        <div className="field">
          <label htmlFor="apartment">Квартира, якщо є</label>
          <input id="apartment" name="apartment" autoComplete="address-line2" maxLength={20} {...field("delivery.address.apartment")} />
          {fieldError("delivery.address.apartment")}
        </div>
      </div>
    </>
  );
}

import type { Settlement, Warehouse } from "@polivalko/shared/api/types";
import type { FieldProps } from "../lib/field-props";

export function CheckoutWarehouseSelect({
  settlement,
  warehouses,
  warehouseRef,
  setWarehouseRef,
  field,
  fieldError,
}: FieldProps & {
  settlement: Settlement | null;
  warehouses: Warehouse[];
  warehouseRef: string;
  setWarehouseRef: (ref: string) => void;
}) {
  return (
    <div className="field">
      <label htmlFor="warehouse">Відділення або поштомат</label>
      <select
        id="warehouse"
        value={warehouseRef}
        onChange={(e) => setWarehouseRef(e.target.value)}
        disabled={!settlement}
        {...field("delivery.warehouseRef")}
      >
        <option value="">{settlement ? "Оберіть зі списку" : "Спершу оберіть місто"}</option>
        {["branch", "postomat"].map((type) => {
          const list = warehouses.filter((w) => w.type === type);
          return list.length ? (
            <optgroup key={type} label={type === "branch" ? "Відділення" : "Поштомати"}>
              {list.map((w) => (
                <option key={w.ref} value={w.ref}>
                  {w.name}, {w.address}
                </option>
              ))}
            </optgroup>
          ) : null;
        })}
      </select>
      {fieldError("delivery.warehouseRef")}
    </div>
  );
}

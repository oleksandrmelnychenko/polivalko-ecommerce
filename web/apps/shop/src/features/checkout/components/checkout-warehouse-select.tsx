import type { Settlement, Warehouse } from "@polivalko/shared/api/types";
import { DropdownSelect } from "@/shared/ui/dropdown-select";
import type { FieldProps } from "../lib/field-props";
import type { WarehouseStatus } from "../hooks/use-delivery-point";

const GROUPS = [
  { type: "branch", label: "Відділення" },
  { type: "postomat", label: "Поштомати" },
];

export function CheckoutWarehouseSelect({
  settlement,
  warehouses,
  warehouseStatus,
  retryWarehouses,
  warehouseRef,
  setWarehouseRef,
  field,
  fieldError,
}: FieldProps & {
  settlement: Settlement | null;
  warehouses: Warehouse[];
  warehouseStatus: WarehouseStatus;
  retryWarehouses: () => void;
  warehouseRef: string;
  setWarehouseRef: (ref: string) => void;
}) {
  const options = GROUPS.flatMap((group) =>
    warehouses.filter((w) => w.type === group.type).map((w) => ({ value: w.ref, label: `${w.name}, ${w.address}`, group: group.label })),
  );

  return (
    <div className="field">
      <label htmlFor="warehouse">Відділення або поштомат</label>
      <DropdownSelect
        id="warehouse"
        variant="field"
        value={warehouseRef}
        options={options}
        onChange={setWarehouseRef}
        placeholder={!settlement ? "Спершу оберіть місто" : warehouseStatus === "loading" ? "Завантажуємо відділення…" : "Оберіть зі списку"}
        searchable={options.length > 8}
        searchPlaceholder="Номер або вулиця"
        disabled={!settlement || !options.length}
        {...field("delivery.warehouseRef")}
      />
      {fieldError("delivery.warehouseRef")}
      {warehouseStatus === "error" && <p role="alert" className="field__error">
        Не вдалося завантажити відділення.{" "}
        <button type="button" className="link" onClick={retryWarehouses}>Повторити завантаження відділень</button>
      </p>}
      {warehouseStatus === "ready" && options.length === 0 && <p role="status" className="field__help">
        У цьому населеному пункті немає доступних відділень або поштоматів.
      </p>}
    </div>
  );
}

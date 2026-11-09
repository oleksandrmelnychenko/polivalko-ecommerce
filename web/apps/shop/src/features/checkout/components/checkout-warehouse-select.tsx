import type { Settlement, Warehouse } from "@polivalko/shared/api/types";
import { DropdownSelect } from "@/shared/ui/dropdown-select";
import type { FieldProps } from "../lib/field-props";

const GROUPS = [
  { type: "branch", label: "Відділення" },
  { type: "postomat", label: "Поштомати" },
];

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
        placeholder={settlement ? "Оберіть зі списку" : "Спершу оберіть місто"}
        searchable={options.length > 8}
        searchPlaceholder="Номер або вулиця"
        disabled={!settlement}
        {...field("delivery.warehouseRef")}
      />
      {fieldError("delivery.warehouseRef")}
    </div>
  );
}

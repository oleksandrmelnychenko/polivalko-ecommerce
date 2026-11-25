import { StoreIcon, TruckIcon } from "@polivalko/shared/ui/icons";

export function DeliveryIcon({ code }: { code: string }) {
  if (code === "nova_poshta" || code === "nova_poshta_courier") {
    return <img className="np-mark" src="/brand/nova-poshta.svg" width={24} height={24} alt="" />;
  }
  return code === "pickup" ? <StoreIcon /> : <TruckIcon />;
}

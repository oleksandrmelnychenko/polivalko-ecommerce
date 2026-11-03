import { formatDateTime } from "@/shared/lib/format";
import { PhoneIcon, PrintIcon } from "@/shared/ui/icons";
import type { AdminOrder } from "../lib/types";
import { PaymentStatusText, StatusText } from "./status-text";

export function OrderDetailHead({ order: o }: { order: AdminOrder }) {
  return (
    <>
      <p className="print-only">
        <strong>PoliValko</strong> · накладна для комплектування · надруковано {formatDateTime(new Date().toISOString())}
      </p>
      <div className="admin-order-head">
        <div className="admin-order-head__title">
          <h1 className="admin-title">{o.number}</h1>
          <StatusText status={o.status} />
          <PaymentStatusText status={o.paymentStatus} />
          <span className="muted">створено {formatDateTime(o.createdAt)}</span>
        </div>
        <div className="admin-head__actions no-print">
          <a className="btn btn--quiet" href={`tel:${o.phone}`}>
            <PhoneIcon />
            Подзвонити
          </a>
          <button type="button" className="btn btn--quiet" onClick={() => window.print()}>
            <PrintIcon />
            Друк
          </button>
        </div>
      </div>
    </>
  );
}

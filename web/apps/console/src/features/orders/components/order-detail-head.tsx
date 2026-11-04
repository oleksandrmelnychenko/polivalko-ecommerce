import { formatDateTime } from "@polivalko/shared/lib/format";
import { PhoneIcon, PrintIcon } from "@polivalko/shared/ui/icons";
import type { ConsoleOrder } from "../lib/types";
import { PaymentStatusText, StatusText } from "./status-text";

export function OrderDetailHead({ order: o }: { order: ConsoleOrder }) {
  return (
    <>
      <p className="print-only">
        <strong>PoliValko</strong> · накладна для комплектування · надруковано {formatDateTime(new Date().toISOString())}
      </p>
      <div className="console-order-head">
        <div className="console-order-head__title">
          <h1 className="console-title">{o.number}</h1>
          <StatusText status={o.status} />
          <PaymentStatusText status={o.paymentStatus} />
          <span className="muted">створено {formatDateTime(o.createdAt)}</span>
        </div>
        <div className="console-head__actions no-print">
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

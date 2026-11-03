"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { CloseIcon } from "@/shared/ui/icons";

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      d.querySelector<HTMLElement>(".modal__body :is(input, select, textarea)")?.focus();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);
  return (
    <dialog ref={dialog} className="modal" aria-labelledby={titleId} onClose={onClose} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal__head">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="modal__close" onClick={onClose} aria-label="Закрити">
          <CloseIcon />
        </button>
      </div>
      <div className="modal__body">{open && children}</div>
    </dialog>
  );
}

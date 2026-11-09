"use client";

import { useId, useRef, useState } from "react";
import { CloseIcon } from "@polivalko/shared/ui/icons";
import { AssistantCharacter } from "./assistant-character";

export function AssistantWidget() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [isOpen, setOpen] = useState(false);
  const id = useId();

  function open() {
    dialog.current?.showModal();
    setOpen(true);
  }

  function close() {
    dialog.current?.close();
    setOpen(false);
  }

  return (
    <>
      <button type="button" className="assistant-launcher" onClick={open} aria-label="Відкрити помічника Полі-Вальку" aria-haspopup="dialog" aria-expanded={isOpen} aria-controls={id}>
        <img src="/mascot/poli-valka-poster.png" width={253} height={450} alt="" />
        <span>Помічник</span>
      </button>
      <dialog
        ref={dialog}
        id={id}
        className="assistant-panel"
        aria-labelledby={`${id}-title`}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
        }}
      >
        <div className="assistant-panel__inner">
          <header className="assistant-panel__header">
            <div>
              <h2 id={`${id}-title`}>Полі-Валька</h2>
              <p>Ваш садовий помічник</p>
            </div>
            <button type="button" className="icon-btn" onClick={close} aria-label="Закрити помічника" autoFocus>
              <CloseIcon />
            </button>
          </header>
          {isOpen && <AssistantCharacter />}
        </div>
      </dialog>
    </>
  );
}

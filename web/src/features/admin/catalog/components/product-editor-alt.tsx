"use client";

import { useState } from "react";

export function ProductEditorAlt({ id, value, onSave, disabled }: { id: string; value: string; onSave: (alt: string) => void; disabled: boolean }) {
  const [text, setText] = useState(value);
  return (
    <div className="field">
      <label htmlFor={`alt-${id}`} className="visually-hidden">
        Опис фото
      </label>
      <input id={`alt-${id}`} value={text} maxLength={300} onChange={(e) => setText(e.target.value)} onBlur={() => text.trim() && text !== value && onSave(text.trim())} disabled={disabled} />
    </div>
  );
}

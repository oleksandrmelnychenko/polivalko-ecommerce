"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { sized, thumb } from "@polivalko/shared/lib/images";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "@polivalko/shared/ui/icons";

type Image = { url: string; alt: string };

const VIEWER_SIZES = "1600px";

function aim(event: PointerEvent<HTMLElement>) {
  const box = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--zoom-x", `${((event.clientX - box.left) / box.width) * 100}%`);
  event.currentTarget.style.setProperty("--zoom-y", `${((event.clientY - box.top) / box.height) * 100}%`);
}

export function PhotoViewer({
  images,
  name,
  index,
  open,
  onIndex,
  onClose,
}: {
  images: Image[];
  name: string;
  index: number;
  open: boolean;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [zoomed, setZoomed] = useState(false);
  const current = images[index];
  const count = images.length;
  const photo = current ? sized(current.url, VIEWER_SIZES, 960) : null;

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const step = (delta: number) => onIndex((index + delta + count) % count);

  const close = () => {
    setZoomed(false);
    onClose();
  };

  function onKey(event: KeyboardEvent<HTMLDialogElement>) {
    if (count < 2) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="viewer"
      aria-label={`Фото товару: ${name}`}
      onClose={close}
      onClick={(event) => event.target === event.currentTarget && close()}
      onKeyDown={onKey}
    >
      <div className="viewer__bar">
        <span className="viewer__count">
          {index + 1} / {count}
        </span>
        <button type="button" className="viewer__close" onClick={close} aria-label="Закрити фото">
          <CloseIcon />
        </button>
      </div>

      <figure
        className="viewer__frame"
        data-zoomed={zoomed || undefined}
        onPointerMove={(event) => {
          if (event.pointerType !== "mouse") return;
          aim(event);
          if (!zoomed) setZoomed(true);
        }}
        onPointerLeave={() => setZoomed(false)}
      >
        {current && photo && <img key={current.url} {...photo} alt={current.alt || name} width={1600} height={1600} decoding="async" />}
      </figure>

      {count > 1 && (
        <>
          <button type="button" className="viewer__arrow viewer__arrow--prev" onClick={() => step(-1)} aria-label="Попереднє фото">
            <ChevronLeftIcon />
          </button>
          <button type="button" className="viewer__arrow viewer__arrow--next" onClick={() => step(1)} aria-label="Наступне фото">
            <ChevronRightIcon />
          </button>
          <ul className="viewer__thumbs" aria-label="Усі фото">
            {images.map((image, i) => (
              <li key={image.url}>
                <button type="button" aria-pressed={i === index} aria-label={`Фото ${i + 1} з ${count}`} onClick={() => onIndex(i)}>
                  <img src={thumb(image.url, 120)} alt="" width={64} height={64} loading="lazy" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </dialog>
  );
}

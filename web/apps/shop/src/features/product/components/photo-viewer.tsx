"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { sized, thumb } from "@polivalko/shared/lib/images";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "@polivalko/shared/ui/icons";
import { GalleryPhoto } from "./gallery-photo";

type Image = { url: string; alt: string };

const VIEWER_SIZES = "1600px";

const limit = (value: number, max: number) => Math.max(-max, Math.min(max, value));
const MAX_SCALE = 5;

function ZoomPhoto({ image, name }: { image: Image; name: string }) {
  const frame = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const [smoothZoom, setSmoothZoom] = useState(false);
  const [ratio, setRatio] = useState(1);
  // Offsets are fractions of the fitted frame, so resize preserves the crop.
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  function zoom(factor: number, anchorX = 0, anchorY = 0) {
    setView(prev => {
      const scale = Math.max(1, Math.min(MAX_SCALE, prev.scale * factor));
      const change = scale / prev.scale;
      const extent = (scale - 1) / 2;
      return { scale, x: limit(anchorX + (prev.x - anchorX) * change, extent), y: limit(anchorY + (prev.y - anchorY) * change, extent) };
    });
  }
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      setSmoothZoom(false);
      const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? box.height : 1;
      zoom(Math.exp(limit(-event.deltaY * unit * .002, 1)), (event.clientX - box.left) / box.width - .5, (event.clientY - box.top) / box.height - .5);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div className="viewer__photo" style={{ "--photo-ratio": ratio } as CSSProperties}>
      <div className="viewer__zoom" role="group" aria-label="Масштаб фото">
        <button type="button" aria-label="Зменшити фото" disabled={view.scale <= 1} onClick={() => zoom(1 / 1.25)}>−</button>
        <span>{Math.round(view.scale * 100)}%</span>
        <button type="button" aria-label="Збільшити фото" disabled={view.scale >= MAX_SCALE} onClick={() => zoom(1.25)}>+</button>
      </div>
      <button type="button" ref={frame} className="viewer__frame" data-zoomed={view.scale > 1 || undefined} data-smooth-zoom={smoothZoom || undefined}
        aria-label={view.scale > 1 ? "Повернути фото до 100%" : "Наблизити фото до 200%"}
        onClick={event => {
          if (event.detail && dragged.current) return;
          setSmoothZoom(true);
          if (view.scale > 1) {
            setView({ scale: 1, x: 0, y: 0 });
            return;
          }
          const box = event.currentTarget.getBoundingClientRect();
          const x = event.detail ? (event.clientX - box.left) / box.width - .5 : 0;
          const y = event.detail ? (event.clientY - box.top) / box.height - .5 : 0;
          zoom(2, x, y);
        }}
        onPointerDown={event => {
          if (!event.isPrimary || event.button !== 0) return;
          dragged.current = false;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        }}
        onLostPointerCapture={() => { drag.current = null; }}
        onPointerMove={event => {
          const last = drag.current;
          if (!last || last.id !== event.pointerId) return;
          if (!dragged.current && Math.hypot(event.clientX - last.x, event.clientY - last.y) < 4) return;
          dragged.current = true;
          if (view.scale <= 1) return;
          setSmoothZoom(false);
          const box = event.currentTarget.getBoundingClientRect();
          const dx = (event.clientX - last.x) / box.width;
          const dy = (event.clientY - last.y) / box.height;
          drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
          setView(prev => ({ ...prev, x: limit(prev.x + dx, (prev.scale - 1) / 2), y: limit(prev.y + dy, (prev.scale - 1) / 2) }));
        }}>
        <GalleryPhoto {...sized(image.url, VIEWER_SIZES, 960)} alt={image.alt || name} draggable={false}
          onLoad={({ currentTarget }) => {
            setRatio(currentTarget.naturalWidth / currentTarget.naturalHeight);
            setSmoothZoom(false);
            setView({ scale: 1, x: 0, y: 0 });
            drag.current = null;
          }}
          style={{ transform: `translate(${view.x * 100}%, ${view.y * 100}%) scale(${view.scale})` }} />
      </button>
    </div>
  );
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
  onIndex: (index: number, step?: number) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const current = images[index];
  const count = images.length;

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const step = (delta: number) => onIndex((index + delta + count) % count, delta);

  const close = () => {
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

      <div className="viewer__stage" onClick={event => event.target === event.currentTarget && close()}>
        {open && current && <ZoomPhoto image={current} name={name} />}
      </div>

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

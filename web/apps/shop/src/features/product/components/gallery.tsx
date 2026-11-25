"use client";

import { useState, type ReactNode } from "react";
import { sized, thumb } from "@/shared/lib/images";
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "@polivalko/shared/ui/icons";
import { PhotoViewer } from "./photo-viewer";
import { GalleryPhoto } from "./gallery-photo";

type Image = { url: string; alt: string };

const GALLERY_SIZES = "(max-width: 64rem) 100vw, 48vw";

export function Gallery({ images, name, labels }: { images: Image[]; name: string; labels: ReactNode }) {
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState(1);
  const [viewing, setViewing] = useState(false);
  const current = images[active];
  const main = current ? sized(current.url, GALLERY_SIZES, 960) : null;
  function select(index: number, step = index - active) {
    if (index === active) return;
    setDirection(Math.sign(step));
    setActive(index);
  }

  return (
    <div className="gallery" data-backward={direction < 0 || undefined}>
      <figure className="gallery__main">
        {current && main ? (
          <button type="button" className="gallery__open" onClick={() => setViewing(true)} aria-label={`Відкрити фото: ${current.alt || name}`}>
            <GalleryPhoto {...main} alt={current.alt || name} width={960} height={960} fetchPriority="high" decoding="async" />
            <span className="gallery__hint" aria-hidden="true">
              <SearchIcon />
              <span>Збільшити</span>
            </span>
          </button>
        ) : (
          <span className="tile__photo-empty">Фото відсутнє</span>
        )}
        {labels}
        {images.length > 1 && <>
          <button type="button" className="gallery__arrow gallery__arrow--prev" aria-label="Попереднє фото" onClick={() => select((active + images.length - 1) % images.length, -1)}><ChevronLeftIcon /></button>
          <button type="button" className="gallery__arrow gallery__arrow--next" aria-label="Наступне фото" onClick={() => select((active + 1) % images.length, 1)}><ChevronRightIcon /></button>
        </>}
      </figure>
      {images.length > 1 && (
        <ul className="gallery__thumbs" aria-label="Фото товару">
          {images.map((image, i) => (
            <li key={image.url}>
              <button type="button" aria-pressed={i === active} aria-label={`Фото ${i + 1} з ${images.length}`} onClick={() => select(i)}>
                <img src={thumb(image.url, 120)} alt="" width={72} height={72} loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {current && <PhotoViewer images={images} name={name} index={active} open={viewing} onIndex={select} onClose={() => setViewing(false)} />}
    </div>
  );
}

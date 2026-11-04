"use client";

import { useState } from "react";
import { sized, thumb } from "@polivalko/shared/lib/images";

type Image = { url: string; alt: string };

const GALLERY_SIZES = "(max-width: 40rem) 250px, (max-width: 60rem) 92vw, 640px";

export function Gallery({ images, name }: { images: Image[]; name: string }) {
  const [active, setActive] = useState(0);
  const current = images[active];
  const main = current ? sized(current.url, GALLERY_SIZES, 960) : null;

  return (
    <div className="gallery">
      <figure className="gallery__main">
        {current && main ? (
          <img key={current.url} {...main} alt={current.alt || name} width={960} height={960} fetchPriority="high" decoding="async" />
        ) : (
          <span className="tile__photo-empty">Фото додасть магазин</span>
        )}
      </figure>
      {images.length > 1 && (
        <ul className="gallery__thumbs" aria-label="Фото товару">
          {images.map((image, i) => (
            <li key={image.url}>
              <button type="button" aria-pressed={i === active} aria-label={`Фото ${i + 1} з ${images.length}`} onClick={() => setActive(i)}>
                <img src={thumb(image.url, 120)} alt="" width={72} height={72} loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

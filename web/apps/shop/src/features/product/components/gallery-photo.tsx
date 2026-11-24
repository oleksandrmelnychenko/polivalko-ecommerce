"use client";

import { useCallback, useState, type ComponentPropsWithoutRef } from "react";

type PhotoProps = ComponentPropsWithoutRef<"img"> & { src: string; alt: string };

export function GalleryPhoto({ src, alt, onLoad, style, ...props }: PhotoProps) {
  const [loaded, setLoaded] = useState({ src: "", url: "", previous: "" });
  const remember = useCallback((img: HTMLImageElement | null) => {
    // The server-rendered first photo can finish loading before hydration.
    if (!img?.complete || !img.naturalWidth) return;
    const url = img.currentSrc;
    setLoaded(last => last.src === src && last.url === url ? last : {
      src, url, previous: last.src === src ? last.previous : last.url,
    });
  }, [src]);
  const pending = loaded.src !== src;
  const underneath = pending ? loaded.url : loaded.previous;

  return (
    <>
      <img key={src} ref={remember} {...props} src={src} alt={alt} style={style} data-slide-in={(!pending && Boolean(loaded.previous)) || undefined} onLoad={event => {
        remember(event.currentTarget);
        onLoad?.(event);
      }} />
      {underneath && <img key={`previous-${underneath}`} src={underneath} alt="" aria-hidden="true" draggable={false}
        style={style} className="gallery-photo__previous" data-slide-out={!pending || undefined}
        onAnimationEnd={() => setLoaded(last => last.previous === underneath ? { ...last, previous: "" } : last)} />}
    </>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon, ExternalIcon } from "@polivalko/shared/ui/icons";
import type { HeroFeatured, HeroSlide } from "../lib/hero-slides";
import { HeroPhoto } from "./hero-photo";
import { categoryPhotos } from "@polivalko/shared/lib/stand-in-photos";

const AUTOPLAY_MS = 9000;
const QUICK_CATEGORIES = [
  { slug: "vse-dlia-polyvu", label: "Для поливу" },
  { slug: "vse-dlia-roslyn", label: "Для рослин" },
  { slug: "ruchnyi-instrument", label: "Інструменти" },
];

export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [moved, setMoved] = useState(false);
  const [paused, setPaused] = useState(false);
  const [loadRest, setLoadRest] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const count = slides.length;

  useEffect(() => {
    const timer = setTimeout(() => setLoadRest(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (paused || count < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches || matchMedia("(max-width: 63.999rem)").matches) return;
    const timer = setTimeout(() => {
      setMoved(true);
      setIndex((i) => (i + 1) % count);
    }, AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [index, paused, count]);

  const selectSlide = (next: number) => {
    setMoved(true);
    setIndex(next);
  };

  const go = (step: number) => {
    setMoved(true);
    setIndex((i) => (i + step + count) % count);
  };

  function updateMobileSlide(rail: HTMLDivElement) {
    const [first, second] = rail.querySelectorAll<HTMLElement>(".hero-slide");
    if (!second) return;
    setLoadRest(true);
    const step = second.offsetLeft - first.offsetLeft;
    if (step > 0) setIndex(Math.max(0, Math.min(count - 1, Math.round(rail.scrollLeft / step))));
  }

  return (
    <section
      className="hero"
      data-animated={moved || undefined}
      aria-roledescription="карусель"
      aria-label="Головні пропозиції"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* Single responsive slide track: emits strictly one <h1> in SSR HTML, visible on both desktop and mobile. */}
      <div
        ref={trackRef}
        className="hero-track"
        onScroll={(event) => updateMobileSlide(event.currentTarget)}
      >
        {slides.map((slide, i) => {
          const active = i === index;
          return (
            <div
              key={slide.key}
              className={`hero-slide${i > 0 ? " hero-slide--collection" : ""}${active ? " is-active" : ""}`}
              role="group"
              aria-roledescription="слайд"
              aria-label={`${i + 1} з ${count}`}
            >
              <div className="hero-slide__panel">
                {i === 0 ? (
                  <h1 className="hero-panel__title">
                    {slide.title}
                    {slide.kicker && !slide.featured && <span className="hero-panel__kicker">{slide.kicker}</span>}
                  </h1>
                ) : (
                  <h2 className="hero-panel__title">
                    {slide.title}
                    {slide.kicker && !slide.featured && <span className="hero-panel__kicker">{slide.kicker}</span>}
                  </h2>
                )}
                {(slide.sub || slide.kicker) && <p className="hero-panel__sub">{slide.sub || slide.kicker}</p>}
                <div className="hero-panel__actions">
                  {slide.cta && (
                    <Link href={slide.cta.href} className="hero-panel__btn">
                      {slide.cta.label}
                      <ArrowRightIcon />
                    </Link>
                  )}
                  <Link href="/contacts" className="hero-panel__link">
                    Наш магазин
                    <ExternalIcon />
                  </Link>
                </div>
                <HeroShortcuts slide={slide} />
              </div>
              <div className="hero-slide__media">
                {(i === 0 || loadRest || active) && <HeroPhoto slide={slide} first={i === 0} />}
                {slide.featured && <HeroChip product={slide.featured} label={slide.kicker} />}
                {count > 1 && <>
                  <button type="button" className="hero__arrow hero__arrow--prev" onClick={() => go(-1)} aria-label="Попередній слайд">
                    <ChevronLeftIcon />
                  </button>
                  <button type="button" className="hero__arrow hero__arrow--next" onClick={() => go(1)} aria-label="Наступний слайд">
                    <ChevronRightIcon />
                  </button>
                </>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="hero-mobile">
        {count > 1 && (
          <div className="hero-mobile__dots" aria-label="Слайди">
            {slides.map((slide, i) => (
              <button
                key={slide.key}
                type="button"
                aria-label={`Слайд ${i + 1}`}
                aria-pressed={i === index}
                onClick={() => {
                  setIndex(i);
                  trackRef.current?.children[i]?.scrollIntoView({
                    block: "nearest",
                    inline: "start",
                    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
                  });
                }}
              />
            ))}
          </div>
        )}
        {slides[index] && <HeroShortcuts slide={slides[index]} />}
      </div>
      {count > 1 && (
        <div className="hero-pagination" aria-label="Обрати слайд">
          {slides.map((slide, i) => <button key={slide.key} type="button" aria-label={`Показати слайд ${i + 1}`} aria-pressed={i === index} onClick={() => selectSlide(i)} />)}
        </div>
      )}
    </section>
  );
}

function HeroShortcuts({ slide }: { slide: HeroSlide }) {
  if (!slide.subsections && slide.cta?.href !== "/catalog" && !slide.featured) return null;
  const items = slide.subsections?.items.slice(0, 3) ?? QUICK_CATEGORIES.map(({ slug, label }) => ({
    href: `/catalog/${slug}`, image: categoryPhotos[slug].url, name: label,
  }));
  return <nav className="hero-shortcuts" aria-label={slide.subsections ? "Категорії колекції" : "Популярні категорії"}>
    {items.map(item => <Link key={item.href} href={item.href}>
      {item.image && <img src={item.image} alt="" aria-hidden="true" width={48} height={48} loading="lazy" decoding="async" />}
      <span>{item.name}</span>
    </Link>)}
  </nav>;
}

function HeroChip({ product, label }: { product: HeroFeatured; label?: string }) {
  return (
    <Link href={product.href} className="hero-chip">
      <span className="hero-chip__photo">{product.image && <img src={product.image} alt={product.name} width={44} height={44} loading="lazy" decoding="async" />}</span>
      <span className="hero-chip__text">
        {(label || product.note === "З нашого каталогу") && <span className="hero-chip__label">{label || product.note}</span>}
        <span className="hero-chip__name">{product.name}</span>
        <span className="hero-chip__price money">{product.price}</span>
      </span>
      <span className="hero-chip__go" aria-hidden="true">
        <ArrowRightIcon />
      </span>
    </Link>
  );
}

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
  const [paused, setPaused] = useState(false);
  const [loadRest, setLoadRest] = useState(false);
  const mobileRail = useRef<HTMLUListElement>(null);
  const [mobileIndex, setMobileIndex] = useState(0);
  const count = slides.length;

  useEffect(() => {
    const timer = setTimeout(() => setLoadRest(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (paused || count < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [index, paused, count]);

  const go = (step: number) => setIndex((i) => (i + step + count) % count);

  return (
    <section
      className="hero"
      aria-roledescription="карусель"
      aria-label="Головні пропозиції"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="hero-mobile">
        <ul ref={mobileRail} aria-label="Колекції" className="hero-mobile__slides" onScroll={(event) => setMobileIndex(Math.round(event.currentTarget.scrollLeft / (event.currentTarget.clientWidth + 12)))}>
          {slides.map((slide, i) => <li key={slide.key} className="hero-mobile__slide">
            <div className="hero-mobile__content">
              {i === 0 ? <h1>{slide.title}</h1> : <h2>{slide.title}</h2>}
              {slide.kicker && <p>{slide.kicker}</p>}
              {slide.cta && <Link href={slide.cta.href} className="hero-panel__btn">{slide.cta.label}<ArrowRightIcon /></Link>}
            </div>
            <div className="hero-mobile__photo"><HeroPhoto slide={slide} first={i === 0} /></div>
          </li>)}
        </ul>
        {count > 1 && <div className="hero-mobile__dots" aria-label="Слайди">{slides.map((slide, i) => <button key={slide.key} type="button" aria-label={`Слайд ${i + 1}`} aria-pressed={i === mobileIndex} onClick={() => mobileRail.current?.children[i]?.scrollIntoView({ block: "nearest", inline: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })} />)}</div>}
      </div>
      {slides.map((slide, i) => {
        const active = i === index;
        const Title = i === 0 ? "h1" : "p";
        return (
          <div
            key={slide.key}
            className={`hero-slide${i > 0 ? " hero-slide--collection" : ""}${active ? " is-active" : ""}`}
            role="group"
            aria-roledescription="слайд"
            aria-label={`${i + 1} з ${count}`}
            aria-hidden={!active}
            inert={!active}
          >
            <div className="hero-slide__panel">
              <Title className="hero-panel__title">
                {slide.title}
                {slide.kicker && !slide.featured && <span className="hero-panel__kicker">{slide.kicker}</span>}
              </Title>
              {slide.sub && <p className="hero-panel__sub">{slide.sub}</p>}
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
              {slide.subsections ? <nav className="hero-shortcuts" aria-label="Категорії колекції">
                {slide.subsections.items.slice(0, 3).map(item => <Link key={item.id} href={item.href}>
                  {item.image && <img src={item.image} alt="" width={48} height={48} />}
                  <span>{item.name}</span><ArrowRightIcon />
                </Link>)}
              </nav> : (slide.cta?.href === "/catalog" || slide.featured) && <nav className="hero-shortcuts" aria-label="Популярні категорії">
                {QUICK_CATEGORIES.map(({ slug, label }) => <Link key={slug} href={`/catalog/${slug}`}>
                  <img src={categoryPhotos[slug].url.replace("w=1200", "w=120")} alt="" width={48} height={48} />
                  <span>{label}</span><ArrowRightIcon />
                </Link>)}
              </nav>}
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
      {count > 1 && (
        <>
          <div className="hero-pagination" aria-label="Обрати слайд">
            {slides.map((slide, i) => <button key={slide.key} type="button" aria-label={`Показати слайд ${i + 1}`} aria-pressed={i === index} onClick={() => setIndex(i)} />)}
          </div>
        </>
      )}
    </section>
  );
}

function HeroChip({ product, label }: { product: HeroFeatured; label?: string }) {
  return (
    <Link href={product.href} className="hero-chip">
      <span className="hero-chip__photo">{product.image && <img src={product.image} alt="" width={44} height={44} loading="lazy" decoding="async" />}</span>
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

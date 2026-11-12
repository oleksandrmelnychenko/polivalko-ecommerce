"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@polivalko/shared/ui/icons";
import type { HeroDeals, HeroFeatured, HeroSections, HeroSlide, HeroSubsections } from "../lib/hero-slides";
import { HeroPhoto } from "./hero-photo";

const AUTOPLAY_MS = 9000;

export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [loadRest, setLoadRest] = useState(false);
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
      {slides.map((slide, i) => {
        const active = i === index;
        return (
          <div
            key={slide.key}
            className={`hero-slide hero-slide--${slide.side}${active ? " is-active" : ""}`}
            role="group"
            aria-roledescription="слайд"
            aria-label={`${i + 1} з ${count}`}
            aria-hidden={!active}
            inert={!active}
          >
            {(i === 0 || loadRest || active) && <HeroPhoto slide={slide} first={i === 0} />}
            <div className="hero-slide__panel">
              {slide.kicker && <p className="hero-panel__kicker">{slide.kicker}</p>}
              {i === 0 ? <h1 className="hero-panel__title">{slide.title}</h1> : <p className="hero-panel__title">{slide.title}</p>}
              {slide.sub && <p className="hero-panel__sub">{slide.sub}</p>}
              {slide.deals && <HeroDealList deals={slide.deals} />}
              {slide.sections && <HeroSectionList sections={slide.sections} />}
              {slide.subsections && <HeroSubsectionList subsections={slide.subsections} />}
              {slide.featured && <HeroFeaturedProduct product={slide.featured} />}
              {slide.cta && (
                <Link href={slide.cta.href} className="hero-panel__btn">
                  {slide.cta.label}
                </Link>
              )}
            </div>
          </div>
        );
      })}
      {count > 1 && (
        <>
          <button type="button" className="hero__arrow hero__arrow--prev" onClick={() => go(-1)} aria-label="Попередній слайд">
            <ChevronLeftIcon />
          </button>
          <button type="button" className="hero__arrow hero__arrow--next" onClick={() => go(1)} aria-label="Наступний слайд">
            <ChevronRightIcon />
          </button>
        </>
      )}
    </section>
  );
}

function HeroDealList({ deals }: { deals: HeroDeals }) {
  return (
    <ul className="hero-deals">
      {deals.items.map((deal) => (
        <li key={deal.id}>
          <Link href={deal.href} className="hero-deal">
            <span className="hero-deal__photo">
              {deal.image && <img src={deal.image} alt="" width={60} height={60} loading="lazy" decoding="async" />}
              <span className="hero-deal__off">−{deal.percent}%</span>
            </span>
            <span className="hero-deal__name">{deal.name}</span>
            <span className="hero-deal__price">
              <strong>
                <span className="visually-hidden">Нова ціна </span>
                <span className="money">{deal.price}</span>
              </strong>
              <s>
                <span className="visually-hidden">Стара ціна </span>
                <span className="money">{deal.oldPrice}</span>
              </s>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function HeroSectionList({ sections }: { sections: HeroSections }) {
  return (
    <div className="hero-cats">
      {sections.line && <p className="hero-cats__head">{sections.line}</p>}
      <ul className="hero-cats__list">
        {sections.items.map((section) => (
          <li key={section.id}>
            <Link href={section.href} className="hero-cat">
              <span className="hero-cat__photo">{section.image && <img src={section.image} alt="" width={44} height={44} loading="lazy" decoding="async" />}</span>
              <span className="hero-cat__name">{section.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HeroFeaturedProduct({ product }: { product: HeroFeatured }) {
  return (
    <div className="hero-feature">
      <Link href={product.href} className="hero-feature__photo" tabIndex={-1} aria-hidden="true">
        {product.image && <img src={product.image} alt="" width={168} height={168} loading="lazy" decoding="async" />}
        {product.percent && <span className="hero-deal__off">−{product.percent}%</span>}
      </Link>
      <div className="hero-feature__body">
        {product.brand && (
          <p className="hero-feature__brand" translate="no">
            {product.brand}
          </p>
        )}
        <Link href={product.href} className="hero-feature__name">
          {product.name}
        </Link>
        <p className="hero-feature__price">
          <strong className={product.oldPrice ? "is-sale" : undefined}>
            {product.oldPrice && <span className="visually-hidden">Нова ціна </span>}
            <span className="money">{product.price}</span>
          </strong>
          {product.oldPrice && (
            <s>
              <span className="visually-hidden">Стара ціна </span>
              <span className="money">{product.oldPrice}</span>
            </s>
          )}
        </p>
        {product.note && <p className="hero-feature__note">{product.note}</p>}
      </div>
    </div>
  );
}

function HeroSubsectionList({ subsections }: { subsections: HeroSubsections }) {
  return (
    <div className="hero-cats">
      {subsections.line && <p className="hero-cats__head">{subsections.line}</p>}
      <ul className="hero-deals hero-subs">
        {subsections.items.map((item) => (
          <li key={item.id}>
            <Link href={item.href} className="hero-deal">
              <span className="hero-deal__photo">{item.image && <img src={item.image} alt="" width={60} height={60} loading="lazy" decoding="async" />}</span>
              <span className="hero-sub__text">
                <span className="hero-sub__name">{item.name}</span>
                <span className="hero-sub__count">{item.count}</span>
              </span>
              {item.from && <span className="hero-sub__from money">{item.from}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

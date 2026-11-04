"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@polivalko/shared/ui/icons";
import type { HeroSlide } from "../lib/hero-slides";
import { HeroArc } from "./hero-arc";

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
            key={slide.title}
            className={`hero-slide hero-slide--${slide.kind}${active ? " is-active" : ""}`}
            role="group"
            aria-roledescription="слайд"
            aria-label={`${i + 1} з ${count}`}
            aria-hidden={!active}
            inert={!active}
          >
            {(i === 0 || loadRest || active) && (
              <img {...slide.image} alt={slide.image.alt} width={1600} height={1067} className="hero-slide__photo" fetchPriority={i === 0 ? "high" : "low"} decoding="async" />
            )}
            {slide.kind === "band" ? (
              <div className="hero-slide__inner">
                <HeroArc text={slide.kicker} />
                {i === 0 ? (
                  <h1 className="hero__title">
                    <span>{slide.title}</span>
                  </h1>
                ) : (
                  <p className="hero__title">
                    <span>{slide.title}</span>
                  </p>
                )}
                {slide.sub && <p className="hero__sub">{slide.sub}</p>}
                <Link href={slide.cta.href} className="hero__btn">
                  {slide.cta.label}
                </Link>
              </div>
            ) : (
              <div className="hero-slide__panel">
                <p className="hero-panel__kicker">{slide.kicker}</p>
                <p className="hero-panel__title">{slide.title}</p>
                {slide.sub && <p className="hero-panel__sub">{slide.sub}</p>}
                <Link href={slide.cta.href} className="hero-panel__btn">
                  {slide.cta.label}
                </Link>
              </div>
            )}
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

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Sized } from "@/lib/images";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

export type HeroSlide = {
  image: Sized & { alt: string };
  /** «band» — заголовок на зеленій смузі по центру; «panel» — біла панель праворуч. */
  kind: "band" | "panel";
  kicker: string;
  title: string;
  sub?: string;
  cta: { href: string; label: string };
};

const AUTOPLAY_MS = 9000;

/**
 * Перший екран як слайдер референсу (Slider Revolution у темі Sofani): два слайди зі зміною через згасання
 * (0,6 с), круглі стрілки по краях, автопрокрутка кожні 9 с з паузою під курсором і фокусом.
 * Шари активного слайда з'являються по черзі — смуга зліва, заголовок справа, напис зверху, кнопка знизу;
 * таймінги взято з налаштувань слайдера референсу. За зменшеного руху автопрокрутки й анімацій немає.
 */
export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Фото наступних слайдів вантажимо після першого екрана, щоб не відбирати канал у головного фото.
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

/** Напис дугою з крапками по краях і трьома зірочками під ним — як у референсі. */
function HeroArc({ text }: { text: string }) {
  return (
    <svg className="hero__arc" viewBox="0 0 300 92" aria-hidden="true">
      <g className="hero__arc-text">
        <path id="hero-arc-path" d="M 40 80 A 125 125 0 0 1 260 80" fill="none" />
        <text>
          <textPath href="#hero-arc-path" startOffset="50%" textAnchor="middle">
            {text}
          </textPath>
        </text>
        <circle cx="26" cy="86" r="2.2" fill="currentColor" />
        <circle cx="274" cy="86" r="2.2" fill="currentColor" />
      </g>
      <g className="hero__arc-stars" fill="currentColor">
        <path d="M118 66l2.2 4.5 5 .7-3.6 3.5.8 5-4.4-2.4-4.4 2.4.8-5-3.6-3.5 5-.7z" />
        <path d="M150 58l3.2 6.5 7.2 1-5.2 5.1 1.2 7.1-6.4-3.4-6.4 3.4 1.2-7.1-5.2-5.1 7.2-1z" />
        <path d="M182 66l2.2 4.5 5 .7-3.6 3.5.8 5-4.4-2.4-4.4 2.4.8-5-3.6-3.5 5-.7z" />
      </g>
    </svg>
  );
}

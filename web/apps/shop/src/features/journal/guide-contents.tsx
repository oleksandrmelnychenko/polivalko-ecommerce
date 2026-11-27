"use client";

import { useEffect, useState } from "react";

type Chapter = { id: string; title: string };

export function GuideContents({ chapters }: { chapters: Chapter[] }) {
  const [current, setCurrent] = useState(chapters[0]?.id);

  useEffect(() => {
    const sections = chapters.map(({ id }) => document.getElementById(id)).filter((section) => section !== null);
    if (!sections.length) return;

    const update = () => {
      const headerOffset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      const readingLine = headerOffset + parseFloat(getComputedStyle(sections[0]).scrollMarginTop) + 2;
      let active = sections[0];
      for (const section of sections) {
        if (section.getBoundingClientRect().top > readingLine) break;
        active = section;
      }
      setCurrent(active.id);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [chapters]);

  return (
    <nav className="field-guide__contents" aria-labelledby="guide-contents-heading">
      <h2 id="guide-contents-heading">Зміст статті</h2>
      <ul>
        {chapters.map(({ id, title }) => (
          <li key={id}>
            <a href={`#${id}`} aria-current={current === id ? "location" : undefined}>{title}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRightIcon, ChevronDownIcon, SearchIcon } from "@polivalko/shared/ui/icons";
import { GuideCover } from "./guide-cover";
import type { Article } from "./articles";

type Story = Pick<Article, "slug" | "title" | "category" | "intro" | "readingMinutes" | "image">;

function searchable(text: string) {
  return text.toLocaleLowerCase("uk").replace(/[’ʼ]/g, "'");
}

export function BlogIndex({ items }: { items: Story[] }) {
  const [topic, setTopic] = useState("");
  const [query, setQuery] = useState("");
  const topics = Array.from(new Set(items.map((story) => story.category)));
  const term = searchable(query.trim());
  const visible = items.filter((story) => (!topic || story.category === topic) &&
    searchable([story.title, story.category, story.intro].join(" ")).includes(term));
  const filtered = Boolean(term || topic);

  return (
    <>
      <header className="guide-head">
        <h1>Практикуми <span>для саду й городу</span></h1>
        <dl>
          <div><dt>Матеріалів</dt><dd>{items.length}</dd></div>
          <div><dt>Рубрик</dt><dd>{topics.length}</dd></div>
        </dl>
      </header>
      <section className="guide-library" aria-label="Статті блогу">
        <div className="guide-tools">
          <label className="guide-search">
            <SearchIcon />
            <input aria-label="Пошук у блозі" type="search" placeholder="Пошук у блозі" value={query}
              onChange={(event) => setQuery(event.target.value)} />
          </label>
          <label className="guide-select">
            <select aria-label="Рубрика" value={topic} onChange={(event) => setTopic(event.target.value)}>
              <option value="">Усі рубрики</option>
              {topics.map((category) => <option key={category}>{category}</option>)}
            </select>
            <ChevronDownIcon />
          </label>
          <span className="guide-count" role="status">Показано {visible.length} з {items.length}</span>
          {filtered && <button type="button" onClick={() => { setTopic(""); setQuery(""); }}>Скинути</button>}
        </div>
        {visible.length ? (
          <ul className="guide-list">
            {visible.map((story) => (
              <li key={story.slug}>
                <Link href={`/blog/${story.slug}`} className="guide" aria-labelledby={story.slug}>
                  <GuideCover story={story} />
                  <div className="guide-body">
                    <span className="guide-topic">{story.category}</span>
                    <h2 id={story.slug}>{story.title}</h2>
                    <p>{story.intro}</p>
                    <div className="guide-foot"><span>{story.readingMinutes} хв читання</span><span>Читати <ArrowRightIcon /></span></div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="guide-empty">Статей за цим запитом немає. Спробуйте інше слово або рубрику.</p>}
      </section>
    </>
  );
}

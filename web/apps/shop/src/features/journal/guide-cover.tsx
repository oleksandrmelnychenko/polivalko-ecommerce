import { sized } from "@/shared/lib/images";
import type { Article } from "./articles";

export function GuideCover({ story, priority = false }: { story: Pick<Article, "slug" | "image">; priority?: boolean }) {
  if (story.slug === "krapelnyi-polyv-svoimy-rukamy") {
    return (
      <div className="guide-cover guide-cover--drip" role="img" aria-label="Схема крапельної стрічки з кроком крапельниць 10, 20 і 30 сантиметрів">
        <div className="guide-drawing">
          <span className="guide-caption">Крок крапельниць</span>
          <div className="guide-lines">
            {[10, 20, 30].map((step) => (
              <div key={step} className="guide-line"><i /><span>{step} см</span></div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (story.slug === "yak-obraty-shlanh-dlia-polyvu") {
    return (
      <div className="guide-cover guide-cover--hose" role="img" aria-label="Порівняння трьох внутрішніх діаметрів садового шланга">
        <div className="guide-drawing">
          <span className="guide-caption">Внутрішній діаметр</span>
          <div className="guide-bores">
            {["½″", "⅝″", "¾″"].map((diameter) => (
              <div key={diameter}><i /><span>{diameter}</span></div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="guide-cover guide-cover--photo">
      <img {...sized(story.image.url, "(max-width: 44rem) 95vw, 48vw", 960)}
        alt={priority ? story.image.alt : ""} width={800} height={400} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} />
    </div>
  );
}

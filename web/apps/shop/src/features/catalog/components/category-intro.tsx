import { introParagraphs } from "../lib/category-intro";

export function CategoryIntro({ description }: { description?: string | null }) {
  const paragraphs = introParagraphs(description);
  if (paragraphs.length === 0) return null;
  return (
    <div className="category-intro">
      {paragraphs.map((text, i) => (
        <p key={i}>{text}</p>
      ))}
    </div>
  );
}

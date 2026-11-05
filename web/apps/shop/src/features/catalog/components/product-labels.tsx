import type { ProductLabel } from "../lib/labels";

export function ProductLabels({ labels, className }: { labels: ProductLabel[]; className?: string }) {
  if (labels.length === 0) return null;
  return (
    <span className={className ? `labels ${className}` : "labels"}>
      {labels.map((label) => (
        <span key={label.name} className="label" data-tone={label.tone}>
          {label.name}
        </span>
      ))}
    </span>
  );
}

export function Heading({ id, title, sub, side }: { id: string; title: string; sub: string; side?: "left" | "right" }) {
  return (
    <div className={side ? `heading heading--side heading--${side}` : "heading"}>
      <h2 id={id}>{title}</h2>
      <p>{sub}</p>
      {!side && <span className="heading__rule" aria-hidden="true" />}
    </div>
  );
}

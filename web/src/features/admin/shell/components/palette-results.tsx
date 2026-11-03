import type { PaletteGroup, PaletteItem } from "../lib/palette-items";

export function PaletteResults({
  groups,
  active,
  term,
  searching,
  empty,
  onActive,
  onPick,
}: {
  groups: PaletteGroup[];
  active: number;
  term: string;
  searching: boolean;
  empty: boolean;
  onActive: (index: number) => void;
  onPick: (item: PaletteItem) => void;
}) {
  const offsets = groups.map((_, gi) => groups.slice(0, gi).reduce((n, g) => n + g.items.length, 0));
  return (
    <div className="palette__body" id="palette-list" role="listbox" aria-label="Результати">
      {groups.map((g, gi) => (
        <div key={g.title} className="palette__group" role="group" aria-label={g.title}>
          <p className="palette__title" aria-hidden="true">
            {g.title}
          </p>
          {g.items.map((item, j) => {
            const i = offsets[gi] + j;
            return (
              <div
                key={item.key}
                id={`palette-${item.key}`}
                className="palette__item"
                role="option"
                aria-selected={i === active}
                onPointerMove={() => onActive(i)}
                onClick={() => onPick(item)}
              >
                {item.image ? <img src={item.image} alt="" /> : <span className="palette__icon">{item.icon}</span>}
                <span className="palette__main">
                  <strong>{item.title}</strong>
                  <span>{item.sub}</span>
                </span>
                {item.side && <span className="palette__side">{item.side}</span>}
              </div>
            );
          })}
        </div>
      ))}
      {term.length >= 2 && !searching && empty && <p className="palette__empty">Нічого не знайдено за «{term}».</p>}
      {searching && <p className="palette__empty">Шукаємо…</p>}
    </div>
  );
}

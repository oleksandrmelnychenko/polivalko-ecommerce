"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { components } from "@/lib/api/schema";
import { formatPrice } from "@/lib/format";

type Day = components["schemas"]["DashboardDayDto"];
export type Metric = "revenue" | "orders";

const HEIGHT = 260;
const PAD = { top: 28, right: 8, bottom: 30, left: 56 };

const compact = new Intl.NumberFormat("uk-UA", { notation: "compact", maximumFractionDigits: 1 });
const shortDate = new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "short", timeZone: "Europe/Kyiv" });
const longDate = new Intl.DateTimeFormat("uk-UA", { weekday: "short", day: "numeric", month: "long", timeZone: "Europe/Kyiv" });
const asDate = (d: string) => new Date(`${d}T12:00:00+03:00`);

/** «Гарна» верхня межа шкали: 1, 2, 2.5 або 5 × 10ⁿ, щоб поділки були круглими. */
function niceMax(value: number) {
  if (value <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(value));
  return ([1, 2, 2.5, 5, 10].find((m) => m * pow >= value) ?? 10) * pow;
}

/** Стовпчик зі скругленим верхом 4 px і прямим низом на базовій лінії. */
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * Виручка або кількість замовлень по днях: одна серія стовпчиками, одна шкала. Наведення чи стрілки на клавіатурі
 * показують обидва значення дня; той самий ряд є таблицею під графіком.
 */
export function RevenueChart({ days, metric }: { days: Day[]; metric: Metric }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const [active, setActive] = useState<number | null>(null);
  const value = (d: Day) => (metric === "revenue" ? Number(d.revenue.value) : d.orders);
  const values = days.map(value);
  const peak = Math.max(...values, 0);
  const top = niceMax(peak);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * top);

  const plotW = Math.max(width - PAD.left - PAD.right, 0);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const band = days.length ? plotW / days.length : 0;
  const barW = Math.max(Math.min(24, band - 2, band * 0.72), 1.5);
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const labelEvery = Math.ceil(days.length / Math.max(Math.floor(plotW / 64), 1));
  const peakIndex = peak > 0 ? values.lastIndexOf(peak) : -1;
  const format = (v: number) => (metric === "revenue" ? formatPrice(v) : v.toLocaleString("uk-UA"));
  const tick = (v: number) => (metric === "revenue" ? (v === 0 ? "0" : compact.format(v)) : Number.isInteger(v) ? String(v) : "");

  function onKey(e: KeyboardEvent) {
    if (!days.length) return;
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setActive(e.key === "Home" ? 0 : days.length - 1);
    } else if (step) {
      e.preventDefault();
      setActive((a) => Math.min(Math.max((a ?? days.length - 1) + step, 0), days.length - 1));
    }
  }

  const current = active !== null ? days[active] : null;
  const total = values.reduce((s, v) => s + v, 0);

  return (
    <div className="chart" ref={box}>
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="group"
          tabIndex={0}
          aria-label={`${metric === "revenue" ? "Виручка" : "Замовлення"} по днях, разом ${format(total)}. Стрілки ліворуч і праворуч перемикають дні.`}
          onKeyDown={onKey}
          onFocus={() => setActive((a) => a ?? days.length - 1)}
          onBlur={() => setActive(null)}
          onPointerLeave={() => setActive(null)}
        >
          <g className="chart__grid chart__axis">
            {ticks.map((t) => (
              <g key={t}>
                {t > 0 && <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />}
                <text x={PAD.left - 10} y={y(t)} dy="0.32em" textAnchor="end">
                  {tick(t)}
                </text>
              </g>
            ))}
          </g>
          <line className="chart__base" x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} />
          {days.map((d, i) => {
            const v = values[i];
            const x = PAD.left + i * band + (band - barW) / 2;
            const h = Math.max(y(0) - y(v), v > 0 ? 2 : 0);
            return (
              <g key={d.date} className={`chart__col${active === i ? " is-active" : ""}`} onPointerEnter={() => setActive(i)}>
                <rect className="chart__hit" x={PAD.left + i * band} y={PAD.top} width={band} height={plotH} />
                {h > 0 && <path className="chart__bar" d={barPath(x, y(0) - h, barW, h)} />}
              </g>
            );
          })}
          {peakIndex >= 0 && active === null && (
            <text className="chart__label" x={PAD.left + peakIndex * band + band / 2} y={y(peak) - 8} textAnchor={peakIndex > days.length - 3 ? "end" : "middle"}>
              {format(peak)}
            </text>
          )}
          <g className="chart__axis">
            {days.map((d, i) =>
              (days.length - 1 - i) % labelEvery === 0 ? (
                <text key={d.date} x={PAD.left + i * band + band / 2} y={HEIGHT - 8} textAnchor={i === days.length - 1 ? "end" : "middle"}>
                  {i === days.length - 1 ? "сьогодні" : shortDate.format(asDate(d.date))}
                </text>
              ) : null,
            )}
          </g>
        </svg>
      )}
      {current && active !== null && (
        <div className="chart__tip" style={{ left: Math.min(Math.max(PAD.left + active * band + band / 2, 90), width - 90), top: y(values[active]) }} aria-live="polite">
          <span>{longDate.format(asDate(current.date))}</span>
          <b>{formatPrice(current.revenue.value)}</b>
          <span>
            {current.orders} {current.orders === 1 ? "замовлення" : "замовлень"}
          </span>
        </div>
      )}
      {peak === 0 && <p className="chart__empty">За цей період замовлень немає.</p>}
      <details className="chart-table">
        <summary>Таблиця по днях</summary>
        <div className="chart-table__scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">День</th>
                <th scope="col" className="num">
                  Замовлень
                </th>
                <th scope="col" className="num">
                  Виручка
                </th>
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((d) => (
                <tr key={d.date}>
                  <td>{longDate.format(asDate(d.date))}</td>
                  <td className="num">{d.orders}</td>
                  <td className="num">{formatPrice(d.revenue.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

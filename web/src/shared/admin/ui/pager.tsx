"use client";

import { Fragment } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/shared/ui/icons";

export function Pager({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPage,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  if (totalItems === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);
  const numbers = Array.from({ length: totalPages }, (_, i) => i + 1).filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1);
  return (
    <nav className="admin-pager" aria-label="Сторінки">
      <p className="admin-count">
        Показано {from}–{to} з {totalItems}
      </p>
      {totalPages > 1 && (
        <div className="admin-pager__pages">
          <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Попередня сторінка">
            <ChevronLeftIcon />
          </button>
          {numbers.map((n, i) => (
            <Fragment key={n}>
              {i > 0 && n - numbers[i - 1] > 1 && (
                <span className="gap" aria-hidden="true">
                  …
                </span>
              )}
              {n === page ? (
                <span aria-current="page">{n}</span>
              ) : (
                <button type="button" onClick={() => onPage(n)}>
                  {n}
                </button>
              )}
            </Fragment>
          ))}
          <button type="button" onClick={() => onPage(page + 1)} disabled={page >= totalPages} aria-label="Наступна сторінка">
            <ChevronRightIcon />
          </button>
        </div>
      )}
    </nav>
  );
}

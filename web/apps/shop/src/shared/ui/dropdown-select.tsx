"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "@polivalko/shared/ui/icons";

export type DropdownOption<T extends string | number> = { value: T; label: string; group?: string; };

type DropdownSelectProps<T extends string | number> = {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  label?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  searchable?: boolean;
  variant?: "inline" | "field";
  className?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

export function DropdownSelect<T extends string | number>({
  value,
  options,
  onChange,
  label,
  id,
  name,
  placeholder = "Оберіть зі списку",
  searchPlaceholder = "Пошук у списку",
  searchable = false,
  variant = "inline",
  className,
  disabled,
  "aria-invalid": invalid,
  "aria-describedby": describedBy,
}: DropdownSelectProps<T>) {
  const auto = useId();
  const base = id ?? auto;
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const selected = options.find((option) => option.value === value);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("uk");
    return needle ? options.filter((option) => option.label.toLocaleLowerCase("uk").includes(needle)) : options;
  }, [options, query]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (searchable) search.current?.focus();
    document.getElementById(`${base}-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, searchable, base]);

  function show() {
    if (disabled) return;
    setQuery("");
    setActive(Math.max(0, options.findIndex((option) => option.value === value)));
    setOpen(true);
  }

  function hide(refocus: boolean) {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  }

  function choose(index: number) {
    const option = visible[index];
    hide(true);
    if (option && option.value !== value) onChange(option.value);
  }

  function navigate(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, visible.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Home" && !searchable) {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End" && !searchable) {
      event.preventDefault();
      setActive(visible.length - 1);
    } else if (event.key === "Enter" || (event.key === " " && !searchable)) {
      event.preventDefault();
      choose(active);
    } else if (event.key === "Escape") {
      event.preventDefault();
      hide(true);
    } else if (event.key === "Tab") {
      hide(false);
    }
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        show();
      }
      return;
    }
    navigate(event);
  }

  const listId = `${base}-list`;
  const activeId = open && visible.length > 0 ? `${base}-option-${active}` : undefined;

  return (
    <div ref={root} className={["dsel", `dsel--${variant}`, className].filter(Boolean).join(" ")} data-open={open || undefined}>
      {label && (
        <span className="dsel__label" id={`${base}-label`}>
          {label}
        </span>
      )}
      <div className="dsel__box">
        <button
          ref={trigger}
          id={base}
          type="button"
          role="combobox"
          className="dsel__trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-labelledby={label ? `${base}-label ${base}-value` : undefined}
          aria-activedescendant={searchable ? undefined : activeId}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          onClick={() => (open ? hide(false) : show())}
          onKeyDown={onTriggerKeyDown}
        >
          <span id={`${base}-value`} className={selected ? "dsel__value" : "dsel__value dsel__value--empty"}>
            {selected?.label ?? placeholder}
          </span>
          <ChevronDownIcon />
        </button>
        {name && <input type="hidden" name={name} value={String(value ?? "")} />}
        <div className="dsel__popup" hidden={!open}>
          {searchable && (
            <div className="dsel__search">
              <SearchIcon />
              <input
                ref={search}
                type="search"
                value={query}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                aria-controls={listId}
                aria-activedescendant={activeId}
                autoComplete="off"
                onChange={(event) => {
                  setQuery(event.currentTarget.value);
                  setActive(0);
                }}
                onKeyDown={navigate}
              />
            </div>
          )}
          <ul id={listId} role="listbox" aria-labelledby={label ? `${base}-label` : base} className="dsel__list">
            {visible.length === 0 && <li className="dsel__empty">Нічого не знайдено</li>}
            {visible.map((option, index) => (
              <Fragment key={String(option.value)}>
                {option.group && option.group !== visible[index - 1]?.group && (
                  <li className="dsel__group" role="presentation">
                    {option.group}
                  </li>
                )}
                <li
                  id={`${base}-option-${index}`}
                  role="option"
                  aria-selected={option.value === value}
                  data-active={index === active || undefined}
                  onPointerEnter={() => setActive(index)}
                  onClick={() => choose(index)}
                >
                  <span>{option.label}</span>
                  {option.value === value && <CheckIcon />}
                </li>
              </Fragment>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

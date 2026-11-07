"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

export function DropdownSelect({
  value,
  onValueChange,
  options,
  placeholder = "—",
  className,
  onBlur,
  ref,
  ...props
}: Pick<
  ComponentProps<"button">,
  | "id"
  | "aria-label"
  | "aria-labelledby"
  | "aria-invalid"
  | "aria-describedby"
  | "disabled"
  | "ref"
  | "className"
> & {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly Option[];
  placeholder?: string;
  onBlur?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selected = options.findIndex((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    function dismissOutside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !root.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", dismissOutside);
    return () => document.removeEventListener("pointerdown", dismissOutside);
  }, [open]);

  useEffect(() => {
    const menu = list.current;
    const option = menu?.children.item(active);
    if (!menu || !(option instanceof HTMLElement)) return;
    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;
    if (top < menu.scrollTop) menu.scrollTop = top;
    else if (bottom > menu.scrollTop + menu.clientHeight) {
      menu.scrollTop = bottom - menu.clientHeight;
    }
  }, [active, open]);

  function choose(index: number) {
    if (options[index]) onValueChange(options[index].value);
    setOpen(false);
  }

  return (
    <div
      ref={root}
      className="relative min-w-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          onBlur?.();
        }
      }}
    >
      <button
        {...props}
        disabled={props.disabled || options.length === 0}
        ref={(node) => {
          trigger.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={
          open && options[active] ? `${listId}-${active}` : undefined
        }
        className={cn(
          "form-input dropdown-trigger flex min-h-11 items-center justify-between gap-2 hover:border-primary",
          className,
        )}
        onClick={() => {
          setActive(Math.max(0, selected));
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setActive(
              open
                ? (active +
                    (event.key === "ArrowDown" ? 1 : options.length - 1)) %
                    Math.max(1, options.length)
                : Math.max(0, selected),
            );
            setOpen(true);
          } else if (open && (event.key === "Home" || event.key === "End")) {
            event.preventDefault();
            setActive(event.key === "Home" ? 0 : options.length - 1);
          } else if (open && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            choose(active);
          }
        }}
      >
        <span className="truncate">
          {options[selected]?.label ?? placeholder}
        </span>
        <ChevronDown size={16} aria-hidden className="shrink-0" />
      </button>
      {open && (
        <ul
          id={listId}
          ref={list}
          role="listbox"
          aria-labelledby={props["aria-labelledby"]}
          aria-label={
            props["aria-labelledby"]
              ? undefined
              : (props["aria-label"] ?? placeholder)
          }
          className="absolute z-20 mt-1 max-h-56 w-full min-w-28 overflow-y-auto rounded-dropdown border border-border bg-card p-1 shadow-lg"
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === selected}
              className={cn(
                "flex min-h-11 cursor-pointer items-center rounded-dropdown px-3 text-sm [overflow-wrap:anywhere] hover:bg-muted",
                index === active && "bg-muted",
              )}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => {
                choose(index);
                trigger.current?.focus();
              }}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

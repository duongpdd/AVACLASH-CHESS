"use client";

import { useId, useRef, type ReactNode } from "react";

export default function Tabs<T extends string>({
  label,
  tabs,
  selected,
  onChange,
  panels,
}: {
  label: string;
  tabs: readonly { id: T; label: string }[];
  selected: T;
  onChange: (tab: T) => void;
  panels: Record<T, ReactNode>;
}) {
  const id = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div className="grid min-w-0 gap-4">
      <div role="tablist" aria-label={label} className="flex flex-wrap gap-2">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            type="button"
            className={
              selected === tab.id ? "button-primary" : "button-secondary"
            }
            role="tab"
            id={`${id}-tab-${tab.id}`}
            aria-controls={`${id}-panel-${tab.id}`}
            aria-selected={selected === tab.id}
            tabIndex={selected === tab.id ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => {
              const last = tabs.length - 1;
              let next: number;
              switch (event.key) {
                case "ArrowLeft":
                  next = index === 0 ? last : index - 1;
                  break;
                case "ArrowRight":
                  next = index === last ? 0 : index + 1;
                  break;
                case "Home":
                  next = 0;
                  break;
                case "End":
                  next = last;
                  break;
                default:
                  return;
              }
              event.preventDefault();
              buttons.current[next]?.focus();
              onChange(tabs[next].id);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map(({ id: tab }) => (
        <div
          key={tab}
          role="tabpanel"
          id={`${id}-panel-${tab}`}
          aria-labelledby={`${id}-tab-${tab}`}
          hidden={selected !== tab}
          tabIndex={0}
        >
          {selected === tab ? panels[tab] : null}
        </div>
      ))}
    </div>
  );
}

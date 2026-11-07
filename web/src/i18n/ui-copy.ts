import vi from "@/messages/vi.json";
import en from "@/messages/en.json";

export type UiKey = keyof typeof vi.ui;
export type UiValues = Record<string, string | number>;
export type UiText = (key: UiKey, values?: UiValues) => string;

const parameter = /\{(p\d+)\}/g;

export const defaultUiText: UiText = (key, values) =>
  vi.ui[key].replace(parameter, (placeholder, name: string) =>
    String(values?.[name] ?? placeholder),
  );

function escape(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const exact = new Map<string, UiKey>();
const templates: { key: UiKey; pattern: RegExp; names: string[] }[] = [];
for (const catalog of [vi.ui, en.ui]) {
  for (const [name, value] of Object.entries(catalog)) {
    const key = name as UiKey;
    const parts = value.split(parameter);
    if (parts.length === 1) {
      if (!exact.has(value)) exact.set(value, key);
      continue;
    }
    templates.push({
      key,
      pattern: new RegExp(
        "^" +
          parts
            .map((part, index) => (index % 2 ? "(.*?)" : escape(part)))
            .join("") +
          "$",
      ),
      names: parts.filter((_, index) => index % 2),
    });
  }
}

/** Localize app-generated messages still stored by the room and transaction layers. */
export function localizeExisting(value: string, text: UiText): string {
  const key = exact.get(value);
  if (key) return text(key);
  for (const { key, pattern, names } of templates) {
    const match = pattern.exec(value);
    if (!match) continue;
    const values = Object.fromEntries(
      names.map((name, index) => [name, match[index + 1]]),
    );
    return text(key, values);
  }
  return value;
}

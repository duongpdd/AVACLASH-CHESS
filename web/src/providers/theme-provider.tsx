"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const ThemeContext = createContext({ dark: true, toggle: () => {} });
const themeKey = "avaclash-theme";
const themeChanged = "avaclash-theme-changed";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(themeChanged, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(themeChanged, onChange);
  };
}

function readDark() {
  return localStorage.getItem(themeKey) !== "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const dark = useSyncExternalStore(subscribe, readDark, () => true);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  function toggle() {
    const next = !dark;
    localStorage.setItem(themeKey, next ? "dark" : "light");
    window.dispatchEvent(new Event(themeChanged));
  }

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "@phosphor-icons/react";

const STORAGE_KEY = "kerlomp-theme";

/**
 * Status dark dibaca dari DOM (sumber kebenaran = class di <html>), bukan disalin ke state.
 * MutationObserver + useSyncExternalStore, jadi tidak ada setState di dalam effect.
 */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerSnapshot() {
  return false;
}

export function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // localStorage bisa throw (incognito/quota); toggle tetap jalan di sesi ini.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
      aria-pressed={isDark}
      className="inline-flex size-11 items-center justify-center rounded-md text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
    >
      {isDark ? (
        <Sun size={20} weight="regular" aria-hidden />
      ) : (
        <Moon size={20} weight="regular" aria-hidden />
      )}
    </button>
  );
}
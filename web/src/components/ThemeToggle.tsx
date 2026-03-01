'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './AppHeader.module.css';

type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'lexflow_theme';

function getSystemTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme: ThemeMode) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 7a5 5 0 1 0 5 5 5 5 0 0 0-5-5Zm0-5a1 1 0 0 1 1 1v2h-2V3a1 1 0 0 1 1-1Zm0 17a1 1 0 0 1 1 1v2h-2v-2a1 1 0 0 1 1-1Zm10-8a1 1 0 0 1-1 1h-2v-2h2a1 1 0 0 1 1 1ZM5 12a1 1 0 0 1-1 1H2v-2h2a1 1 0 0 1 1 1Zm13.07-6.66.71.7-1.41 1.42-.71-.71a1 1 0 1 1 1.41-1.41ZM7.63 16.78a1 1 0 0 1 0 1.41l-.7.71-1.42-1.41.71-.71a1 1 0 0 1 1.41 0Zm11.2 1.41-.71.71-.71-.71a1 1 0 1 1 1.42-1.41l.7.7Zm-12.62-11.9-.71.71-.7-.71A1 1 0 0 1 6.2 4.88l.71.7Z"
        fill="currentColor"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M20.6 14.3A8.5 8.5 0 0 1 9.7 3.4a1 1 0 0 0-1.2-1.2A10.5 10.5 0 1 0 21.8 15.5a1 1 0 0 0-1.2-1.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>('dark');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    const initial =
      stored === 'light' || stored === 'dark' ? stored : getSystemTheme();
    applyTheme(initial);
    queueMicrotask(() => {
      setTheme(initial);
    });
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const nextTheme = useMemo<ThemeMode>(() => (theme === 'dark' ? 'light' : 'dark'), [theme]);

  function toggleTheme() {
    const next = nextTheme;
    setTheme(next);
    applyTheme(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  const label =
    theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro';

  return (
    <button
      type="button"
      className={styles.iconButton}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      suppressHydrationWarning
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

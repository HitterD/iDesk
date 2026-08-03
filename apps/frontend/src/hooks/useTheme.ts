import { useState, useEffect } from 'react';

export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'vite-ui-theme';

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';
    const stored = (localStorage.getItem(STORAGE_KEY) || localStorage.getItem('idesk-theme')) as Theme | null;
    return stored ?? 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return {
    theme,
    toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
  };
};

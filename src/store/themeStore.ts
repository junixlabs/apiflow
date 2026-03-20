import { create } from 'zustand';

type Theme = 'dark' | 'light';

const STORAGE_KEY = 'apiview_theme';

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch { /* ignore */ }
  return 'dark';
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch { /* ignore */ }
}

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const initial = readStoredTheme();
  // Apply on init so DOM matches
  applyTheme(initial);

  return {
    theme: initial,

    toggleTheme: () => {
      const newTheme = get().theme === 'dark' ? 'light' : 'dark';
      applyTheme(newTheme);
      set({ theme: newTheme });
    },

    setTheme: (theme) => {
      applyTheme(theme);
      set({ theme });
    },
  };
});

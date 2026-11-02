const KEY = 'ok_theme';

/** Apply the theme to <html> and remember it. */
export const applyTheme = (dark) => {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  try { localStorage.setItem(KEY, dark ? 'dark' : 'light'); } catch { /* private mode */ }
};

/** Initial theme: saved choice, else the OS preference. */
export const initialTheme = () => {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'dark' || saved === 'light') return saved === 'dark';
  } catch { /* private mode */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches || false;
};

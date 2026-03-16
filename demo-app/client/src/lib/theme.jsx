import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const KEY = 'ignition-copilot:theme';

export const themes = {
  dracula: {
    id: 'dracula',
    label: 'Dracula',
    colors: {
      bg: '#282a36',
      bgSecondary: '#1e1f29',
      surface: '#44475a',
      surfaceHover: '#4e5170',
      border: '#6272a4',
      borderSubtle: '#383a4a',
      text: '#f8f8f2',
      textSecondary: '#bfc4d6',
      textMuted: '#6272a4',
      accent: '#bd93f9',
      accentHover: '#caa4ff',
      accentSubtle: 'rgba(189, 147, 249, 0.15)',
      success: '#50fa7b',
      successSubtle: 'rgba(80, 250, 123, 0.15)',
      warning: '#ffb86c',
      warningSubtle: 'rgba(255, 184, 108, 0.15)',
      error: '#ff5555',
      errorSubtle: 'rgba(255, 85, 85, 0.15)',
      info: '#8be9fd',
      infoSubtle: 'rgba(139, 233, 253, 0.15)',
      headerBg: '#21222c',
      sidebarBg: '#21222c',
      inputBg: '#383a4a',
      inputBorder: '#6272a4',
      inputText: '#f8f8f2',
      shadow: 'rgba(0,0,0,0.4)',
      scrollThumb: '#6272a4',
      scrollThumbHover: '#bd93f9',
    },
  },
  slate: {
    id: 'slate',
    label: 'Slate',
    colors: {
      bg: '#0f172a',
      bgSecondary: '#020617',
      surface: '#1e293b',
      surfaceHover: '#334155',
      border: '#475569',
      borderSubtle: '#243244',
      text: '#e2e8f0',
      textSecondary: '#cbd5e1',
      textMuted: '#94a3b8',
      accent: '#38bdf8',
      accentHover: '#7dd3fc',
      accentSubtle: 'rgba(56, 189, 248, 0.18)',
      success: '#22c55e',
      successSubtle: 'rgba(34, 197, 94, 0.2)',
      warning: '#f59e0b',
      warningSubtle: 'rgba(245, 158, 11, 0.2)',
      error: '#ef4444',
      errorSubtle: 'rgba(239, 68, 68, 0.2)',
      info: '#22d3ee',
      infoSubtle: 'rgba(34, 211, 238, 0.2)',
      headerBg: '#0b1220',
      sidebarBg: '#0b1220',
      inputBg: '#111b2f',
      inputBorder: '#334155',
      inputText: '#e2e8f0',
      shadow: 'rgba(2, 6, 23, 0.55)',
      scrollThumb: '#334155',
      scrollThumbHover: '#38bdf8',
    },
  },
  light: {
    id: 'light',
    label: 'Light',
    colors: {
      bg: '#f8fafc',
      bgSecondary: '#eef2ff',
      surface: '#ffffff',
      surfaceHover: '#f1f5f9',
      border: '#cbd5e1',
      borderSubtle: '#e2e8f0',
      text: '#0f172a',
      textSecondary: '#1e293b',
      textMuted: '#64748b',
      accent: '#2563eb',
      accentHover: '#1d4ed8',
      accentSubtle: 'rgba(37, 99, 235, 0.12)',
      success: '#16a34a',
      successSubtle: 'rgba(22, 163, 74, 0.12)',
      warning: '#d97706',
      warningSubtle: 'rgba(217, 119, 6, 0.14)',
      error: '#dc2626',
      errorSubtle: 'rgba(220, 38, 38, 0.12)',
      info: '#0ea5e9',
      infoSubtle: 'rgba(14, 165, 233, 0.12)',
      headerBg: '#ffffff',
      sidebarBg: '#f8fafc',
      inputBg: '#ffffff',
      inputBorder: '#cbd5e1',
      inputText: '#0f172a',
      shadow: 'rgba(15, 23, 42, 0.08)',
      scrollThumb: '#cbd5e1',
      scrollThumbHover: '#2563eb',
    },
  },
};

function applyThemeVars(theme) {
  if (!theme?.colors) return;
  const root = document.documentElement;
  const c = theme.colors;
  root.style.setProperty('--color-bg', c.bg);
  root.style.setProperty('--color-bg-secondary', c.bgSecondary);
  root.style.setProperty('--color-surface', c.surface);
  root.style.setProperty('--color-surface-hover', c.surfaceHover);
  root.style.setProperty('--color-border', c.border);
  root.style.setProperty('--color-border-subtle', c.borderSubtle);
  root.style.setProperty('--color-text', c.text);
  root.style.setProperty('--color-text-secondary', c.textSecondary);
  root.style.setProperty('--color-text-muted', c.textMuted);
  root.style.setProperty('--color-accent', c.accent);
  root.style.setProperty('--color-accent-hover', c.accentHover);
  root.style.setProperty('--color-accent-subtle', c.accentSubtle);
  root.style.setProperty('--color-success', c.success);
  root.style.setProperty('--color-success-subtle', c.successSubtle);
  root.style.setProperty('--color-warning', c.warning);
  root.style.setProperty('--color-warning-subtle', c.warningSubtle);
  root.style.setProperty('--color-error', c.error);
  root.style.setProperty('--color-error-subtle', c.errorSubtle);
  root.style.setProperty('--color-info', c.info);
  root.style.setProperty('--color-info-subtle', c.infoSubtle);
  root.style.setProperty('--color-header-bg', c.headerBg);
  root.style.setProperty('--color-sidebar-bg', c.sidebarBg);
  root.style.setProperty('--color-input-bg', c.inputBg);
  root.style.setProperty('--color-input-border', c.inputBorder);
  root.style.setProperty('--color-input-text', c.inputText);
  root.style.setProperty('--color-shadow', c.shadow);
  root.style.setProperty('--color-scroll-thumb', c.scrollThumb);
  root.style.setProperty('--color-scroll-thumb-hover', c.scrollThumbHover);
}

function loadThemeId() {
  try {
    const saved = localStorage.getItem(KEY);
    return saved && themes[saved] ? saved : 'dracula';
  } catch {
    return 'dracula';
  }
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(loadThemeId);

  useEffect(() => {
    const next = themes[themeId] || themes.dracula;
    applyThemeVars(next);
    try { localStorage.setItem(KEY, next.id); } catch {}
  }, [themeId]);

  const value = useMemo(() => ({
    themeId,
    theme: themes[themeId] || themes.dracula,
    themes,
    switchTheme: (nextId) => {
      if (themes[nextId]) setThemeId(nextId);
    },
  }), [themeId]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

export default ThemeProvider;

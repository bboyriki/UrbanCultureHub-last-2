/**
 * Theme injection utilities — uses inline styles on document.documentElement
 * which have the HIGHEST CSS priority (overrides all stylesheets).
 * MutationObserver handles automatic dark/light mode switching.
 */

export interface ThemeColorSet {
  primary: string;
  background?: string;
  card?: string;
  accent?: string;
  muted?: string;
  border?: string;
}

export interface FullThemeConfig {
  id: string;
  light: ThemeColorSet;
  dark: ThemeColorSet;
}

const THEME_VARS = [
  "--primary", "--ring", "--sidebar-primary", "--sidebar-ring", "--chart-1",
  "--background", "--sidebar-background", "--card", "--popover",
  "--accent", "--secondary", "--muted", "--border", "--input",
];

let _observer: MutationObserver | null = null;
let _activeTheme: FullThemeConfig | null = null;

function _applyColorSet(colors: ThemeColorSet) {
  const root = document.documentElement;
  root.style.setProperty("--primary", colors.primary);
  root.style.setProperty("--ring", colors.primary);
  root.style.setProperty("--sidebar-primary", colors.primary);
  root.style.setProperty("--sidebar-ring", colors.primary);
  root.style.setProperty("--chart-1", colors.primary);
  if (colors.background) {
    root.style.setProperty("--background", colors.background);
    root.style.setProperty("--sidebar-background", colors.background);
  }
  if (colors.card) {
    root.style.setProperty("--card", colors.card);
    root.style.setProperty("--popover", colors.card);
  }
  if (colors.accent) {
    root.style.setProperty("--accent", colors.accent);
    root.style.setProperty("--secondary", colors.accent);
  }
  if (colors.muted) root.style.setProperty("--muted", colors.muted);
  if (colors.border) {
    root.style.setProperty("--border", colors.border);
    root.style.setProperty("--input", colors.border);
  }
}

function _resolveAndApply() {
  if (!_activeTheme) return;
  const isDark = document.documentElement.classList.contains("dark");
  _applyColorSet(isDark ? _activeTheme.dark : _activeTheme.light);
}

export function applyTheme(theme: FullThemeConfig) {
  _activeTheme = theme;
  _resolveAndApply();

  // Watch for dark/light mode switches
  if (_observer) _observer.disconnect();
  _observer = new MutationObserver(() => _resolveAndApply());
  _observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
}

export function clearTheme() {
  _activeTheme = null;
  if (_observer) { _observer.disconnect(); _observer = null; }
  const root = document.documentElement;
  THEME_VARS.forEach(v => root.style.removeProperty(v));
}

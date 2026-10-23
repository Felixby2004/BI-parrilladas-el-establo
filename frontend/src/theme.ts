export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'establo-theme'

/** El script inline de index.html aplica el tema antes del primer paint. */
export function currentTheme(): Theme {
  return document.documentElement.classList.contains('light') ? 'light' : 'dark'
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('light', theme === 'light')
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // almacenamiento bloqueado: el tema vive solo en esta sesión
  }
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'light' ? '#f6f1e6' : '#0C0A09')
}

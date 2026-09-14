import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

export function ThemeToggle({ language = 'es' }: { language?: 'es' | 'en' }) {
  const [theme, setTheme] = useState<Theme>('light')
  const labels = language === 'es'
    ? { control: 'Apariencia', light: 'Claro', dark: 'Oscuro' }
    : { control: 'Appearance', light: 'Light', dark: 'Dark' }

  useEffect(() => {
    const stored = localStorage.getItem('bp-theme') as Theme | null
    const initial = stored ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    setTheme(initial)
    document.documentElement.dataset.theme = initial
  }, [])

  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    document.documentElement.dataset.theme = next
    localStorage.setItem('bp-theme', next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`${labels.control}: ${theme === 'light' ? labels.light : labels.dark}`}
      title={theme === 'light' ? labels.dark : labels.light}
      className="h-8 px-2 rounded-full border border-line bg-panel flex items-center gap-2 text-[11px] font-mono text-text-dim hover:text-text transition-colors"
    >
      <span className={theme === 'light' ? 'text-text' : ''} aria-hidden="true">☼</span>
      <span className="w-px h-3 bg-line" aria-hidden="true" />
      <span className={theme === 'dark' ? 'text-text' : ''} aria-hidden="true">☾</span>
    </button>
  )
}

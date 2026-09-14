// src/components/LanguageSelector.tsx
import { useState } from 'react'

const LANGS = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
]

export function LanguageSelector({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false)
  const current = LANGS.find((l) => l.code === value) ?? LANGS[0]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs font-mono text-text-dim hover:text-text transition-colors"
      >
        {current.label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-32 rounded-md border border-line bg-panel shadow-lg overflow-hidden z-10">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                onChange(l.code)
                setOpen(false)
              }}
              className={`w-full text-left px-3 py-2 text-xs font-mono hover:bg-panel-2 ${
                l.code === value ? 'text-accent' : 'text-text-dim'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
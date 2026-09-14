import { ThemeToggle } from '@/components/ThemeToggle'

export function TopBar({ title, breadcrumb }: { title: string; breadcrumb: string }) {
  return (
    <div className="h-14 border-b border-line flex items-center justify-between px-6">
      <div>
        <div className="font-mono text-[10px] text-text-dim">{breadcrumb}</div>
        <div className="font-display font-semibold text-base -mt-0.5">{title}</div>
      </div>
      <div className="flex items-center gap-3 font-mono text-[10px] text-text-dim">
        <ThemeToggle />
        <span>api.blackpolar.org</span>
      </div>
    </div>
  )
}

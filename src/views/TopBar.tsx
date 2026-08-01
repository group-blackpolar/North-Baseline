export function TopBar({ title, breadcrumb }: { title: string; breadcrumb: string }) {
  return (
    <div className="h-14 border-b border-line flex items-center justify-between px-6">
      <div>
        <div className="font-mono text-[10px] text-text-dim">{breadcrumb}</div>
        <div className="font-display font-semibold text-base -mt-0.5">{title}</div>
      </div>
      <div className="flex items-center gap-2 font-mono text-[10px] text-text-dim">
        <span className="animate-pulse text-accent">●</span> api.blackpolar.org
      </div>
    </div>
  )
}

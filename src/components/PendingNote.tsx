export function PendingNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-mono text-accent-2 bg-accent-2/10 border border-accent-2/30 rounded px-3 py-2 mb-4 inline-block">
      ⚠ pendiente de backend — {children}
    </div>
  )
}

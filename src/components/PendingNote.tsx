export function PendingNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-mono text-warning bg-warning/10 border border-warning/30 rounded px-3 py-2 mb-4 inline-block">
      ⚠ pendiente de backend — {children}
    </div>
  )
}

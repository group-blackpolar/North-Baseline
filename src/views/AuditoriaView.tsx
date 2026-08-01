import { useState } from 'react'
import { AUDIT_EVENTS } from '@/data/mock'
import { Input } from '@/components/ui/input'
import { PendingNote } from '@/components/PendingNote'

export function AuditoriaView() {
  const [filter, setFilter] = useState('')
  const visible = AUDIT_EVENTS.filter(
    (e) => e.actor.toLowerCase().includes(filter.toLowerCase()) || e.recurso.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="p-6 max-w-4xl">
      <PendingNote>feed de auditoría real requiere que cada ruta de CoreCrow-API escriba un evento — hoy es de ejemplo</PendingNote>

      <Input placeholder="filtrar por usuario o recurso…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs mb-4" />

      <div className="rounded-lg border border-line bg-panel divide-y divide-line">
        {visible.map((e) => (
          <div key={e.id} className="px-4 py-3 flex items-center gap-3 text-sm">
            <span className="font-mono text-xs text-accent w-24 shrink-0 truncate">{e.actor}</span>
            <span className="flex-1">{e.accion}</span>
            <span className="font-mono text-xs text-text-dim">{e.recurso}</span>
            <span className="font-mono text-[10px] text-text-dim w-16 text-right shrink-0">{e.timestamp}</span>
          </div>
        ))}
        {visible.length === 0 && <div className="p-6 text-center text-sm text-text-dim font-mono">sin resultados.</div>}
      </div>
    </div>
  )
}

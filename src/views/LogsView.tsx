import { useState } from 'react'
import { LOGS } from '@/data/mock'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { PendingNote } from '@/components/PendingNote'
import type { LogEntry } from '@/types'

const LEVEL_COLOR: Record<LogEntry['nivel'], string> = {
  info: 'text-text-dim',
  warn: 'text-accent-2 border-accent-2/40',
  error: 'text-accent-2 border-accent-2/60 bg-accent-2/10',
}

export function LogsView() {
  const [filter, setFilter] = useState('')
  const visible = LOGS.filter((l) => l.mensaje.toLowerCase().includes(filter.toLowerCase()))

  return (
    <div className="p-6 max-w-4xl">
      <PendingNote>stream de logs en vivo — falta endpoint/websocket de logs centralizados en CoreCrow-API</PendingNote>

      <Input placeholder="buscar en logs…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs mb-4" />

      <div className="rounded-lg border border-line bg-panel divide-y divide-line font-mono text-xs">
        {visible.map((log) => (
          <div key={log.id} className="px-4 py-3 flex items-center gap-3">
            <Badge className={LEVEL_COLOR[log.nivel]}>{log.nivel}</Badge>
            <span className="text-text-dim w-20 shrink-0">{log.origen}</span>
            <span className="flex-1 truncate">{log.mensaje}</span>
            <span className="text-text-dim shrink-0">{log.timestamp}</span>
          </div>
        ))}
        {visible.length === 0 && <div className="p-6 text-center text-text-dim">sin resultados.</div>}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { WORKSPACES, NOTES_TASKS } from '@/data/mock'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PendingNote } from '@/components/PendingNote'

export function NotesTasksView() {
  const [wsId, setWsId] = useState(WORKSPACES[0].id)
  const [items, setItems] = useState(NOTES_TASKS)
  const [filter, setFilter] = useState('')

  const visible = items.filter(
    (i) => i.workspaceId === wsId && i.titulo.toLowerCase().includes(filter.toLowerCase())
  )

  function toggleDone(id: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, hecha: !i.hecha } : i)))
  }

  return (
    <div className="p-6 max-w-4xl">
      <PendingNote>persistencia real de notas/tareas/workspaces en CoreCrow-API (hoy es solo local)</PendingNote>

      <div className="flex items-center gap-2 mb-4">
        {WORKSPACES.map((ws) => (
          <button
            key={ws.id}
            onClick={() => setWsId(ws.id)}
            className={`text-xs font-mono px-3 py-1.5 rounded border transition-colors ${
              wsId === ws.id
                ? 'border-accent text-accent bg-accent/10'
                : 'border-line text-text-dim hover:text-text'
            }`}
          >
            {ws.nombre}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4 gap-3">
        <Input placeholder="buscar…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs" />
        <Button size="sm" variant="outline">+ nueva nota/tarea</Button>
      </div>

      <div className="space-y-2">
        {visible.map((item) => (
          <div key={item.id} className="rounded-lg border border-line bg-panel p-4 flex items-start gap-3">
            {item.tipo === 'tarea' ? (
              <button
                onClick={() => toggleDone(item.id)}
                className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                  item.hecha ? 'bg-accent border-accent text-panel' : 'border-line'
                }`}
              >
                {item.hecha && '✓'}
              </button>
            ) : (
              <span className="mt-0.5 text-text-dim font-mono text-xs shrink-0">◆</span>
            )}
            <div className="flex-1 min-w-0">
              <div className={`font-display text-sm ${item.hecha ? 'line-through text-text-dim' : ''}`}>
                {item.titulo}
              </div>
              <div className="text-xs text-text-dim mt-0.5">{item.contenido}</div>
              <div className="flex items-center gap-2 mt-2">
                <Badge>{item.tipo}</Badge>
                {item.compartidaCon.map((u) => (
                  <Badge key={u}>compartida · {u}</Badge>
                ))}
                <span className="text-[10px] text-text-dim font-mono ml-auto">{item.actualizada}</span>
              </div>
            </div>
          </div>
        ))}
        {visible.length === 0 && (
          <div className="text-sm text-text-dim font-mono p-6 text-center">nada en este workspace todavía.</div>
        )}
      </div>
    </div>
  )
}

import { API_KEYS } from '@/data/mock'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PendingNote } from '@/components/PendingNote'

export function ApiKeysView() {
  return (
    <div className="p-6 max-w-4xl">
      <PendingNote>
        el modelo ApiKey ya existe en el schema de Prisma de CoreCrow-API, pero faltan las rutas
        create/list/revoke — esta tabla es de ejemplo
      </PendingNote>

      <div className="flex items-center justify-between mb-4">
        <div className="text-xs text-text-dim font-mono">{API_KEYS.length} keys activas</div>
        <Button size="sm" variant="outline">+ crear key</Button>
      </div>

      <div className="rounded-lg border border-line bg-panel overflow-hidden">
        <div className="grid grid-cols-[1fr_140px_1fr_120px_90px] px-4 py-2 text-[10px] font-mono text-text-dim border-b border-line">
          <div>NOMBRE</div>
          <div>PREFIJO</div>
          <div>SCOPES</div>
          <div>ÚLTIMO USO</div>
          <div></div>
        </div>
        {API_KEYS.map((k) => (
          <div
            key={k.id}
            className="grid grid-cols-[1fr_140px_1fr_120px_90px] px-4 py-3 text-sm border-b border-line last:border-0 items-center hover:bg-panel-2 transition-colors"
          >
            <div>
              <div className="font-display">{k.name}</div>
              <div className="text-[10px] text-text-dim font-mono">{k.owner}</div>
            </div>
            <div className="font-mono text-xs text-text-dim">{k.prefix}…</div>
            <div className="flex flex-wrap gap-1">
              {k.scopes.map((s) => (
                <Badge key={s}>{s}</Badge>
              ))}
            </div>
            <div className="font-mono text-xs text-text-dim">{k.lastUsed ?? 'nunca'}</div>
            <button className="text-xs font-mono text-accent-2 hover:underline text-right">revocar</button>
          </div>
        ))}
      </div>
    </div>
  )
}

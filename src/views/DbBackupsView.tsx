import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PendingNote } from '@/components/PendingNote'

export function DbBackupsView() {
  const [triggering, setTriggering] = useState(false)

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <PendingNote>
        necesita un endpoint de sistema en CoreCrow-API (ej. GET /api/system/db-status) que exponga tamaño, conexiones
        y último backup de Postgres en la VPS — estos valores son de ejemplo
      </PendingNote>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="text-[10px] font-mono text-text-dim uppercase">Tamaño de DB</div>
            <div className="font-display text-xl mt-1">—</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-[10px] font-mono text-text-dim uppercase">Conexiones activas</div>
            <div className="font-display text-xl mt-1">—</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-[10px] font-mono text-text-dim uppercase">Último backup</div>
            <div className="font-display text-xl mt-1">—</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-5 flex items-center justify-between">
          <div>
            <div className="font-display text-sm">Backup manual</div>
            <div className="text-xs text-text-dim font-mono mt-1">dispara un pg_dump en la VPS</div>
          </div>
          <Button size="sm" disabled={triggering} onClick={() => setTriggering(true)}>
            {triggering ? 'sin endpoint aún…' : 'generar backup ahora'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

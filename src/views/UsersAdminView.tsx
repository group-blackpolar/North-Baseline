import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { ApiUser } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PendingNote } from '@/components/PendingNote'

export function UsersAdminView() {
  const [users, setUsers] = useState<ApiUser[] | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')

  useEffect(() => {
    api
      .get<ApiUser[]>('/v1/users')
      .then(setUsers)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'no se pudo cargar'))
  }, [])

  const visible = (users ?? []).filter((u) =>
    (u.name ?? u.email).toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="p-6 max-w-4xl">
      <PendingNote>La lectura usa el contrato v1 real. La creación visual se conectará después de definir el flujo de activación por correo y contraseña inicial.</PendingNote>

      <div className="flex items-center justify-between mb-4 gap-3">
        <Input placeholder="buscar usuario…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs" />
        <Button size="sm" variant="outline">+ crear usuario</Button>
      </div>

      {error && <div className="text-sm text-warning font-mono mb-4">error: {error}</div>}
      {!users && !error && <div className="text-sm text-text-secondary font-mono">cargando desde api.blackpolar.org…</div>}

      {users && (
        <div className="rounded-lg border border-border bg-surface overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_90px_120px] px-4 py-2 text-[10px] font-mono text-text-secondary border-b border-border">
            <div>NOMBRE</div>
            <div>EMAIL</div>
            <div>ROL</div>
            <div>CREADO</div>
          </div>
          {visible.map((u) => (
            <div
              key={u.id}
              className="grid grid-cols-[1fr_1fr_90px_120px] px-4 py-3 text-sm border-b border-border last:border-0 items-center hover:bg-surface-hover transition-colors"
            >
              <div className="font-display">{u.name ?? '—'}</div>
              <div className="font-mono text-text-secondary text-xs">{u.email}</div>
              <div><Badge className={['ADMIN', 'SUPERADMIN'].includes(u.role) ? 'text-accent border-accent/40' : ''}>{u.role.toLowerCase()}</Badge></div>
              <div className="font-mono text-text-secondary text-xs">{new Date(u.createdAt).toLocaleDateString()}</div>
            </div>
          ))}
          {visible.length === 0 && (
            <div className="text-sm text-text-secondary font-mono p-6 text-center">sin resultados.</div>
          )}
        </div>
      )}
    </div>
  )
}

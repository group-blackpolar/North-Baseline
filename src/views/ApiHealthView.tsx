import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PendingNote } from '@/components/PendingNote'

const API_URL = import.meta.env.VITE_API_URL ?? 'https://api.blackpolar.org'

interface Ping {
  t: number
  latencyMs: number | null
  ok: boolean
}

export function ApiHealthView() {
  const [pings, setPings] = useState<Ping[]>([])
  const [status, setStatus] = useState<'up' | 'down' | 'checking'>('checking')

  useEffect(() => {
    let cancelled = false

    async function ping() {
      const start = performance.now()
      try {
        const res = await fetch(`${API_URL}/api/health`, { cache: 'no-store' })
        const latencyMs = Math.round(performance.now() - start)
        if (cancelled) return
        setStatus(res.ok ? 'up' : 'down')
        setPings((prev) => [...prev.slice(-19), { t: Date.now(), latencyMs, ok: res.ok }])
      } catch {
        if (cancelled) return
        setStatus('down')
        setPings((prev) => [...prev.slice(-19), { t: Date.now(), latencyMs: null, ok: false }])
      }
    }

    ping()
    const interval = setInterval(ping, 15000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const chartData = pings.map((p, i) => ({ i, latencia: p.latencyMs ?? 0 }))
  const latest = pings.at(-1)

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <PendingNote>
        p50/p95 por endpoint y alertas requieren instrumentar cada ruta en CoreCrow-API — hoy solo hacemos ping real a
        GET /api/health cada 15s
      </PendingNote>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="text-[10px] font-mono text-text-dim uppercase">Estado</div>
            <div className="font-display text-xl mt-1 flex items-center gap-2">
              <span className={status === 'up' ? 'text-accent' : status === 'down' ? 'text-accent-2' : 'text-text-dim'}>●</span>
              {status === 'up' ? 'operativo' : status === 'down' ? 'caído' : 'verificando…'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-[10px] font-mono text-text-dim uppercase">Latencia actual</div>
            <div className="font-display text-xl mt-1">{latest?.latencyMs ?? '—'} ms</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-[10px] font-mono text-text-dim uppercase">Endpoint</div>
            <div className="font-mono text-xs mt-1 text-text-dim">GET /api/health</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="font-display font-semibold text-sm flex items-center gap-2">
            Latencia (últimos pings) <Badge>cada 15s</Badge>
          </div>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="i" hide />
              <YAxis stroke="var(--color-text-dim)" fontSize={11} unit="ms" />
              <Tooltip
                contentStyle={{ background: 'var(--color-panel)', border: '1px solid var(--color-line)', borderRadius: 8, fontSize: 12 }}
              />
              <Line type="monotone" dataKey="latencia" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}

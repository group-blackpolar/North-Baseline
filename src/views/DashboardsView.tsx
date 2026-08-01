import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { REVENUE_SAMPLE } from '@/data/mock'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { PendingNote } from '@/components/PendingNote'

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-[10px] font-mono text-text-dim uppercase tracking-wide">{label}</div>
        <div className="font-display text-2xl mt-1">{value}</div>
        {sub && <div className="text-xs text-accent font-mono mt-1">{sub}</div>}
      </CardContent>
    </Card>
  )
}

export function DashboardsView() {
  return (
    <div className="p-6 max-w-5xl space-y-6">
      <PendingNote>ingresos/clientes son datos de ejemplo — falta el endpoint de métricas reales en CoreCrow-API</PendingNote>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Ingresos (jul)" value="$7,800" sub="+9.9% vs jun" />
        <StatCard label="Clientes activos" value="24" sub="+2 este mes" />
        <StatCard label="Usuarios · mainsite" value="—" />
        <StatCard label="Usuarios · North" value="—" />
      </div>

      <Card>
        <CardHeader>
          <div className="font-display font-semibold text-sm">Ingresos y clientes (6 meses)</div>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={REVENUE_SAMPLE}>
              <defs>
                <linearGradient id="ingresos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
              <XAxis dataKey="mes" stroke="var(--color-text-dim)" fontSize={11} />
              <YAxis stroke="var(--color-text-dim)" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-panel)',
                  border: '1px solid var(--color-line)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area type="monotone" dataKey="ingresos" stroke="var(--color-accent)" fill="url(#ingresos)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        {['blackpolar (mainsite)', 'North', 'CoreCrow-API'].map((sys) => (
          <Card key={sys}>
            <CardContent className="pt-5">
              <div className="text-[10px] font-mono text-text-dim uppercase tracking-wide">{sys}</div>
              <div className="font-display text-xl mt-1">—</div>
              <div className="text-xs text-text-dim font-mono mt-1">usuarios por sistema</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

import { DEPLOYS } from '@/data/mock'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PendingNote } from '@/components/PendingNote'
import type { DeployStatus } from '@/types'

const STATUS_COLOR: Record<DeployStatus['status'], string> = {
  success: 'text-accent border-accent/40',
  failed: 'text-accent-2 border-accent-2/50',
  running: 'text-text-dim',
}

export function CiCdView() {
  return (
    <div className="p-6 max-w-4xl">
      <PendingNote>necesita la GitHub Actions API (token de solo lectura + workflow dispatch para rollback)</PendingNote>

      <div className="space-y-2">
        {DEPLOYS.map((d) => (
          <div key={d.app} className="rounded-lg border border-line bg-panel p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="font-display text-sm">{d.app}</div>
              <div className="text-xs text-text-dim font-mono mt-0.5">
                {d.workflow} · {d.commit}
              </div>
            </div>
            <Badge className={STATUS_COLOR[d.status]}>
              {d.status === 'running' && <span className="animate-pulse mr-1">●</span>}
              {d.status}
            </Badge>
            <span className="text-[10px] text-text-dim font-mono w-16 text-right">{d.timestamp}</span>
            <Button size="sm" variant="outline">rollback</Button>
            <a
              href={`https://github.com/group-blackpolar/CoreCrow-API/actions`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-mono text-accent hover:underline"
            >
              ver log
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}

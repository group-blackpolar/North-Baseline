import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { expandWindow } from '@/lib/tauri'
import { login, loginWithAdminId, adminExists, initAdmin, type SessionUser } from '@/lib/auth'

type Stage = 'boot' | 'login'
type Mode = 'checking' | 'bootstrap' | 'admin-id' | 'email'

export function SplashLogin({ onSuccess }: { onSuccess: (user: SessionUser) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [stage, setStage] = useState<Stage>('boot')
  const [mode, setMode] = useState<Mode>('checking')

  const [adminId, setAdminId] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [pass, setPass] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setStage('login'), 1000)
    adminExists().then((exists) => setMode(exists ? 'admin-id' : 'bootstrap'))
    return () => clearTimeout(t)
  }, [])

  async function finish(user: SessionUser) {
    setLoading(false)
    setExpanded(true)
    await expandWindow()
    setTimeout(() => onSuccess(user), 500)
  }

  async function handleBootstrap(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!adminId || !email) {
      setError('Admin ID y correo son obligatorios.')
      return
    }
    setLoading(true)
    try {
      await initAdmin({ adminUniqueId: adminId, email, name: name || undefined })
      const user = await loginWithAdminId(adminId)
      await finish(user)
    } catch (err) {
      setLoading(false)
      setError(err instanceof Error ? err.message : 'No se pudo crear el admin.')
    }
  }

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!adminId) {
      setError('Ingresa tu Admin ID.')
      return
    }
    setLoading(true)
    try {
      const user = await loginWithAdminId(adminId)
      await finish(user)
    } catch (err) {
      setLoading(false)
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.')
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email || !pass) {
      setError('Ingresa correo y contraseña.')
      return
    }
    setLoading(true)
    try {
      const user = await login(email, pass)
      await finish(user)
    } catch (err) {
      setLoading(false)
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.')
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#05070B]">
      <div
        className={`transition-all duration-500 ease-out rounded-xl border border-line overflow-hidden bg-panel
        ${expanded ? 'w-full h-full rounded-none' : 'w-[380px] h-[480px] shadow-[0_20px_60px_-20px_rgba(94,234,212,0.15)]'}`}
      >
        {!expanded && (
          <div className="w-full h-full flex flex-col items-center justify-center px-8 animate-in fade-in">
            <div className="relative mb-6">
              <div className="w-14 h-14 rounded-lg border border-accent/40 flex items-center justify-center font-display font-bold text-xl text-accent">
                N
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-accent-2 animate-pulse" />
            </div>
            <div className="font-display text-sm tracking-[0.3em] text-text-dim mb-8">NORTH</div>

            {stage === 'boot' && (
              <div className="font-mono text-xs text-text-dim flex items-center gap-2">
                <span className="animate-pulse">●</span> inicializando sesión…
              </div>
            )}

            {stage === 'login' && mode === 'checking' && (
              <div className="font-mono text-xs text-text-dim flex items-center gap-2">
                <span className="animate-pulse">●</span> consultando api.blackpolar.org…
              </div>
            )}

            {stage === 'login' && mode === 'bootstrap' && (
              <form onSubmit={handleBootstrap} className="w-full space-y-3">
                <div className="text-[10px] text-accent-2 font-mono text-center mb-1">
                  aún no hay ningún admin — creando el primero
                </div>
                <Input placeholder="admin unique ID (ej. cosmic)" value={adminId} onChange={(e) => setAdminId(e.target.value)} />
                <Input placeholder="correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Input placeholder="nombre (opcional)" value={name} onChange={(e) => setName(e.target.value)} />
                {error && <div className="text-xs text-accent-2 font-mono">{error}</div>}
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Creando…' : 'Crear admin y entrar'}
                </Button>
              </form>
            )}

            {stage === 'login' && mode === 'admin-id' && (
              <form onSubmit={handleAdminLogin} className="w-full space-y-3">
                <Input placeholder="admin unique ID" value={adminId} onChange={(e) => setAdminId(e.target.value)} />
                {error && <div className="text-xs text-accent-2 font-mono">{error}</div>}
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Verificando…' : 'Iniciar sesión'}
                </Button>
                <button
                  type="button"
                  onClick={() => setMode('email')}
                  className="text-[10px] text-text-dim hover:text-text font-mono text-center w-full pt-1"
                >
                  usar correo y contraseña en su lugar
                </button>
              </form>
            )}

            {stage === 'login' && mode === 'email' && (
              <form onSubmit={handleEmailLogin} className="w-full space-y-3">
                <Input type="email" placeholder="correo" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
                <Input type="password" placeholder="contraseña" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" />
                {error && <div className="text-xs text-accent-2 font-mono">{error}</div>}
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Verificando…' : 'Iniciar sesión'}
                </Button>
                <button
                  type="button"
                  onClick={() => setMode('admin-id')}
                  className="text-[10px] text-text-dim hover:text-text font-mono text-center w-full pt-1"
                >
                  usar Admin ID en su lugar
                </button>
              </form>
            )}

            <div className="text-[10px] text-text-dim text-center font-mono pt-4">
              api.blackpolar.org · misma cuenta que blackpolar.org
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

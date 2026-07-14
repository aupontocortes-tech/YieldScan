'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getDeviceUserId,
  isDeviceUserIdLockedByEnv,
  resetDeviceUserId,
  setDeviceUserId,
} from '@/lib/neon/device-user'
import { NEON_USER_HEADER } from '@/lib/neon/constants'
import { maskUserId } from '@/lib/neon/format-user-id'
import { Cloud, KeyRound, Loader2, LogOut, Smartphone, Unplug } from 'lucide-react'

type SyncStatus = {
  configured: boolean
  linked: boolean
  loading: boolean
}

export function SyncAccountPanel() {
  const [status, setStatus] = useState<SyncStatus>({ configured: false, linked: false, loading: true })
  const [registerPass, setRegisterPass] = useState('')
  const [registerConfirm, setRegisterConfirm] = useState('')
  const [loginPass, setLoginPass] = useState('')
  const [unlinkPass, setUnlinkPass] = useState('')
  const [busy, setBusy] = useState<'register' | 'login' | 'disconnect' | 'unlink' | null>(null)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [userIdLabel, setUserIdLabel] = useState('')

  const envLocked = isDeviceUserIdLockedByEnv()

  const refreshStatus = useCallback(async () => {
    setStatus((s) => ({ ...s, loading: true }))
    setUserIdLabel(maskUserId(getDeviceUserId()))
    try {
      const res = await fetch('/api/sync/auth', {
        headers: { [NEON_USER_HEADER]: getDeviceUserId() },
        cache: 'no-store',
      })
      const json = (await res.json()) as { configured?: boolean; linked?: boolean }
      if (res.status === 503 || json.configured === false) {
        setStatus({ configured: false, linked: false, loading: false })
        return
      }
      setStatus({ configured: true, linked: Boolean(json.linked), loading: false })
    } catch {
      setStatus({ configured: false, linked: false, loading: false })
    }
  }, [])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  const afterSuccess = (text: string) => {
    setMessage({ type: 'ok', text })
    setRegisterPass('')
    setRegisterConfirm('')
    setLoginPass('')
    setUnlinkPass('')
    void refreshStatus()
    window.setTimeout(() => window.location.reload(), 800)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    if (registerPass !== registerConfirm) {
      setMessage({ type: 'err', text: 'As senhas não coincidem.' })
      return
    }
    setBusy('register')
    try {
      const res = await fetch('/api/sync/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [NEON_USER_HEADER]: getDeviceUserId(),
        },
        body: JSON.stringify({ action: 'register', passphrase: registerPass }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        setMessage({ type: 'err', text: json.error ?? 'Não foi possível guardar a senha.' })
        return
      }
      afterSuccess('Senha criada. Este aparelho já está ligado à sua conta na nuvem.')
    } catch {
      setMessage({ type: 'err', text: 'Falha de rede.' })
    } finally {
      setBusy(null)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setBusy('login')
    try {
      const res = await fetch('/api/sync/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', passphrase: loginPass }),
      })
      const json = (await res.json()) as { error?: string; userId?: string }
      if (!res.ok || !json.userId) {
        setMessage({ type: 'err', text: json.error ?? 'Senha incorrecta.' })
        return
      }
      setDeviceUserId(json.userId)
      afterSuccess('Conta ligada. A carregar as suas finanças…')
    } catch {
      setMessage({ type: 'err', text: 'Falha de rede.' })
    } finally {
      setBusy(null)
    }
  }

  const handleDisconnectDevice = () => {
    setMessage(null)
    if (envLocked) {
      setMessage({ type: 'err', text: 'O ID está fixo por variável de ambiente neste aparelho.' })
      return
    }
    const ok = window.confirm(
      'Desligar a sync neste aparelho?\n\nOs dados na nuvem e noutros aparelhos mantêm-se. Este dispositivo passa a usar um ID novo (conta local).',
    )
    if (!ok) return
    setBusy('disconnect')
    try {
      resetDeviceUserId()
      afterSuccess('Conta desligada neste aparelho. A recarregar…')
    } catch {
      setMessage({ type: 'err', text: 'Não foi possível desligar neste aparelho.' })
      setBusy(null)
    }
  }

  const handleUnlinkPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    if (envLocked) {
      setMessage({ type: 'err', text: 'O ID está fixo por variável de ambiente neste aparelho.' })
      return
    }
    const ok = window.confirm(
      'Remover a senha de sync desta conta na nuvem?\n\nDeixa de poder “Ligar esta conta” noutros aparelhos com esta senha. Os dados financeiros na nuvem não são apagados.',
    )
    if (!ok) return
    setBusy('unlink')
    try {
      const res = await fetch('/api/sync/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [NEON_USER_HEADER]: getDeviceUserId(),
        },
        body: JSON.stringify({ action: 'unlink', passphrase: unlinkPass }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        setMessage({ type: 'err', text: json.error ?? 'Não foi possível remover a senha.' })
        return
      }
      resetDeviceUserId()
      afterSuccess('Senha de sync removida. Conta desligada neste aparelho.')
    } catch {
      setMessage({ type: 'err', text: 'Falha de rede.' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="max-w-xl border-indigo-500/25 bg-gradient-to-br from-indigo-950/30 via-card/40 to-violet-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Cloud className="h-4 w-4 text-indigo-400" />
          Sincronização das finanças
        </CardTitle>
        <CardDescription>
          Use a mesma senha no telemóvel e no computador — o app descobre o ID da sua conta sozinho.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-sm">
          <p className="text-muted-foreground">
            ID deste aparelho:{' '}
            <span className="font-mono text-xs text-foreground">{userIdLabel || '—'}</span>
          </p>
          {status.loading ? (
            <p className="mt-1 text-xs text-muted-foreground">A verificar nuvem…</p>
          ) : !status.configured ? (
            <p className="mt-1 text-xs text-amber-300/90">
              Nuvem não configurada neste servidor (DATABASE_URL em falta).
            </p>
          ) : status.linked ? (
            <p className="mt-1 text-xs text-emerald-400">Senha de sync activa para esta conta.</p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">Ainda sem senha — crie uma abaixo.</p>
          )}
          {envLocked ? (
            <p className="mt-2 text-xs text-sky-300/90">
              O ID está fixo por variável de ambiente neste aparelho (modo avançado).
            </p>
          ) : null}
        </div>

        {status.configured && !envLocked ? (
          <div className="space-y-3 rounded-xl border border-rose-500/25 bg-rose-950/15 p-4">
            <div className="flex items-start gap-2">
              <Unplug className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              <div>
                <p className="text-sm font-medium text-rose-200">Desligar conta</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pare a sync neste aparelho. Os dados na nuvem e noutros dispositivos continuam disponíveis.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full border-rose-500/40 text-rose-200 hover:bg-rose-500/10 hover:text-rose-100"
              disabled={busy !== null}
              onClick={handleDisconnectDevice}
            >
              {busy === 'disconnect' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="mr-2 h-4 w-4" />
              )}
              Desligar neste aparelho
            </Button>

            {status.linked ? (
              <form onSubmit={handleUnlinkPassword} className="space-y-3 border-t border-rose-500/20 pt-3">
                <p className="text-xs text-muted-foreground">
                  Ou remova a senha de sync na nuvem (pede a senha para confirmar):
                </p>
                <div>
                  <Label htmlFor="sync-unlink-pass">Senha actual</Label>
                  <Input
                    id="sync-unlink-pass"
                    type="password"
                    autoComplete="current-password"
                    value={unlinkPass}
                    onChange={(e) => setUnlinkPass(e.target.value)}
                    placeholder="Confirme a senha de sync"
                    disabled={busy !== null}
                    className="mt-1"
                  />
                </div>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={busy !== null || !unlinkPass}
                  className="w-full"
                >
                  {busy === 'unlink' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Remover senha e desligar
                </Button>
              </form>
            ) : null}
          </div>
        ) : null}

        {!status.configured ? null : (
          <>
            <div className="space-y-3 rounded-xl border border-emerald-500/20 bg-emerald-950/15 p-4">
              <div className="flex items-start gap-2">
                <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-emerald-200">No telemóvel (primeira vez)</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Onde já tem movimentos registados, crie uma senha. Ela fica ligada ao ID deste aparelho na
                    nuvem.
                  </p>
                </div>
              </div>
              <form onSubmit={handleRegister} className="space-y-3">
                <div>
                  <Label htmlFor="sync-register-pass">Criar senha de sync</Label>
                  <Input
                    id="sync-register-pass"
                    type="password"
                    autoComplete="new-password"
                    value={registerPass}
                    onChange={(e) => setRegisterPass(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    disabled={busy !== null || envLocked}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="sync-register-confirm">Confirmar senha</Label>
                  <Input
                    id="sync-register-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={registerConfirm}
                    onChange={(e) => setRegisterConfirm(e.target.value)}
                    disabled={busy !== null || envLocked}
                    className="mt-1"
                  />
                </div>
                <Button type="submit" disabled={busy !== null || envLocked || !registerPass}>
                  {busy === 'register' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Guardar senha neste aparelho
                </Button>
              </form>
            </div>

            <div className="space-y-3 rounded-xl border border-indigo-500/20 bg-indigo-950/15 p-4">
              <div className="flex items-start gap-2">
                <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
                <div>
                  <p className="text-sm font-medium text-indigo-200">Noutro aparelho (ex.: laptop)</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Introduza a mesma senha — o sistema encontra o ID real das suas finanças e sincroniza.
                  </p>
                </div>
              </div>
              <form onSubmit={handleLogin} className="space-y-3">
                <div>
                  <Label htmlFor="sync-login-pass">Entrar com senha</Label>
                  <Input
                    id="sync-login-pass"
                    type="password"
                    autoComplete="current-password"
                    value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                    placeholder="A senha que criou no telemóvel"
                    disabled={busy !== null || envLocked}
                    className="mt-1"
                  />
                </div>
                <Button type="submit" variant="secondary" disabled={busy !== null || envLocked || !loginPass}>
                  {busy === 'login' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Ligar esta conta
                </Button>
              </form>
            </div>
          </>
        )}

        {message ? (
          <p
            className={
              message.type === 'ok'
                ? 'text-sm text-emerald-400'
                : 'text-sm text-red-400'
            }
          >
            {message.text}
          </p>
        ) : null}

        <p className="text-[11px] leading-relaxed text-muted-foreground/80">
          A senha não substitui login bancário — só liga o ID de sync na nuvem Neon entre os seus aparelhos. Use
          uma senha que só você saiba.
        </p>
      </CardContent>
    </Card>
  )
}

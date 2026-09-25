import { useEffect, useState } from 'react';
import { sendEmailVerification, type SessionUser } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';

export function ProfileView({ user }: { user: SessionUser }) {
  const { t } = useI18n();
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(
      () => setResendIn((seconds) => Math.max(0, seconds - 1)),
      1_000
    );
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const handleResendVerification = async () => {
    setIsSending(true);
    setMessage(null);
    setError(null);
    try {
      await sendEmailVerification(user.email);
      setMessage(t('auth.profileVerificationCodeSent'));
      setResendIn(60);
    } catch {
      setError(t('auth.profileVerificationCodeSendError'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-text">Perfil de Usuario</h1>
          <p className="mt-1 text-sm text-text-dim">Gestiona tu cuenta y preferencias</p>
        </div>

        <div className="bg-panel border border-line rounded-lg p-6 space-y-4">
          <div>
            <label className="text-xs font-mono text-text-dim">Email</label>
            <p className="text-sm font-medium text-text mt-1">{user?.email}</p>
          </div>

          <div>
            <label className="text-xs font-mono text-text-dim">{t('auth.profileVerificationStatus')}</label>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  user?.emailVerified
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                    : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                }`}
              >
                {user?.emailVerified ? `✓ ${t('auth.profileVerified')}` : `⏳ ${t('auth.profilePendingVerification')}`}
              </span>
            </div>
          </div>

          {!user?.emailVerified && (
            <div className="pt-2">
              <button
                onClick={handleResendVerification}
                disabled={isSending || resendIn > 0}
                className="north-primary px-4 py-2 rounded-md bg-black text-white text-sm font-medium disabled:opacity-40"
              >
                {isSending
                  ? t('auth.profileSendingVerification')
                  : resendIn > 0
                    ? t('auth.resendCooldown', { seconds: resendIn })
                    : t('auth.profileResendVerificationCode')}
              </button>
              {message && (
                <p role="status" aria-live="polite" className="mt-2 text-sm text-text-dim">{message}</p>
              )}
              {error && (
                <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
            </div>
          )}
        </div>

        <div className="bg-panel border border-line rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-display font-semibold text-text">Información de la Cuenta</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono text-text-dim">Nombre</label>
              <p className="text-sm text-text mt-1">{user?.name || 'No especificado'}</p>
            </div>
            <div>
              <label className="text-xs font-mono text-text-dim">Rol</label>
              <p className="text-sm text-text mt-1">{user?.role}</p>
            </div>
            <div>
              <label className="text-xs font-mono text-text-dim">Miembro desde</label>
              <p className="text-sm text-text mt-1">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div>
              <label className="text-xs font-mono text-text-dim">Términos aceptados</label>
              <p className="text-sm text-text mt-1">
                {user?.termsAcceptedAt
                  ? new Date(user.termsAcceptedAt).toLocaleDateString()
                  : 'Pendiente'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

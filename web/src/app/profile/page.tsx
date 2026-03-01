'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { BackButton } from '@/components/BackButton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import styles from './profile.module.css';

type ProfileData = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type TwoFactorStatus = {
  enabled: boolean;
  configured: boolean;
};

type TwoFactorSetup = {
  secret: string;
  issuer: string;
  otpauthUrl: string;
};

type SessionItem = {
  id: string;
  tenantId: string;
  role: string;
  ip: string | null;
  userAgent: string | null;
  issuedAt: string;
  lastSeenAt: string | null;
  expiresAt: string;
  isCurrent: boolean;
};

function readMessage(raw: string, fallback: string) {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.message === 'string') return parsed.message;
  } catch {}
  return raw || fallback;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [twoFactor, setTwoFactor] = useState<TwoFactorStatus>({
    enabled: false,
    configured: false,
  });
  const [setup2fa, setSetup2fa] = useState<TwoFactorSetup | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingPassword, setSavingPassword] = useState(false);
  const [saving2fa, setSaving2fa] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadSecurityData() {
    setLoadingSessions(true);
    try {
      const [statusResp, sessionsResp] = await Promise.all([
        fetch('/api/auth/2fa/status', { cache: 'no-store' }),
        fetch('/api/auth/sessions', { cache: 'no-store' }),
      ]);

      const statusText = await statusResp.text().catch(() => '');
      if (!statusResp.ok) {
        throw new Error(
          readMessage(statusText, 'Não foi possível carregar status do 2FA'),
        );
      }
      setTwoFactor(JSON.parse(statusText) as TwoFactorStatus);

      const sessionsText = await sessionsResp.text().catch(() => '');
      if (!sessionsResp.ok) {
        throw new Error(
          readMessage(sessionsText, 'Não foi possível carregar sessões ativas'),
        );
      }
      setSessions(JSON.parse(sessionsText) as SessionItem[]);
    } finally {
      setLoadingSessions(false);
    }
  }

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const resp = await fetch('/api/users/me', { cache: 'no-store' });
        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          throw new Error(readMessage(text, 'Não foi possível carregar perfil'));
        }
        const data = (await resp.json()) as ProfileData;
        setProfile(data);

        await loadSecurityData();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Não foi possível carregar perfil');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function submit() {
    setSavingPassword(true);
    setError('');
    setSuccess('');
    try {
      const resp = await fetch('/api/users/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const text = await resp.text().catch(() => '');
      if (!resp.ok) throw new Error(readMessage(text, 'Não foi possível alterar senha'));
      const data = text ? (JSON.parse(text) as { message?: string }) : {};
      setSuccess(data?.message || 'Senha alterada com sucesso');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Não foi possível alterar senha');
    } finally {
      setSavingPassword(false);
    }
  }

  async function setupTwoFactor() {
    setSaving2fa(true);
    setError('');
    setSuccess('');
    try {
      const resp = await fetch('/api/auth/2fa/setup', { method: 'POST' });
      const text = await resp.text().catch(() => '');
      if (!resp.ok) throw new Error(readMessage(text, 'Não foi possível configurar 2FA'));
      const data = JSON.parse(text) as TwoFactorSetup;
      setSetup2fa(data);
      setSuccess('2FA configurado. Valide com o código do app autenticador.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Não foi possível configurar 2FA');
    } finally {
      setSaving2fa(false);
    }
  }

  async function enableTwoFactor() {
    if (!twoFactorCode.trim()) {
      setError('Informe o código de 6 dígitos para ativar o 2FA.');
      return;
    }
    setSaving2fa(true);
    setError('');
    setSuccess('');
    try {
      const resp = await fetch('/api/auth/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: twoFactorCode.trim() }),
      });
      const text = await resp.text().catch(() => '');
      if (!resp.ok) throw new Error(readMessage(text, 'Não foi possível ativar 2FA'));
      setSuccess(readMessage(text, '2FA ativado com sucesso'));
      setTwoFactorCode('');
      setSetup2fa(null);
      await loadSecurityData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Não foi possível ativar 2FA');
    } finally {
      setSaving2fa(false);
    }
  }

  async function disableTwoFactor() {
    if (!twoFactorCode.trim()) {
      setError('Informe o código de 6 dígitos para desativar o 2FA.');
      return;
    }
    setSaving2fa(true);
    setError('');
    setSuccess('');
    try {
      const resp = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: twoFactorCode.trim() }),
      });
      const text = await resp.text().catch(() => '');
      if (!resp.ok) throw new Error(readMessage(text, 'Não foi possível desativar 2FA'));
      setSuccess(readMessage(text, '2FA desativado com sucesso'));
      setTwoFactorCode('');
      setSetup2fa(null);
      await loadSecurityData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Não foi possível desativar 2FA');
    } finally {
      setSaving2fa(false);
    }
  }

  async function revokeSession(sessionId: string) {
    setError('');
    setSuccess('');
    try {
      const resp = await fetch(`/api/auth/sessions/${sessionId}`, { method: 'DELETE' });
      const text = await resp.text().catch(() => '');
      if (!resp.ok) {
        throw new Error(readMessage(text, 'Não foi possível encerrar sessão'));
      }
      setSuccess(readMessage(text, 'Sessão encerrada com sucesso'));
      await loadSecurityData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Não foi possível encerrar sessão');
    }
  }

  async function revokeOtherSessions() {
    setError('');
    setSuccess('');
    try {
      const resp = await fetch('/api/auth/sessions', { method: 'DELETE' });
      const text = await resp.text().catch(() => '');
      if (!resp.ok) {
        throw new Error(readMessage(text, 'Não foi possível encerrar outras sessões'));
      }
      let successMessage = 'Outras sessões encerradas com sucesso';
      try {
        const parsed = JSON.parse(text) as { revoked?: number; message?: string };
        if (typeof parsed?.message === 'string' && parsed.message.trim()) {
          successMessage = parsed.message;
        } else if (typeof parsed?.revoked === 'number') {
          successMessage = `${parsed.revoked} sessão(ões) encerrada(s).`;
        }
      } catch {
        successMessage = readMessage(text, successMessage);
      }
      setSuccess(successMessage);
      await loadSecurityData();
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : 'Não foi possível encerrar outras sessões',
      );
    }
  }

  function formatDate(value: string | null) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('pt-BR');
  }

  return (
    <main className={`${styles.page} appPageShell`}>
      <SectionHeader
        title="Perfil"
        description="Dados da conta e alteração de senha."
        headingAs="h1"
        className={styles.header}
        actions={<BackButton fallbackHref="/dashboard" className={styles.backLink} />}
      />

      <section className={styles.card}>
        {loading ? (
          <div>Carregando...</div>
        ) : (
          <>
            <div className={styles.sectionTitle}>Dados da conta</div>
            <div className={styles.grid}>
              <label className={styles.field}>
                <span>Nome completo</span>
                <input className={styles.input} value={profile?.name || ''} disabled />
              </label>
              <label className={styles.field}>
                <span>E-mail</span>
                <input className={styles.input} value={profile?.email || ''} disabled />
              </label>
            </div>

            <div className={styles.sectionTitle}>Alteração de senha</div>
            <div className={styles.grid}>
              <label className={styles.field}>
                <span>Senha atual</span>
                <input
                  type="password"
                  className={styles.input}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>Nova senha</span>
                <input
                  type="password"
                  className={styles.input}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>Confirmar nova senha</span>
                <input
                  type="password"
                  className={styles.input}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </label>
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.button}
                onClick={submit}
                disabled={loading || savingPassword}
              >
                {savingPassword ? 'Salvando...' : 'Alterar senha'}
              </button>
            </div>

            <div className={styles.sectionTitle}>Autenticação em dois fatores (2FA)</div>
            <div className={styles.twoFactorRow}>
              <span className={styles.badge}>
                {twoFactor.enabled ? '2FA ativo' : '2FA desativado'}
              </span>
              {!twoFactor.enabled ? (
                <button
                  type="button"
                  className={styles.button}
                  onClick={setupTwoFactor}
                  disabled={saving2fa}
                >
                  {saving2fa ? 'Configurando...' : 'Configurar 2FA'}
                </button>
              ) : null}
            </div>

            {setup2fa ? (
              <div className={styles.setupCard}>
                <div className={styles.setupHint}>
                  Escaneie no app autenticador e confirme com o código de 6 dígitos.
                </div>
                <div className={styles.qrWrap}>
                  <Image
                    className={styles.qrImage}
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                      setup2fa.otpauthUrl,
                    )}`}
                    alt="QR Code para configurar 2FA"
                    width={220}
                    height={220}
                    unoptimized
                  />
                </div>
                <label className={styles.field}>
                  <span>Chave secreta</span>
                  <input className={styles.input} value={setup2fa.secret} readOnly />
                </label>
                <label className={styles.field}>
                  <span>Link OTP</span>
                  <input className={styles.input} value={setup2fa.otpauthUrl} readOnly />
                </label>
              </div>
            ) : null}

            {(setup2fa || twoFactor.enabled) ? (
              <div className={styles.twoFactorActions}>
                <label className={styles.field}>
                  <span>Código 2FA</span>
                  <input
                    className={styles.input}
                    value={twoFactorCode}
                    onChange={(e) =>
                      setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    placeholder="000000"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                </label>
                {!twoFactor.enabled ? (
                  <button
                    type="button"
                    className={styles.button}
                    onClick={enableTwoFactor}
                    disabled={saving2fa}
                  >
                    {saving2fa ? 'Ativando...' : 'Ativar 2FA'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.dangerButton}
                    onClick={disableTwoFactor}
                    disabled={saving2fa}
                  >
                    {saving2fa ? 'Desativando...' : 'Desativar 2FA'}
                  </button>
                )}
              </div>
            ) : null}

            <div className={styles.sectionTitle}>Sessões ativas</div>
            <div className={styles.sessionTopActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={revokeOtherSessions}
                disabled={loadingSessions}
              >
                Encerrar outras sessões
              </button>
            </div>
            <div className={styles.sessionsList}>
              {sessions.length ? (
                sessions.map((session) => (
                  <div key={session.id} className={styles.sessionCard}>
                    <div className={styles.sessionMain}>
                      <div className={styles.sessionMetaLine}>
                        <strong>{session.isCurrent ? 'Sessão atual' : 'Sessão ativa'}</strong>
                        <span>{session.role}</span>
                        <span>{session.ip || 'IP não disponível'}</span>
                      </div>
                      <div className={styles.sessionMetaLine}>
                        <span>Início: {formatDate(session.issuedAt)}</span>
                        <span>Último acesso: {formatDate(session.lastSeenAt)}</span>
                        <span>Expira: {formatDate(session.expiresAt)}</span>
                      </div>
                      <div className={styles.sessionUserAgent}>
                        {session.userAgent || 'User-Agent não informado'}
                      </div>
                    </div>
                    {!session.isCurrent ? (
                      <button
                        type="button"
                        className={styles.dangerButton}
                        onClick={() => void revokeSession(session.id)}
                      >
                        Encerrar
                      </button>
                    ) : (
                      <span className={styles.badge}>Atual</span>
                    )}
                  </div>
                ))
              ) : (
                <div className={styles.empty}>Nenhuma sessão ativa encontrada.</div>
              )}
            </div>
          </>
        )}

        {error ? <div className={styles.error}>{error}</div> : null}
        {success ? <div className={styles.success}>{success}</div> : null}
      </section>
    </main>
  );
}

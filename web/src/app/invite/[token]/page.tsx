 'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './invite.module.css';
import { Card } from '@/components/ui/Card';
import { UIButton } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/SectionHeader';

type InviteInfo = {
  email: string;
  fullName?: string;
  role: string;
  tenant: { id: string; name: string };
  expiresAt: string;
};

export default function InvitePage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params?.token;

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;

    fetch(`/api/invites/${token}`)
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(body?.message || 'Convite inválido.');
        }
        return body;
      })
      .then((data) => {
        if (!active) return;
        setInfo(data);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Convite inválido.');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  const handleAccept = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      if (password !== confirmPassword) {
        throw new Error('As senhas não conferem.');
      }
      const resp = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const body = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(body?.message || 'Não foi possível aceitar o convite.');

      router.replace('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não foi possível aceitar o convite.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className={styles.page}>
        <Card className={styles.card}>Carregando convite...</Card>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <Card className={styles.card} padding="lg">
        <div className={styles.inviteBrand}>LexFlow</div>
        <SectionHeader
          title="Aceitar convite"
          description="Finalize seu acesso ao escritório e defina sua senha."
          className={styles.header}
        />
        {error && <div className={styles.error}>{error}</div>}

        {info && (
          <>
            <div className={styles.meta}>
              <div><strong>Escritório:</strong> {info.tenant.name}</div>
              <div><strong>Nome:</strong> {info.fullName || info.email.split('@')[0]}</div>
              <div><strong>Email:</strong> {info.email}</div>
            </div>

            <form className={styles.form} onSubmit={handleAccept} suppressHydrationWarning>
              <label className={styles.field}>
                <span>Senha</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  required
                />
              </label>
              <label className={styles.field}>
                <span>Confirmar senha</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                  minLength={6}
                  required
                />
              </label>

              <UIButton className={styles.primaryButton} variant="primary" type="submit" disabled={submitting}>
                Aceitar convite
              </UIButton>
            </form>
          </>
        )}

        <Link href="/login" className={styles.backLink}>Ir para login</Link>
      </Card>
    </main>
  );
}

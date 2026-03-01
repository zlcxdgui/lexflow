'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';
import { Card } from '@/components/ui/Card';
import { UIButton } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/SectionHeader';

function extractMessage(raw: string, status: number): string {
  if (!raw) return `Erro ${status}`;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.message)) return parsed.message[0] || `Erro ${status}`;
    if (typeof parsed?.message === 'string') return parsed.message;
    if (typeof parsed?.detail === 'string') return parsed.detail;
    return `Erro ${status}`;
  } catch {
    return raw;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('gui7@teste.com');
  const [password, setPassword] = useState('123456');
  const [totpCode, setTotpCode] = useState('');
  const [showTotp, setShowTotp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ Se o usuário já tem cookie HttpOnly, a página pode existir mas não faz sentido ficar aqui.
  // Vamos tentar carregar /dashboard direto (server vai validar).
  useEffect(() => {
    // isso evita ficar parado no login caso já esteja autenticado
    // (se não estiver, o dashboard mostra "Sessão expirada" e botão login)
    // Se você preferir não redirecionar automático, pode remover esse bloco.
    // router.replace('/dashboard');
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          email,
          password,
          totpCode: showTotp ? totpCode.trim() || undefined : undefined,
        }),
      });

      if (!resp.ok) {
        const t = await resp.text().catch(() => '');
        const message = extractMessage(t, resp.status);
        const lower = message.toLowerCase();
        const needs2fa =
          lower.includes('2fa') || lower.includes('código 2fa inválido');
        if (needs2fa) {
          setShowTotp(true);
          if (!totpCode.trim()) {
            throw new Error('Informe o código 2FA para continuar.');
          }
        }
        throw new Error(message);
      }

      router.replace('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.container}>
      <Card className={styles.loginCard} padding="lg">
        <div className={styles.loginBrand}>LexFlow</div>
        <SectionHeader
          title="Entrar"
          description="Acesse o painel do escritório com segurança."
          className={styles.header}
        />

        <form onSubmit={onSubmit} className={styles.form} suppressHydrationWarning>
          <label className={styles.label}>
            <span className={styles.labelText}>Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className={styles.input}
              suppressHydrationWarning
            />
          </label>

          <label className={styles.label}>
            <span className={styles.labelText}>Senha</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className={styles.input}
              suppressHydrationWarning
            />
          </label>

          {showTotp ? (
            <label className={styles.label}>
              <span className={styles.labelText}>Código 2FA</span>
              <input
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className={styles.input}
                inputMode="numeric"
                autoComplete="one-time-code"
                suppressHydrationWarning
              />
            </label>
          ) : null}

          {error && (
            <div className={styles.error}>
              <span className={styles.errorText}>{error}</span>
            </div>
          )}

          <UIButton type="submit" variant="primary" disabled={loading} className={styles.submitBtn}>
            {loading ? 'Entrando...' : 'Entrar'}
          </UIButton>
        </form>
      </Card>
    </main>
  );
}

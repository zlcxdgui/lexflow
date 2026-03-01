'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { emitBillingToast } from './BillingToast';
import styles from './billing.module.css';

function getErrorMessage(body: unknown, fallback: string) {
  if (typeof body === 'object' && body !== null) {
    const parsed = body as { message?: unknown; detail?: unknown };
    if (Array.isArray(parsed.message) && parsed.message[0]) return String(parsed.message[0]);
    if (typeof parsed.message === 'string') return parsed.message;
    if (typeof parsed.detail === 'string') return parsed.detail;
  }
  return fallback;
}

export function BillingPlanButton({
  planKey,
  isCurrent,
  billingCycle = 'MONTHLY',
}: {
  planKey: string;
  isCurrent: boolean;
  billingCycle?: 'MONTHLY' | 'YEARLY';
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSelect() {
    if (isCurrent || loading) return;
    setLoading(true);
    try {
      const resp = await fetch('/api/billing/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey, billingCycle }),
      });
      const body = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(getErrorMessage(body, 'Não foi possível alterar o plano.'));
      emitBillingToast({ message: 'Plano alterado com sucesso.', tone: 'success' });
      router.refresh();
    } catch (error) {
      emitBillingToast({
        message: error instanceof Error ? error.message : 'Não foi possível alterar o plano.',
        tone: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  if (isCurrent) {
    return (
      <button type="button" className={styles.ghostButton} disabled>
        Plano atual
      </button>
    );
  }

  return (
    <button type="button" className={styles.primaryButton} onClick={handleSelect} disabled={loading}>
      {loading ? 'Aplicando...' : 'Selecionar plano'}
    </button>
  );
}

export function BillingCancelButton({
  cancelAtPeriodEnd,
}: {
  cancelAtPeriodEnd: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    if (loading) return;
    setLoading(true);
    try {
      const resp = await fetch('/api/billing/cancel-at-period-end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelAtPeriodEnd: !cancelAtPeriodEnd }),
      });
      const body = await resp.json().catch(() => null);
      if (!resp.ok) {
        throw new Error(
          getErrorMessage(
            body,
            'Não foi possível atualizar o cancelamento no fim do período.',
          ),
        );
      }
      emitBillingToast({
        message: !cancelAtPeriodEnd
          ? 'Cancelamento no fim do período ativado.'
          : 'Renovação automática reativada.',
        tone: 'success',
      });
      router.refresh();
    } catch (error) {
      emitBillingToast({
        message:
          error instanceof Error
            ? error.message
            : 'Não foi possível atualizar o cancelamento no fim do período.',
        tone: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" className={styles.ghostButton} onClick={handleToggle} disabled={loading}>
      {loading
        ? 'Salvando...'
        : cancelAtPeriodEnd
          ? 'Reativar renovação automática'
          : 'Cancelar no fim do período'}
    </button>
  );
}

export function BillingRequestButton({
  planKey,
  isCurrent,
}: {
  planKey: string;
  isCurrent: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRequest() {
    if (isCurrent || loading) return;
    setLoading(true);
    try {
      const resp = await fetch('/api/billing/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey, billingCycle: 'MONTHLY' }),
      });
      const body = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(getErrorMessage(body, 'Não foi possível solicitar upgrade.'));
      emitBillingToast({
        message: 'Solicitação enviada para o administrador da plataforma.',
        tone: 'success',
      });
      router.refresh();
    } catch (error) {
      emitBillingToast({
        message: error instanceof Error ? error.message : 'Não foi possível solicitar upgrade.',
        tone: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className={isCurrent ? styles.ghostButton : styles.primaryButton}
      disabled={isCurrent || loading}
      onClick={handleRequest}
      title={isCurrent ? 'Plano atual do escritório' : undefined}
    >
      {isCurrent ? 'Plano atual' : loading ? 'Enviando...' : 'Solicitar upgrade'}
    </button>
  );
}

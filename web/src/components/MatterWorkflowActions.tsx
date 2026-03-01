'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './MatterWorkflowActions.module.css';

function extractMessage(raw: string, fallback: string) {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.message === 'string') return parsed.message;
    if (Array.isArray(parsed?.message) && parsed.message.length) return String(parsed.message[0]);
  } catch {}
  return raw || fallback;
}

export function TaskStatusAction({
  taskId,
  currentStatus,
}: {
  taskId: string;
  currentStatus: 'OPEN' | 'DOING' | 'DONE';
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextStatus = currentStatus === 'DONE' ? 'OPEN' : 'DONE';
  const label = currentStatus === 'DONE' ? 'Reabrir' : 'Concluir';

  async function handle() {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(extractMessage(txt, 'Falha ao atualizar tarefa'));
      }
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar tarefa');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.button} disabled={loading} onClick={handle}>
        {loading ? 'Salvando...' : label}
      </button>
      {error ? <span className={styles.error}>{error}</span> : null}
    </div>
  );
}

export function DeadlineDoneAction({
  deadlineId,
  isDone,
}: {
  deadlineId: string;
  isDone: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle() {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/deadlines/${deadlineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDone: !isDone }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(extractMessage(txt, 'Falha ao atualizar prazo'));
      }
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar prazo');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.button} disabled={loading} onClick={handle}>
        {loading ? 'Salvando...' : isDone ? 'Reabrir' : 'Concluir'}
      </button>
      {error ? <span className={styles.error}>{error}</span> : null}
    </div>
  );
}

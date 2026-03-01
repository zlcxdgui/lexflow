'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './CreateTaskForm.module.css';
import { UISelect } from './ui/Select';

type UserMember = {
  id: string;
  role: string;
  user: { id: string; name: string; email: string };
};

export function CreateTaskForm({
  matterId,
  onCreated,
}: {
  matterId: string;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserMember[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const formErrorId = 'create-task-form-error';

  useEffect(() => {
    (async () => {
      setUsersLoading(true);
      try {
        const usersResp = await fetch('/api/users', { cache: 'no-store' });
        if (!usersResp.ok) return;
        const data = await usersResp.json().catch(() => []);
        const list = Array.isArray(data) ? data : [];
        setUsers(list);
      } catch {}
      finally {
        setUsersLoading(false);
      }
    })();
  }, []);

  const extractMessage = (raw: string, fallback: string) => {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.message === 'string') return parsed.message;
      if (Array.isArray(parsed?.message) && parsed.message.length) return String(parsed.message[0]);
    } catch {}
    return raw || fallback;
  };

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));

    try {
      const resp = await fetch(`/api/matters/${matterId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          description: data.description || null,
          priority: data.priority,
          dueDate: data.dueDate || null,
          assignedToUserId: data.assignedToUserId || null,
        }),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(extractMessage(txt, 'Erro ao criar tarefa'));
      }

      form.reset();
      if (onCreated) onCreated();
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar tarefa');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className={styles.form} suppressHydrationWarning>
      <div className={styles.grid2}>
        <label className={styles.field}>
          <span>Título da tarefa</span>
          <input name="title" placeholder="Ex: Revisar inicial" required className={styles.input} />
        </label>

          <label className={styles.field}>
            <span>Prioridade</span>
            <UISelect
              name="priority"
              defaultValue="MEDIUM"
              className={styles.select}
              ariaLabel="Prioridade"
              ariaDescribedBy={error ? formErrorId : undefined}
              options={[
                { value: 'LOW', label: 'Baixa' },
                { value: 'MEDIUM', label: 'Média' },
                { value: 'HIGH', label: 'Alta' },
              ]}
            />
          </label>

        <label className={styles.field}>
          <span>Data de vencimento</span>
          <input type="date" name="dueDate" className={styles.input} />
        </label>

          <label className={styles.field}>
            <span>Responsável</span>
            <UISelect
              name="assignedToUserId"
              defaultValue=""
              className={styles.select}
              ariaLabel="Responsável"
              ariaDescribedBy={error ? formErrorId : undefined}
              loading={usersLoading}
              loadingLabel="Carregando usuários..."
              options={[
                { value: '', label: 'Sem responsável' },
                ...users.map((member) => ({
                  value: member.user.id,
                  label: `${member.user.name} (${member.user.email})`,
                })),
              ]}
            />
          </label>

        <label className={`${styles.field} ${styles.full}`}>
          <span>Descrição</span>
          <textarea name="description" placeholder="Descrição (opcional)" className={styles.textarea} />
        </label>
      </div>

      {error && <div id={formErrorId} className={styles.error}>{error}</div>}

      <button disabled={loading} className={`${styles.button} ${loading ? styles.buttonDisabled : ''}`}>
        {loading ? 'Salvando...' : 'Criar tarefa'}
      </button>
    </form>
  );
}

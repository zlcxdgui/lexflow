'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './CreateTaskForm.module.css';
import { UISelect } from './ui/Select';

function extractMessage(raw: string, fallback: string) {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.message === 'string') return parsed.message;
    if (Array.isArray(parsed?.message) && parsed.message.length) return String(parsed.message[0]);
  } catch {}
  return raw || fallback;
}

export function CreateDeadlineForm({ matterId }: { matterId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formErrorId = 'create-deadline-form-error';

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));

    try {
      const resp = await fetch(`/api/matters/${matterId}/deadlines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          type: data.type || 'GENERIC',
          dueDate: data.dueDate,
          notes: data.notes || null,
        }),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(extractMessage(txt, 'Erro ao criar prazo'));
      }

      form.reset();
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar prazo');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className={styles.form} suppressHydrationWarning>
      <div className={styles.grid2}>
        <label className={styles.field}>
          <span>Título do prazo</span>
          <input name="title" placeholder="Ex: Prazo para contestação" required className={styles.input} />
        </label>

          <label className={styles.field}>
            <span>Tipo</span>
            <UISelect
              name="type"
              defaultValue="GENERIC"
              className={styles.select}
              ariaLabel="Tipo"
              ariaDescribedBy={error ? formErrorId : undefined}
              options={[
                { value: 'GENERIC', label: 'Genérico' },
                { value: 'HEARING', label: 'Audiência' },
                { value: 'FILING', label: 'Protocolo' },
                { value: 'APPEAL', label: 'Recurso' },
                { value: 'PAYMENT', label: 'Pagamento' },
              ]}
            />
          </label>

        <label className={styles.field}>
          <span>Data de vencimento</span>
          <input type="date" name="dueDate" required className={styles.input} />
        </label>

        <label className={`${styles.field} ${styles.full}`}>
          <span>Observações</span>
          <textarea name="notes" placeholder="Observações (opcional)" className={styles.textarea} />
        </label>
      </div>

      {error ? <div id={formErrorId} className={styles.error}>{error}</div> : null}

      <button disabled={loading} className={`${styles.button} ${loading ? styles.buttonDisabled : ''}`}>
        {loading ? 'Salvando...' : 'Criar prazo'}
      </button>
    </form>
  );
}

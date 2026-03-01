'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './TaskCrudActions.module.css';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { ModalFrame } from './ui/ModalFrame';

type DeadlineData = {
  id: string;
  title: string;
  type: string;
  dueDate: string;
  notes: string | null;
  isDone: boolean;
};

function parseMessage(raw: string, fallback: string) {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.message === 'string') return parsed.message;
    if (Array.isArray(parsed?.message) && parsed.message.length) return String(parsed.message[0]);
  } catch {}
  return raw || fallback;
}

export function DeadlineCrudActions({
  deadline,
  canEdit = true,
  canDelete = true,
}: {
  deadline: DeadlineData;
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<null | 'edit' | 'delete'>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: deadline.title,
    type: deadline.type,
    dueDate: String(deadline.dueDate).slice(0, 10),
    notes: deadline.notes || '',
    isDone: deadline.isDone,
  });

  async function saveEdit() {
    setSaving(true);
    setError('');
    try {
      const resp = await fetch(`/api/deadlines/${deadline.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          type: form.type,
          dueDate: form.dueDate,
          notes: form.notes || null,
          isDone: form.isDone,
        }),
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(parseMessage(txt, 'Não foi possível atualizar prazo'));
      }
      setMode(null);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar prazo');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setSaving(true);
    setError('');
    try {
      const resp = await fetch(`/api/deadlines/${deadline.id}`, { method: 'DELETE' });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(parseMessage(txt, 'Não foi possível excluir prazo'));
      }
      setMode(null);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir prazo');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {canEdit ? (
        <button type="button" className={styles.btn} onClick={() => setMode('edit')}>Editar</button>
      ) : null}
      {canDelete ? (
        <button type="button" className={`${styles.btn} ${styles.danger}`} onClick={() => setMode('delete')}>Excluir</button>
      ) : null}

      {mode === 'edit' ? (
        <ModalFrame open onClose={() => setMode(null)}>
          <div>
            <>
              <h3 className={styles.title}>Editar prazo</h3>
              <p className={styles.subtitle}>Atualize os dados do prazo e salve para aplicar as mudanças.</p>
              <div className={styles.form}>
                <input className={styles.input} value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
                <input className={styles.input} value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} />
                <input type="date" className={styles.input} value={form.dueDate} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} />
                <textarea className={styles.input} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
                <label className={styles.check}>
                  <input type="checkbox" checked={form.isDone} onChange={(e) => setForm((p) => ({ ...p, isDone: e.target.checked }))} />
                  Concluído
                </label>
              </div>
            </>
            {error ? <div className={styles.error}>{error}</div> : null}
            <div className={styles.actions}>
              <button className={styles.btn} onClick={() => setMode(null)} disabled={saving}>Cancelar</button>
              <button className={styles.btnPrimary} onClick={saveEdit} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </ModalFrame>
      ) : null}

      <ConfirmDialog
        open={mode === 'delete'}
        title="Excluir prazo"
        description={
          <>
            Essa ação é permanente e não pode ser desfeita.
            <br />
            Confirma excluir o prazo <b>{deadline.title}</b>?
          </>
        }
        confirmLabel={saving ? 'Excluindo...' : 'Excluir'}
        confirmTone="danger"
        busy={saving}
        error={mode === 'delete' ? error : ''}
        onClose={() => setMode(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}

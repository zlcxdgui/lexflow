'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './TaskCrudActions.module.css';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { ModalFrame } from './ui/ModalFrame';
import { UISelect } from './ui/Select';

type UserMember = {
  id: string;
  role: string;
  user: { id: string; name: string; email: string };
};

type TaskData = {
  id: string;
  title: string;
  description?: string | null;
  status: 'OPEN' | 'DOING' | 'DONE' | 'CANCELED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate?: string | null;
  assignedTo?: { id: string; name: string; email: string } | null;
};

function isAppointmentTask(task: TaskData, endpointBase: string) {
  return (
    endpointBase.includes('/appointments') ||
    String(task.title || '').trim().toLowerCase().startsWith('atendimento')
  );
}

function toDateInputValue(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toTimeInputValue(iso?: string | null) {
  if (!iso) return '09:00';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '09:00';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function toLocalIso(date: string, time: string) {
  const safeTime = time || '09:00';
  return new Date(`${date}T${safeTime}:00`).toISOString();
}

function parseMessage(raw: string, fallback: string) {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.message === 'string') return parsed.message;
    if (Array.isArray(parsed?.message) && parsed.message.length) return String(parsed.message[0]);
  } catch {}
  return raw || fallback;
}

export function TaskCrudActions({
  task,
  canEdit = true,
  canDelete = true,
  endpointBase = '/api/tasks',
}: {
  task: TaskData;
  canEdit?: boolean;
  canDelete?: boolean;
  endpointBase?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<null | 'edit' | 'delete'>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState<UserMember[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const modalErrorId = `task-crud-error-${task.id}`;
  const isAppointment = isAppointmentTask(task, endpointBase);

  const [form, setForm] = useState({
    title: task.title,
    description: task.description || '',
    status: task.status,
    priority: task.priority,
    dueDate: toDateInputValue(task.dueDate),
    dueTime: toTimeInputValue(task.dueDate),
    assignedToUserId: task.assignedTo?.id || '',
  });

  useEffect(() => {
    if (mode !== 'edit') return;
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
  }, [mode]);

  async function saveEdit() {
    setSaving(true);
    setError('');
    try {
      const dueDatePayload = form.dueDate
        ? isAppointment
          ? toLocalIso(form.dueDate, form.dueTime)
          : form.dueDate
        : null;

      const resp = await fetch(`${endpointBase}/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          status: form.status,
          priority: form.priority,
          dueDate: dueDatePayload,
          assignedToUserId: form.assignedToUserId || null,
        }),
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(parseMessage(txt, 'Não foi possível atualizar tarefa'));
      }
      setMode(null);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar tarefa');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setSaving(true);
    setError('');
    try {
      const resp = await fetch(`${endpointBase}/${task.id}`, { method: 'DELETE' });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(parseMessage(txt, 'Não foi possível excluir tarefa'));
      }
      setMode(null);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir tarefa');
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
              <h3 className={styles.title}>{isAppointment ? 'Editar atendimento' : 'Editar tarefa'}</h3>
              <p className={styles.subtitle}>
                {isAppointment
                  ? 'Atualize os dados do atendimento e salve para aplicar as mudanças.'
                  : 'Atualize os dados da tarefa e salve para aplicar as mudanças.'}
              </p>
              <div className={styles.form}>
                <input className={styles.input} value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
                <textarea className={styles.input} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
                <UISelect
                  className={styles.input}
                  value={form.status}
                  ariaLabel="Status da tarefa"
                  ariaDescribedBy={error ? modalErrorId : undefined}
                  onChange={(value) => setForm((p) => ({ ...p, status: value as TaskData['status'] }))}
                  options={[
                    { value: 'OPEN', label: 'Aberta' },
                    { value: 'DOING', label: 'Em andamento' },
                    { value: 'DONE', label: 'Concluída' },
                    { value: 'CANCELED', label: 'Cancelada' },
                  ]}
                />
                <UISelect
                  className={styles.input}
                  value={form.priority}
                  ariaLabel="Prioridade da tarefa"
                  ariaDescribedBy={error ? modalErrorId : undefined}
                  onChange={(value) => setForm((p) => ({ ...p, priority: value as TaskData['priority'] }))}
                  options={[
                    { value: 'LOW', label: 'Baixa' },
                    { value: 'MEDIUM', label: 'Média' },
                    { value: 'HIGH', label: 'Alta' },
                  ]}
                />
                <input type="date" className={styles.input} value={form.dueDate} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} />
                {isAppointment ? (
                  <input
                    type="time"
                    className={styles.input}
                    value={form.dueTime}
                    onChange={(e) => setForm((p) => ({ ...p, dueTime: e.target.value }))}
                  />
                ) : null}
                  <UISelect
                    className={styles.input}
                    value={form.assignedToUserId}
                    ariaLabel="Responsável"
                    ariaDescribedBy={error ? modalErrorId : undefined}
                    loading={usersLoading}
                    loadingLabel="Carregando usuários..."
                    onChange={(value) => setForm((p) => ({ ...p, assignedToUserId: value }))}
                    options={[
                      { value: '', label: 'Sem responsável' },
                      ...users.map((member) => ({
                        value: member.user.id,
                        label: `${member.user.name} (${member.user.email})`,
                      })),
                    ]}
                  />
              </div>
            </>
            {error ? <div id={modalErrorId} className={styles.error}>{error}</div> : null}
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
        title={isAppointment ? 'Excluir atendimento' : 'Excluir tarefa'}
        description={
          <>
            Essa ação é permanente e não pode ser desfeita.
            <br />
            Confirma excluir <b>{task.title}</b>?
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

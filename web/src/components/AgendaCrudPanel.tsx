'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TaskCrudActions } from './TaskCrudActions';
import { DeadlineCrudActions } from './DeadlineCrudActions';
import { UISelect } from './ui/Select';
import styles from './AgendaCrudPanel.module.css';

type MatterOption = {
  id: string;
  title: string;
};

type TaskItem = {
  id: string;
  title: string;
  description?: string | null;
  status: 'OPEN' | 'DOING' | 'DONE' | 'CANCELED' | string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | string;
  dueDate?: string | null;
  matter?: { id: string; title: string } | null;
  assignedTo?: { id: string; name: string; email: string } | null;
};

type DeadlineItem = {
  id: string;
  title: string;
  type: string;
  dueDate: string;
  notes?: string | null;
  isDone: boolean;
  matter?: { id: string; title: string } | null;
};

function parseErrorText(raw: string, fallback: string) {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.message === 'string') return parsed.message;
    if (Array.isArray(parsed?.message) && parsed.message.length)
      return String(parsed.message[0]);
  } catch {}
  return raw || fallback;
}

export function AgendaCrudPanel({
  tasks,
  deadlines,
  matters,
}: {
  tasks: TaskItem[];
  deadlines: DeadlineItem[];
  matters: MatterOption[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'' | 'task' | 'deadline'>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const formErrorId = 'agenda-crud-panel-error';

  const sortedMatters = useMemo(
    () => [...matters].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')),
    [matters],
  );

  async function createTask(form: HTMLFormElement) {
    const data = Object.fromEntries(new FormData(form));
    const resp = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matterId: data.matterId || null,
        title: data.title,
        description: data.description || null,
        priority: data.priority,
        dueDate: data.dueDate || null,
        assignedToUserId: null,
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error(parseErrorText(txt, 'Não foi possível criar tarefa.'));
    }
  }

  async function createDeadline(form: HTMLFormElement) {
    const data = Object.fromEntries(new FormData(form));
    if (!data.matterId) {
      throw new Error('Selecione um caso para criar o prazo.');
    }
    const resp = await fetch(`/api/matters/${String(data.matterId)}/deadlines`, {
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
      const txt = await resp.text().catch(() => '');
      throw new Error(parseErrorText(txt, 'Não foi possível criar prazo.'));
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const form = e.currentTarget;
      if (mode === 'task') await createTask(form);
      if (mode === 'deadline') await createDeadline(form);
      setMode('');
      form.reset();
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>Ações da agenda</h2>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              setError('');
              setMode('task');
            }}
          >
            Nova tarefa
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              setError('');
              setMode('deadline');
            }}
          >
            Novo prazo
          </button>
        </div>
      </div>

      {mode ? (
        <form className={styles.form} onSubmit={handleSubmit} suppressHydrationWarning>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span>Título</span>
              <input name="title" required placeholder="Informe o título" />
            </label>
              <label className={styles.field}>
                <span>Caso vinculado</span>
                <UISelect
                  name="matterId"
                  defaultValue=""
                  className={styles.fieldSelect}
                  ariaLabel="Caso vinculado"
                  ariaDescribedBy={error ? formErrorId : undefined}
                  options={[
                    { value: '', label: 'Sem caso vinculado' },
                    ...sortedMatters.map((matter) => ({ value: matter.id, label: matter.title })),
                  ]}
                />
              </label>
            {mode === 'task' ? (
              <>
                  <label className={styles.field}>
                    <span>Prioridade</span>
                    <UISelect
                      name="priority"
                      defaultValue="MEDIUM"
                      className={styles.fieldSelect}
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
                  <span>Vencimento</span>
                  <input type="date" name="dueDate" />
                </label>
                <label className={`${styles.field} ${styles.full}`}>
                  <span>Descrição</span>
                  <textarea name="description" rows={3} />
                </label>
              </>
            ) : (
              <>
                  <label className={styles.field}>
                    <span>Tipo</span>
                    <UISelect
                      name="type"
                      defaultValue="GENERIC"
                      className={styles.fieldSelect}
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
                  <span>Vencimento</span>
                  <input type="date" name="dueDate" required />
                </label>
                <label className={`${styles.field} ${styles.full}`}>
                  <span>Observações</span>
                  <textarea name="notes" rows={3} />
                </label>
              </>
            )}
          </div>
          {error ? <div id={formErrorId} className={styles.error}>{error}</div> : null}
          <div className={styles.formActions}>
            <button type="button" className={styles.btnGhost} onClick={() => setMode('')}>
              Cancelar
            </button>
            <button type="submit" className={styles.btn} disabled={saving}>
              {saving ? 'Salvando...' : mode === 'task' ? 'Criar tarefa' : 'Criar prazo'}
            </button>
          </div>
        </form>
      ) : null}

      <div className={styles.twoCols}>
        <div>
          <h3 className={styles.blockTitle}>Tarefas</h3>
          <div className={styles.list}>
            {tasks.slice(0, 8).map((task) => (
              <div key={task.id} className={styles.row}>
                <div className={styles.rowInfo}>
                  <div className={styles.rowTitle}>{task.title}</div>
                  <div className={styles.rowMeta}>
                    {task.matter?.title || 'Sem caso'} ·{' '}
                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString('pt-BR') : 'Sem data'}
                  </div>
                </div>
                <div className={styles.rowActions}>
                  <TaskCrudActions
                    task={{
                      id: task.id,
                      title: task.title,
                      description: task.description || null,
                      status:
                        task.status === 'OPEN' ||
                        task.status === 'DOING' ||
                        task.status === 'DONE' ||
                        task.status === 'CANCELED'
                          ? task.status
                          : 'OPEN',
                      priority:
                        task.priority === 'LOW' ||
                        task.priority === 'MEDIUM' ||
                        task.priority === 'HIGH'
                          ? task.priority
                          : 'MEDIUM',
                      dueDate: task.dueDate || null,
                      assignedTo: task.assignedTo || null,
                    }}
                  />
                </div>
              </div>
            ))}
            {tasks.length === 0 ? <div className={styles.empty}>Sem tarefas no período.</div> : null}
          </div>
        </div>

        <div>
          <h3 className={styles.blockTitle}>Prazos</h3>
          <div className={styles.list}>
            {deadlines.slice(0, 8).map((deadline) => (
              <div key={deadline.id} className={styles.row}>
                <div className={styles.rowInfo}>
                  <div className={styles.rowTitle}>{deadline.title}</div>
                  <div className={styles.rowMeta}>
                    {deadline.matter?.title || 'Sem caso'} ·{' '}
                    {new Date(deadline.dueDate).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                <div className={styles.rowActions}>
                  <DeadlineCrudActions
                    deadline={{
                      id: deadline.id,
                      title: deadline.title,
                      type: deadline.type,
                      dueDate: deadline.dueDate,
                      notes: deadline.notes || null,
                      isDone: Boolean(deadline.isDone),
                    }}
                  />
                </div>
              </div>
            ))}
            {deadlines.length === 0 ? <div className={styles.empty}>Sem prazos no período.</div> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import styles from '@/app/agenda/agenda.module.css';
import { UISelect } from '@/components/ui/Select';

type AssigneeOption = {
  id: string;
  name: string;
};

type AgendaFiltersProps = {
  view: string;
  date: string;
  taskStatus: string;
  appointmentStatus: string;
  taskPriority: string;
  deadlineStatus: string;
  deadlineType: string;
  assignee: string;
  q: string;
  assigneeOptions: AssigneeOption[];
};

export default function AgendaFilters(props: AgendaFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const base = useMemo(() => new URLSearchParams(current.toString()), [current]);

  function updateParam(name: string, value: string) {
    const params = new URLSearchParams(base.toString());
    params.set('view', props.view);
    params.set('date', props.date);
    params.set('eventsPage', '1');
    if (value) params.set(name, value);
    else params.delete(name);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function clearFilters() {
    const params = new URLSearchParams();
    params.set('view', props.view);
    params.set('date', props.date);
    params.set('taskStatus', 'PENDING');
    params.set('appointmentStatus', 'PENDING');
    params.set('taskPriority', 'ALL');
    params.set('deadlineStatus', 'PENDING');
    params.set('deadlineType', 'ALL');
    params.delete('assignee');
    params.delete('q');
    params.set('eventsPage', '1');
    router.replace(`${pathname}?${params.toString()}`);
  }

  const advancedHasValue =
    props.taskPriority !== 'ALL' ||
    props.deadlineType !== 'ALL' ||
    Boolean(props.assignee);

  return (
    <>
    <div className={styles.filtersMainRow}>
      <label className={styles.field}>
        <span>Busca</span>
        <input
          value={props.q}
          className={styles.input}
          placeholder="Buscar por título, status, usuário ou caso..."
          onChange={(e) => updateParam('q', e.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span>Status tarefa</span>
        <UISelect
          value={props.taskStatus}
          className={styles.input}
          ariaLabel="Status tarefa"
          onChange={(value) => updateParam('taskStatus', value)}
          options={[
            { value: 'PENDING', label: 'Pendentes (abertas e em andamento)' },
            { value: 'ALL', label: 'Todas' },
            { value: 'OPEN', label: 'Abertas' },
            { value: 'DOING', label: 'Em andamento' },
            { value: 'DONE', label: 'Concluídas' },
            { value: 'CANCELED', label: 'Canceladas' },
          ]}
        />
      </label>
      <label className={styles.field}>
        <span>Status atendimento</span>
        <UISelect
          value={props.appointmentStatus}
          className={styles.input}
          ariaLabel="Status atendimento"
          onChange={(value) => updateParam('appointmentStatus', value)}
          options={[
            { value: 'PENDING', label: 'Pendentes (abertos e em andamento)' },
            { value: 'ALL', label: 'Todos' },
            { value: 'OPEN', label: 'Abertos' },
            { value: 'DOING', label: 'Em andamento' },
            { value: 'DONE', label: 'Concluídos' },
            { value: 'CANCELED', label: 'Cancelados' },
          ]}
        />
      </label>
      <label className={styles.field}>
        <span>Status prazo</span>
        <UISelect
          value={props.deadlineStatus}
          className={styles.input}
          ariaLabel="Status prazo"
          onChange={(value) => updateParam('deadlineStatus', value)}
          options={[
            { value: 'ALL', label: 'Todos' },
            { value: 'PENDING', label: 'Pendentes' },
            { value: 'DONE', label: 'Concluídos' },
            { value: 'OVERDUE', label: 'Atrasados' },
            { value: 'TODAY', label: 'Vencem hoje' },
          ]}
        />
      </label>
      <div className={styles.filtersActions}>
        <button
          type="button"
          className={styles.submitBtn}
          onClick={() => setShowAdvanced((prev) => !prev)}
        >
          {showAdvanced || advancedHasValue ? 'Menos filtros' : 'Mais filtros'}
        </button>
        <button
          type="button"
          className={styles.submitBtn}
          onClick={clearFilters}
        >
          Limpar filtros
        </button>
      </div>
    </div>
    {showAdvanced || advancedHasValue ? (
      <div className={styles.filtersAdvancedRow}>
        <label className={styles.field}>
          <span>Prioridade</span>
          <UISelect
            value={props.taskPriority}
            className={styles.input}
            ariaLabel="Prioridade"
            onChange={(value) => updateParam('taskPriority', value)}
            options={[
              { value: 'ALL', label: 'Todas' },
              { value: 'HIGH', label: 'Alta' },
              { value: 'MEDIUM', label: 'Média' },
              { value: 'LOW', label: 'Baixa' },
            ]}
          />
        </label>

        <label className={styles.field}>
          <span>Tipo prazo</span>
          <UISelect
            value={props.deadlineType}
            className={styles.input}
            ariaLabel="Tipo prazo"
            onChange={(value) => updateParam('deadlineType', value)}
            options={[
              { value: 'ALL', label: 'Todos' },
              { value: 'GENERIC', label: 'Geral' },
              { value: 'PROCESSUAL', label: 'Processual' },
            ]}
          />
        </label>

        <label className={styles.field}>
          <span>Usuário</span>
          <UISelect
            value={props.assignee}
            className={styles.input}
            ariaLabel="Usuário"
            onChange={(value) => updateParam('assignee', value)}
            options={[
              { value: '', label: 'Todos' },
              ...props.assigneeOptions.map((u) => ({ value: u.id, label: u.name })),
            ]}
          />
        </label>
      </div>
    ) : null}
    </>
  );
}

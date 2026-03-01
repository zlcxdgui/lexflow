'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDateBR, formatPriority, formatStatus } from '@/lib/format';
import { TaskCrudActions } from '@/components/TaskCrudActions';
import { UIButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { UIListEmpty, UIListPager, UIListPagerPage } from '@/components/ui/ListRow';
import { UISelect } from '@/components/ui/Select';
import styles from './page.module.css';

type AppointmentItem = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueDate?: string | null;
  matter?: { id: string; title: string } | null;
  assignedTo?: { id: string; name: string; email: string } | null;
};

const PAGE_SIZE = 8;

function datePartsInTimeZone(iso: string, timeZone?: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const byType = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  if (!byType.year || !byType.month || !byType.day) return null;
  return { year: byType.year, month: byType.month, day: byType.day };
}

function formatTime(iso?: string | null, timeZone?: string) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone });
}

function dayKey(iso?: string | null, timeZone?: string) {
  if (!iso) return 'Sem data';
  const parts = datePartsInTimeZone(iso, timeZone);
  if (!parts) return 'Sem data';
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatDayKeyBR(key: string) {
  if (key === 'Sem data') return key;
  const [yyyy, mm, dd] = key.split('-');
  if (!yyyy || !mm || !dd) return key;
  return `${dd}/${mm}/${yyyy}`;
}

function relativeDayLabel(key: string, timeZone?: string) {
  if (key === 'Sem data') return key;
  const [yyyy, mm, dd] = key.split('-').map((part) => Number(part));
  if (!yyyy || !mm || !dd) return formatDayKeyBR(key);

  const target = new Date(yyyy, mm - 1, dd);
  const now = new Date();
  const nowParts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});
  const base = new Date(
    Number(nowParts.year || now.getFullYear()),
    Number(nowParts.month || now.getMonth() + 1) - 1,
    Number(nowParts.day || now.getDate()),
  );
  const diffDays = Math.round((target.getTime() - base.getTime()) / 86400000);
  const formatted = formatDayKeyBR(key);

  if (diffDays === 0) return `Hoje · ${formatted}`;
  if (diffDays === 1) return `Amanhã · ${formatted}`;
  if (diffDays === -1) return `Ontem · ${formatted}`;
  return formatted;
}

function asTaskStatus(value: string): 'OPEN' | 'DOING' | 'DONE' | 'CANCELED' {
  if (value === 'OPEN' || value === 'DOING' || value === 'DONE' || value === 'CANCELED') return value;
  return 'OPEN';
}

function asTaskPriority(value: string): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (value === 'LOW' || value === 'MEDIUM' || value === 'HIGH') return value;
  return 'MEDIUM';
}

export function AppointmentsCrudView({
  items,
  focusedAppointmentId,
  tenantTimeZone,
}: {
  items: AppointmentItem[];
  focusedAppointmentId?: string;
  tenantTimeZone?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'ALL' | 'OPEN' | 'DOING' | 'DONE' | 'CANCELED'>(
    focusedAppointmentId ? 'ALL' : 'OPEN',
  );
  const [page, setPage] = useState(1);
  const [concludingId, setConcludingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (focusedAppointmentId && item.id !== focusedAppointmentId) return false;
      if (status !== 'ALL' && item.status !== status) return false;
      if (!q) return true;
      const hay = `${item.title} ${item.matter?.title || ''} ${item.assignedTo?.name || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query, status, focusedAppointmentId]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const grouped = useMemo(() => {
    const map = new Map<string, AppointmentItem[]>();
    for (const item of paged) {
      const key = dayKey(item.dueDate, tenantTimeZone);
      const current = map.get(key) || [];
      current.push(item);
      map.set(key, current);
    }
    return Array.from(map.entries()).sort((a, b) => {
      if (a[0] === 'Sem data') return 1;
      if (b[0] === 'Sem data') return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [paged, tenantTimeZone]);

  async function concludeAppointment(item: AppointmentItem) {
    if (item.status === 'DONE' || item.status === 'CANCELED') return;
    setConcludingId(item.id);
    try {
      await fetch(`/api/appointments/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DONE' }),
      });
      router.refresh();
    } finally {
      setConcludingId(null);
    }
  }

  return (
    <Card as="section" className={styles.card} padding="md">
      <div className={styles.listHeader}>
        <div className={styles.listTitleWrap}>
          <SectionHeader title="Atendimentos" className={styles.listHeaderUi} />
          {focusedAppointmentId ? (
            <div className={styles.focusInfo}>
              Exibindo atendimento selecionado
              <UIButton
                type="button"
                variant="ghost"
                size="sm"
                className={styles.focusClear}
                onClick={() => router.push('/appointments')}
              >
                Ver todos
              </UIButton>
            </div>
          ) : null}
        </div>
        {!focusedAppointmentId ? (
          <div className={styles.filters}>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por cliente, caso ou responsável"
            />
            <UISelect
              className={styles.filterSelect}
              value={status}
              ariaLabel="Status"
              onChange={(value) => {
                setStatus(value as 'ALL' | 'OPEN' | 'DOING' | 'DONE' | 'CANCELED');
                setPage(1);
              }}
              options={[
                { value: 'ALL', label: 'Todos status' },
                { value: 'OPEN', label: 'Abertos' },
                { value: 'DOING', label: 'Em andamento' },
                { value: 'DONE', label: 'Concluídos' },
                { value: 'CANCELED', label: 'Cancelados' },
              ]}
            />
          </div>
        ) : null}
      </div>

      {paged.length === 0 ? (
        <UIListEmpty className={styles.empty}>Nenhum atendimento encontrado.</UIListEmpty>
      ) : (
        <div className={styles.rows}>
          {grouped.map(([groupDay, groupItems]) => (
            <section key={groupDay} className={styles.group}>
                <div className={styles.groupTitle}>
                {relativeDayLabel(groupDay, tenantTimeZone)}
              </div>
              {groupItems.map((item) => (
                <article key={item.id} className={styles.row}>
                  <div className={styles.rowMain}>
                    <h3>{item.title}</h3>
                    <div className={styles.meta}>
                      <span>Data: {formatDateBR(item.dueDate, tenantTimeZone)}</span>
                      <span>Hora: {formatTime(item.dueDate, tenantTimeZone)}</span>
                      <span>Status: {formatStatus(item.status)}</span>
                      <span>Prioridade: {formatPriority(item.priority)}</span>
                      <span>Caso: {item.matter?.title || 'Sem caso vinculado'}</span>
                      <span>Responsável: {item.assignedTo?.name || 'Não definido'}</span>
                    </div>
                  </div>
                  <div className={styles.rowActions}>
                    {item.status !== 'DONE' && item.status !== 'CANCELED' ? (
                      <UIButton
                        type="button"
                        variant="secondary"
                        className={styles.concludeBtn}
                        onClick={() => concludeAppointment(item)}
                        disabled={concludingId === item.id}
                      >
                        {concludingId === item.id ? 'Concluindo...' : 'Concluir'}
                      </UIButton>
                    ) : null}
                    <TaskCrudActions
                      task={{
                        id: item.id,
                        title: item.title,
                        description: item.description || null,
                        status: asTaskStatus(item.status),
                        priority: asTaskPriority(item.priority),
                        dueDate: item.dueDate || null,
                        assignedTo: item.assignedTo || null,
                      }}
                      endpointBase="/api/appointments"
                    />
                  </div>
                </article>
              ))}
            </section>
          ))}
        </div>
      )}

      <UIListPager
        className={styles.pagination}
        meta={<span>
          Exibindo {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}-
          {Math.min(safePage * PAGE_SIZE, filtered.length)} de {filtered.length}
        </span>}
        actions={<div className={styles.paginationActions}>
          <UIButton type="button" variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>
            Anterior
          </UIButton>
          <UIListPagerPage>Página {safePage} de {totalPages}</UIListPagerPage>
          <UIButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
          >
            Próxima
          </UIButton>
        </div>}
      />
    </Card>
  );
}

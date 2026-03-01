import Link from 'next/link';
import { ApiError, apiGet } from '@/lib/serverApi';
import { formatDateBR, formatStatus } from '@/lib/format';
import AgendaFilters from '@/components/AgendaFilters';
import { UpcomingEvents, type UpcomingEventItem } from './UpcomingEvents';
import { AccessDeniedView } from '@/components/AccessDeniedView';
import { BackButton } from '@/components/BackButton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import styles from './agenda.module.css';

type TaskItem = {
  id: string;
  title: string;
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
  isDone: boolean;
  matter?: { id: string; title: string } | null;
};

type SearchParams = {
  view?: string;
  date?: string;
  taskStatus?: string;
  appointmentStatus?: string;
  deadlineStatus?: string;
  deadlineType?: string;
  assignee?: string;
  taskPriority?: string;
  q?: string;
};

type EventItem = {
  id: string;
  kind: 'TASK' | 'DEADLINE';
  title: string;
  date: string;
  dayKey: string;
  timeLabel?: string | null;
  statusLabel: string;
  badgeTone: 'pending' | 'done' | 'late';
  detail: string;
  href: string;
};

type UserMember = {
  user?: { id?: string; name?: string } | null;
  isActive?: boolean;
};

type UserOption = {
  id: string;
  name: string;
};

type AuthMe = {
  tenantId?: string;
};

type TenantMineRecord = {
  tenantId?: string;
  tenant?: { id?: string; timezone?: string | null } | null;
};

const DEFAULT_TENANT_TIME_ZONE = 'America/Manaus';
const TIMEZONE_OFFSET_MINUTES: Record<string, number> = {
  'America/Manaus': -4 * 60,
  'America/Sao_Paulo': -3 * 60,
};

function dateKeyInTimeZone(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!year || !month || !day) return asDateOnly(value);
  return `${year}-${month}-${day}`;
}

function timezoneOffsetMinutes(timeZone?: string) {
  return TIMEZONE_OFFSET_MINUTES[String(timeZone || '')] ?? TIMEZONE_OFFSET_MINUTES[DEFAULT_TENANT_TIME_ZONE];
}

function timezoneRangeStartIso(value: Date, timeZone: string) {
  const offsetMinutes = timezoneOffsetMinutes(timeZone);
  const utcMinutes = offsetMinutes * -1;
  const h = Math.floor(Math.abs(utcMinutes) / 60);
  const m = Math.abs(utcMinutes) % 60;
  const base = asDateOnly(value);
  return `${base}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`;
}

function timezoneRangeEndIso(value: Date, timeZone: string) {
  const nextDay = addDays(value, 1);
  const startNext = new Date(timezoneRangeStartIso(nextDay, timeZone));
  return new Date(startNext.getTime() - 1).toISOString();
}

function asDateOnly(value: Date) {
  const yyyy = value.getUTCFullYear();
  const mm = String(value.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(value.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseBaseDate(raw?: string) {
  if (!raw) return new Date();
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addDays(value: Date, days: number) {
  const d = new Date(value);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function startOfWeekMonday(value: Date) {
  const start = startOfUtcDay(value);
  const day = start.getUTCDay();
  const shift = day === 0 ? -6 : 1 - day;
  return addDays(start, shift);
}

function startOfMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function endOfMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0));
}

function monthLabel(value: Date) {
  return value.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function weekdayLabel(value: Date) {
  return value.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });
}

function monthWeekdayLabel(index: number) {
  const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  return labels[index] || '';
}

function monthCellWeekday(value: Date) {
  return value
    .toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' })
    .replace('.', '');
}

function mondayGridColumnStart(value: Date) {
  const day = value.getUTCDay();
  return day === 0 ? 7 : day;
}

function extractTimeLabel(rawDate: string, timeZone: string): string | null {
  const d = new Date(rawDate);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });
}

function isAppointmentTaskTitle(title: string): boolean {
  return String(title || '').trim().toLowerCase().startsWith('atendimento');
}

function isTaskClosed(status?: string): boolean {
  const normalized = String(status || '').trim().toUpperCase();
  return normalized === 'DONE' || normalized === 'CANCELED';
}

function buildEvents(
  tasks: TaskItem[],
  deadlines: DeadlineItem[],
  tenantTimeZone: string,
): EventItem[] {
  const todayKey = dateKeyInTimeZone(new Date(), tenantTimeZone);
  const taskEvents = tasks
    .filter((t) => Boolean(t.dueDate))
    .map((t) => {
      const due = new Date(String(t.dueDate));
      const isDone = isTaskClosed(t.status);
      let badgeTone: EventItem['badgeTone'] = 'pending';
      if (isDone) badgeTone = 'done';
      else {
        const taskDayKey = isAppointmentTaskTitle(t.title)
          ? dateKeyInTimeZone(due, tenantTimeZone)
          : asDateOnly(due);
        if (taskDayKey < todayKey) badgeTone = 'late';
      }
      return {
        id: t.id,
        kind: 'TASK' as const,
        title: t.title,
        date: String(t.dueDate),
          dayKey: isAppointmentTaskTitle(t.title)
          ? dateKeyInTimeZone(due, tenantTimeZone)
          : asDateOnly(due),
        timeLabel: isAppointmentTaskTitle(t.title)
          ? extractTimeLabel(String(t.dueDate), tenantTimeZone)
          : null,
        statusLabel: `Tarefa: ${formatStatus(t.status)}`,
        badgeTone,
        detail: t.matter?.title ? `Caso: ${t.matter.title}` : 'Sem caso vinculado',
        href: isAppointmentTaskTitle(t.title)
          ? `/appointments?appointmentId=${encodeURIComponent(t.id)}`
          : t.matter?.id
            ? `/matters/${t.matter.id}?tab=tasks`
            : '/agenda',
      };
    });

  const deadlineEvents = deadlines.map((d) => {
    const due = new Date(d.dueDate);
    const dueKey = dateKeyInTimeZone(due, tenantTimeZone);
    let badgeTone: EventItem['badgeTone'] = 'pending';
    if (d.isDone) badgeTone = 'done';
    else if (dueKey < todayKey) badgeTone = 'late';
    return {
      id: d.id,
      kind: 'DEADLINE' as const,
      title: d.title,
      date: d.dueDate,
      dayKey: dueKey,
      timeLabel: null,
      statusLabel: `Prazo: ${d.isDone ? 'Concluído' : 'Pendente'}`,
      badgeTone,
      detail: d.matter?.title ? `Caso: ${d.matter.title}` : 'Sem caso vinculado',
      href: d.matter?.id ? `/matters/${d.matter.id}?tab=deadlines` : '/agenda',
    };
  });

  return [...taskEvents, ...deadlineEvents].sort((a, b) => {
    const ad = new Date(a.date).getTime();
    const bd = new Date(b.date).getTime();
    if (ad !== bd) return ad - bd;
    return a.title.localeCompare(b.title, 'pt-BR');
  });
}

function buildMonthGrid(baseDate: Date) {
  const first = startOfMonth(baseDate);
  const last = endOfMonth(baseDate);
  const start = startOfWeekMonday(first);
  const end = addDays(startOfWeekMonday(last), 6);

  const days: Date[] = [];
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    days.push(new Date(d));
  }
  return days;
}

function buildAlerts(
  tasks: TaskItem[],
  deadlines: DeadlineItem[],
  tenantTimeZone: string,
) {
  const now = new Date();
  const todayKey = dateKeyInTimeZone(now, tenantTimeZone);
  const next3Key = dateKeyInTimeZone(addDays(now, 3), tenantTimeZone);

  const taskOpen = tasks.filter((t) => t.status !== 'DONE' && t.status !== 'CANCELED' && t.dueDate);
  const deadlinesOpen = deadlines.filter((d) => !d.isDone);

  const taskDayKey = (t: TaskItem) => {
    const dt = new Date(String(t.dueDate));
    return isAppointmentTaskTitle(t.title)
      ? dateKeyInTimeZone(dt, tenantTimeZone)
      : asDateOnly(dt);
  };
  const deadlineDayKey = (d: DeadlineItem) => asDateOnly(new Date(d.dueDate));

  const overdue =
    taskOpen.filter((t) => taskDayKey(t) < todayKey).length +
    deadlinesOpen.filter((d) => deadlineDayKey(d) < todayKey).length;

  const todayCount =
    taskOpen.filter((t) => taskDayKey(t) === todayKey).length +
    deadlinesOpen.filter((d) => deadlineDayKey(d) === todayKey).length;

  const next3 =
    taskOpen.filter((t) => {
      const key = taskDayKey(t);
      return key > todayKey && key <= next3Key;
    }).length +
    deadlinesOpen.filter((d) => {
      const key = deadlineDayKey(d);
      return key > todayKey && key <= next3Key;
    }).length;

  return { overdue, todayCount, next3 };
}

function mergeQuery(base: SearchParams, patch: Partial<SearchParams>) {
  const next: SearchParams = { ...base, ...patch };
  const qs = new URLSearchParams();
  Object.entries(next).forEach(([k, v]) => {
    if (v && String(v).trim()) qs.set(k, String(v));
  });
  return `/agenda?${qs.toString()}`;
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const resolved = searchParams ? await searchParams : undefined;

  const view = resolved?.view === 'month' ? 'month' : 'week';
  const baseDate = parseBaseDate(resolved?.date);

  const rangeStart = view === 'week' ? startOfWeekMonday(baseDate) : startOfMonth(baseDate);
  const rangeEnd = view === 'week' ? addDays(rangeStart, 6) : endOfMonth(baseDate);

  const taskStatusRaw = (resolved?.taskStatus || 'PENDING').toUpperCase();
  const appointmentStatusRaw = (resolved?.appointmentStatus || 'PENDING').toUpperCase();
  const deadlineStatusRaw = (resolved?.deadlineStatus || 'PENDING').toUpperCase();
  const deadlineTypeRaw = (resolved?.deadlineType || 'ALL').toUpperCase();
  const taskPriorityRaw = (resolved?.taskPriority || 'ALL').toUpperCase();
  const taskStatus = ['ALL', 'PENDING', 'OPEN', 'DOING', 'DONE', 'CANCELED'].includes(taskStatusRaw)
    ? taskStatusRaw
    : 'PENDING';
  const deadlineStatus = ['ALL', 'PENDING', 'DONE', 'OVERDUE', 'TODAY'].includes(deadlineStatusRaw)
    ? deadlineStatusRaw
    : 'PENDING';
  const appointmentStatus = ['ALL', 'PENDING', 'OPEN', 'DOING', 'DONE', 'CANCELED'].includes(appointmentStatusRaw)
    ? appointmentStatusRaw
    : 'PENDING';
  const deadlineType = ['ALL', 'GENERIC', 'PROCESSUAL'].includes(deadlineTypeRaw)
    ? deadlineTypeRaw
    : 'ALL';
  const taskPriority = ['ALL', 'LOW', 'MEDIUM', 'HIGH'].includes(taskPriorityRaw)
    ? taskPriorityRaw
    : 'ALL';
  const assignee = resolved?.assignee || '';

  const taskQuery = new URLSearchParams({
    dueFrom: asDateOnly(rangeStart),
    dueTo: asDateOnly(rangeEnd),
    status: 'ALL',
  });
  if (assignee) taskQuery.set('assignedToUserId', assignee);

  const deadlineQuery = new URLSearchParams({
    dueFrom: asDateOnly(rangeStart),
    dueTo: asDateOnly(rangeEnd),
    type: deadlineType,
    isDone: deadlineStatus === 'DONE' ? 'true' : deadlineStatus === 'ALL' ? '' : 'false',
  });
  if (deadlineStatus === 'ALL') deadlineQuery.delete('isDone');

  let tasks: TaskItem[] = [];
  let appointments: TaskItem[] = [];
  let deadlines: DeadlineItem[] = [];
  let users: UserOption[] = [];
  let tenantTimeZone = DEFAULT_TENANT_TIME_ZONE;
  let loadError = '';
  try {
    const [meResp, myTenantsResp] = await Promise.all([
      apiGet<AuthMe>('/me'),
      apiGet<TenantMineRecord[]>('/tenants/mine'),
    ]);
    const currentTenantId = String(meResp?.tenantId || '');
    const matchedTenant = Array.isArray(myTenantsResp)
      ? myTenantsResp.find(
          (item) =>
            String(item?.tenantId || item?.tenant?.id || '') === currentTenantId,
        )
      : undefined;
    tenantTimeZone = String(
      matchedTenant?.tenant?.timezone || DEFAULT_TENANT_TIME_ZONE,
    );

    const appointmentQuery = new URLSearchParams({
      dueFrom: timezoneRangeStartIso(rangeStart, tenantTimeZone),
      dueTo: timezoneRangeEndIso(rangeEnd, tenantTimeZone),
      status: 'ALL',
    });
    if (assignee) appointmentQuery.set('assignedToUserId', assignee);

    const [tasksResp, appointmentsResp, deadlinesResp] = await Promise.all([
      apiGet<{ value: TaskItem[] } | TaskItem[]>(`/tasks?${taskQuery.toString()}`),
      apiGet<{ value: TaskItem[] } | TaskItem[]>(`/appointments?${appointmentQuery.toString()}`),
      apiGet<{ value: DeadlineItem[] } | DeadlineItem[]>(`/deadlines?${deadlineQuery.toString()}`),
    ]);
    tasks = Array.isArray(tasksResp) ? tasksResp : tasksResp.value ?? [];
    appointments = Array.isArray(appointmentsResp)
      ? appointmentsResp
      : appointmentsResp.value ?? [];
    deadlines = Array.isArray(deadlinesResp)
      ? deadlinesResp
      : deadlinesResp.value ?? [];
    try {
      const usersResp = await apiGet<UserMember[] | { value?: UserMember[] }>('/users');
      const usersList = Array.isArray(usersResp)
        ? usersResp
        : Array.isArray(usersResp?.value)
          ? usersResp.value
          : [];
      users = usersList
        .filter((member) => member?.isActive !== false)
        .map((member) => ({
          id: String(member?.user?.id || ''),
          name: String(member?.user?.name || ''),
        }))
        .filter((user) => user.id && user.name);
    } catch {
      users = [];
    }
  } catch (err: unknown) {
    if (err instanceof ApiError && err.status === 403) {
      return <AccessDeniedView area="Agenda" />;
    }
    loadError = err instanceof Error ? err.message : 'Erro ao carregar agenda';
  }

  const effectiveFilters = {
    taskStatus,
    appointmentStatus,
    taskPriority,
    deadlineStatus,
    deadlineType,
    assignee,
    q: resolved?.q || '',
  };

  const effTaskStatus = effectiveFilters.taskStatus || 'PENDING';
  const effAppointmentStatus = effectiveFilters.appointmentStatus || 'PENDING';
  const effTaskPriority = effectiveFilters.taskPriority || 'ALL';
  const effDeadlineStatus = effectiveFilters.deadlineStatus || 'ALL';
  const effDeadlineType = effectiveFilters.deadlineType || 'ALL';
  const effAssignee = effectiveFilters.assignee || '';
  const effQuery = (effectiveFilters.q || '').trim().toLowerCase();

  const mergedTasks = [
    ...tasks.filter((t) => !isAppointmentTaskTitle(t.title)),
    ...appointments.filter((t) => isAppointmentTaskTitle(t.title)),
  ];

  const filteredTasks = mergedTasks.filter((t) => {
    const isAppointment = isAppointmentTaskTitle(t.title);
    const selectedStatus = isAppointment ? effAppointmentStatus : effTaskStatus;
    if (selectedStatus === 'PENDING') {
      const status = String(t.status || '').toUpperCase();
      if (status !== 'OPEN' && status !== 'DOING') return false;
    } else if (selectedStatus !== 'ALL' && t.status !== selectedStatus) {
      return false;
    }
    if (effTaskPriority !== 'ALL' && t.priority !== effTaskPriority) return false;
    if (effAssignee && t.assignedTo?.id !== effAssignee) return false;
    return true;
  });

  const filteredDeadlines = deadlines.filter((d) => {
    const dueKey = dateKeyInTimeZone(new Date(d.dueDate), tenantTimeZone);
    const todayKey = dateKeyInTimeZone(new Date(), tenantTimeZone);
    if (effDeadlineType !== 'ALL' && d.type !== effDeadlineType) return false;
    if (effDeadlineStatus === 'DONE' && !d.isDone) return false;
    if (effDeadlineStatus === 'PENDING' && d.isDone) return false;
    if (effDeadlineStatus === 'OVERDUE' && (d.isDone || !(dueKey && dueKey < todayKey))) return false;
    if (effDeadlineStatus === 'TODAY' && (d.isDone || dueKey !== todayKey)) return false;
    return true;
  });

  const events = buildEvents(filteredTasks, filteredDeadlines, tenantTimeZone);
  const alerts = buildAlerts(filteredTasks, filteredDeadlines, tenantTimeZone);
  const todayKeyInTenantTz = dateKeyInTimeZone(new Date(), tenantTimeZone);

  const filteredEvents = events.filter((e) => {
    if (effQuery) {
      const hay = `${e.title} ${e.statusLabel} ${e.detail}`.toLowerCase();
      if (!hay.includes(effQuery)) return false;
    }
    return true;
  });

  const upcomingItems: UpcomingEventItem[] = filteredEvents.map((e) => ({
    id: e.id,
    kind: e.kind,
    title: e.title,
    date: e.date,
    timeLabel: e.timeLabel || null,
    statusLabel: e.statusLabel,
    taskPriority:
      e.kind === 'TASK'
        ? (filteredTasks.find((t) => t.id === e.id)?.priority || 'MEDIUM')
        : null,
    deadlineType:
      e.kind === 'DEADLINE'
        ? (filteredDeadlines.find((d) => d.id === e.id)?.type || 'GENERIC')
        : null,
    href: e.href,
  }));

  const assigneeOptions = users;

  const prevDate = view === 'week' ? addDays(baseDate, -7) : new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() - 1, 1));
  const nextDate = view === 'week' ? addDays(baseDate, 7) : new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + 1, 1));

  return (
    <main className={`${styles.page} appPageShell`}>
      <SectionHeader
        title="Agenda"
        description="Calendário de tarefas e prazos com foco em vencimentos."
        headingAs="h1"
        className={styles.headerRow}
        actions={<BackButton fallbackHref="/dashboard" className={styles.linkMuted} />}
      />

      <section className={styles.controlsCard}>
        <div className={styles.topControls}>
          <div className={styles.viewSwitch}>
            <Link href={mergeQuery(resolved || {}, { view: 'month' })} className={`${styles.switchBtn} ${view === 'month' ? styles.switchActive : ''}`}>Mensal</Link>
            <Link href={mergeQuery(resolved || {}, { view: 'week' })} className={`${styles.switchBtn} ${view === 'week' ? styles.switchActive : ''}`}>Semanal</Link>
          </div>

          <div className={styles.periodNav}>
            <Link href={mergeQuery(resolved || {}, { date: asDateOnly(prevDate) })} className={styles.navBtn}>←</Link>
            <span className={styles.periodLabel}>{view === 'week' ? `${formatDateBR(asDateOnly(rangeStart))} - ${formatDateBR(asDateOnly(rangeEnd))}` : monthLabel(baseDate)}</span>
            <Link href={mergeQuery(resolved || {}, { date: asDateOnly(nextDate) })} className={styles.navBtn}>→</Link>
          </div>
        </div>

        <AgendaFilters
          view={view}
          date={asDateOnly(baseDate)}
          taskStatus={effTaskStatus}
          appointmentStatus={effAppointmentStatus}
          taskPriority={effTaskPriority}
          deadlineStatus={effDeadlineStatus}
          deadlineType={effDeadlineType}
          assignee={effAssignee}
          q={effQuery}
          assigneeOptions={assigneeOptions}
        />
      </section>

      <section className={styles.alertsRow}>
        <article className={`${styles.alertCard} ${styles.alertLate}`}>
          <span>Atrasados</span>
          <strong>{alerts.overdue}</strong>
        </article>
        <article className={`${styles.alertCard} ${styles.alertToday}`}>
          <span>Vencem hoje</span>
          <strong>{alerts.todayCount}</strong>
        </article>
        <article className={`${styles.alertCard} ${styles.alertNext}`}>
          <span>Próx. 3 dias</span>
          <strong>{alerts.next3}</strong>
        </article>
      </section>

      {loadError ? (
        <section className={styles.errorBox}>
          Não foi possível carregar a agenda agora. {loadError}
        </section>
      ) : null}

      {view === 'month' ? (
        <section className={styles.calendarMonth}>
          <div className={styles.monthWeekdays} aria-hidden="true">
            {Array.from({ length: 7 }).map((_, idx) => (
              <div key={idx} className={styles.monthWeekdayItem}>
                {monthWeekdayLabel(idx)}
              </div>
            ))}
          </div>
          {buildMonthGrid(baseDate)
            .filter((day) => day.getUTCMonth() === baseDate.getUTCMonth())
            .map((day, index) => {
              const dayKey = asDateOnly(day);
              const daily = filteredEvents.filter((e) => e.dayKey === dayKey);
              const isToday = dayKey === todayKeyInTenantTz;
                return (
                  <article
                    key={day.toISOString()}
                    className={`${styles.dayCell} ${isToday ? styles.dayCellToday : ''}`}
                    style={index === 0 ? { gridColumnStart: mondayGridColumnStart(day) } : undefined}
                  >
                <header className={styles.dayHeaderMonth}>
                  <span className={styles.dayHeaderMonthWeekday}>{monthCellWeekday(day)}</span>
                  <span className={styles.dayHeaderMonthNumber}>
                    {String(day.getUTCDate()).padStart(2, '0')}
                  </span>
                  {isToday ? <span className={styles.dayHeaderMonthBadge}>Hoje</span> : null}
                </header>
                <div className={styles.dayBodyMonth}>
                  {daily.length === 0 ? (
                    <span className={styles.emptyMonthDot} aria-label="Dia sem eventos" />
                  ) : (
                    <>
                      {daily.slice(0, 2).map((e) => (
                        (() => {
                          const isAppointment =
                            e.kind === 'TASK' &&
                            String(e.title || '').trim().toLowerCase().startsWith('atendimento');
                          const typeLabel =
                            e.kind === 'DEADLINE'
                              ? 'Prazo'
                              : isAppointment
                                ? 'Atendimento'
                                : 'Tarefa';
                          const typePrefix = e.kind === 'DEADLINE' ? 'P' : isAppointment ? 'A' : 'T';
                          const typeClass =
                            e.kind === 'DEADLINE'
                              ? styles.eventTypeDeadline
                              : isAppointment
                                ? styles.eventTypeAppointment
                                : styles.eventTypeTask;
                          return (
                        <Link
                          key={`${e.kind}-${e.id}`}
                          href={e.href}
                          className={`${styles.eventPill} ${styles.eventPillMonth} ${styles.eventLink} ${typeClass} ${e.badgeTone === 'late' ? styles.eventLate : e.badgeTone === 'done' ? styles.eventDone : styles.eventPending}`}
                          title={`${typeLabel}${e.timeLabel ? ` • ${e.timeLabel}` : ''} • ${e.title}`}
                        >
                          <span className={`${styles.eventPillPrefix} ${typeClass}`}>
                            {typePrefix}
                          </span>
                          {e.timeLabel ? `${e.timeLabel} · ` : ''}
                          {e.title}
                        </Link>
                          );
                        })()
                      ))}
                      {daily.length > 2 ? (
                        <div className={styles.monthMore}>+{daily.length - 2} evento(s)</div>
                      ) : null}
                    </>
                  )}
                </div>
                </article>
              );
              })}
        </section>
      ) : (
        <section className={styles.weekList}>
          {Array.from({ length: 7 }).map((_, idx) => {
            const day = addDays(rangeStart, idx);
            const dayKey = asDateOnly(day);
            const daily = filteredEvents.filter((e) => e.dayKey === dayKey);
            return (
              <article key={day.toISOString()} className={styles.weekDayCard}>
                <header className={styles.weekDayHeader}>{weekdayLabel(day)}</header>
                {daily.length === 0 ? (
                  <div className={styles.empty}>Sem eventos</div>
                ) : (
                  <div className={styles.weekDayEvents}>
                    {daily.map((e) => (
                      <Link key={`${e.kind}-${e.id}`} href={e.href} className={styles.weekEventLink}>
                        <div className={styles.weekEventRow}>
                        <span className={`${styles.dot} ${e.badgeTone === 'late' ? styles.dotLate : e.badgeTone === 'done' ? styles.dotDone : styles.dotPending}`} />
                        <div>
                          <div className={styles.eventTitle}>{e.title}</div>
                          <div className={styles.eventMeta}>
                            {e.timeLabel ? `Hora: ${e.timeLabel} · ` : ''}
                            {e.statusLabel} · {e.detail}
                          </div>
                        </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      <UpcomingEvents items={upcomingItems} pageSize={5} tenantTimeZone={tenantTimeZone} />

    </main>
  );
}

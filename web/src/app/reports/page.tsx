import Link from 'next/link';
import { ApiError, apiGet } from '@/lib/serverApi';
import styles from './reports.module.css';
import { formatDateBR, formatStatus } from '@/lib/format';
import ReportsActions from './reportsActions';
import { AccessDeniedView } from '@/components/AccessDeniedView';
import { BackButton } from '@/components/BackButton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { UIListEmpty, UIListRow, UIListRowActions, UIListRowMain, UIListStack } from '@/components/ui/ListRow';

type Matter = {
  id: string;
  title: string;
  area: string | null;
  status: string;
  createdAt: string;
  client?: { name: string | null } | null;
};

type DashboardResp = {
  rangeDays: number;
  counts: {
    openMatters: number;
    openTasks: number;
    pendingDeadlines: number;
  };
  upcomingDeadlines: Array<{
    id: string;
    title: string;
    type: string;
    dueDate: string;
    matter: { id: string; title: string; area?: string | null; status?: string | null };
  }>;
  openTasks: Array<{
    id: string;
    title: string;
    priority: string;
    status?: string;
    dueDate: string | null;
    assignedTo?: { id: string; name: string } | null;
    matter?: { id: string; title: string; area?: string | null; status?: string | null } | null;
  }>;
};

type ReportsComparison = {
  current: {
    mattersCreated: number;
    tasksCreated: number;
    deadlinesCreated: number;
  };
  previous: {
    mattersCreated: number;
    tasksCreated: number;
    deadlinesCreated: number;
  };
};

type ReportsGoals = {
  deadlineOnTimeTarget: number;
  deadlineOnTimeCurrent: number;
  taskBacklogTarget: number;
  taskBacklogCurrent: number;
};

type ReportsIndicators = {
  averageMatterAgeDays: number;
  completionByResponsible: Array<{
    responsibleId: string;
    responsible: string;
    completionRate: number;
    done: number;
    total: number;
  }>;
  backlogByResponsible: Array<{
    responsibleId: string;
    responsible: string;
    backlog: number;
  }>;
};

type ReportsAlerts = {
  highRiskDeadlines: number;
  highRiskTasks: number;
  totalHighRisk: number;
};

type ReportsHistoryRow = {
  date: string;
  openMatters: number;
  openTasks: number;
  pendingDeadlines: number;
};

type MeProfile = {
  role?: string;
  permissions?: string[];
  tenantTimezone?: string;
};

type ReportsPageProps = {
  searchParams?:
    | {
        days?: string;
        q?: string;
        status?: string;
        area?: string;
        responsible?: string;
        deadlineType?: string;
        compare?: string;
        focus?: string;
        value?: string;
        drillAll?: string;
      }
    | Promise<{
        days?: string;
        q?: string;
        status?: string;
        area?: string;
        responsible?: string;
        deadlineType?: string;
        compare?: string;
        focus?: string;
        value?: string;
        drillAll?: string;
      }>;
};

function groupBy<T>(items: T[], keyFn: (item: T) => string) {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item) || 'Outros';
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

function startOfWeekUTC(date: Date) {
  const day = date.getUTCDay();
  const diff = (day + 6) % 7;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - diff));
}

function startOfDayUTC(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDaysUTC(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function weeklySeries(matters: Matter[], rangeDays: number, timeZone?: string) {
  const today = startOfDayUTC(new Date());
  const start = addDaysUTC(today, -(rangeDays - 1));
  const firstWeek = startOfWeekUTC(start);
  const weeks: Date[] = [];
  for (let d = firstWeek; d <= today; d = addDaysUTC(d, 7)) {
    weeks.push(d);
  }

  const map = new Map<string, number>();
  for (const week of weeks) {
    map.set(week.toISOString().slice(0, 10), 0);
  }

  for (const matter of matters) {
    const createdAt = new Date(matter.createdAt);
    if (createdAt < start || createdAt > today) continue;
    const key = startOfWeekUTC(createdAt).toISOString().slice(0, 10);
    map.set(key, (map.get(key) || 0) + 1);
  }

  return weeks.map((week) => ({
    label: formatDateBR(week.toISOString(), timeZone),
    count: map.get(week.toISOString().slice(0, 10)) || 0,
  }));
}

function statusTone(label: string) {
  const l = label.toLowerCase();
  if (l.includes('encerr')) return 'success';
  if (l.includes('abert')) return 'info';
  return 'default';
}

function statusBadgeClass(label: string) {
  const tone = statusTone(label);
  if (tone === 'success') return styles.badgeSuccess;
  if (tone === 'info') return styles.badgeInfo;
  return styles.badgeDefault;
}

function calcDelta(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function deltaClass(delta: number) {
  if (delta > 0) return styles.deltaUp;
  if (delta < 0) return styles.deltaDown;
  return styles.deltaFlat;
}

function deltaArrow(delta: number) {
  if (delta > 0) return '↑';
  if (delta < 0) return '↓';
  return '→';
}

function dueRiskClass(dateValue: string | null | undefined) {
  if (!dateValue) return styles.badgeMuted;
  const due = new Date(dateValue);
  const today = startOfDayUTC(new Date());
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays <= 2) return styles.badgeDanger;
  if (diffDays <= 7) return styles.badgeWarning;
  return styles.badgeInfo;
}

function compareDueDateAsc(a: string | null | undefined, b: string | null | undefined) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return new Date(a).getTime() - new Date(b).getTime();
}

function dueLabel(dateValue: string | null | undefined, timeZone?: string) {
  if (!dateValue) return 'Sem prazo';
  const due = new Date(dateValue);
  const today = startOfDayUTC(new Date());
  const prefix = due.getTime() < today.getTime() ? 'Venceu' : 'Vence';
  return `${prefix} ${formatDateBR(dateValue, timeZone)}`;
}

function focusLabel(focus: string, focusValue: string) {
  if (!focus) return '';
  if (focus === 'kpi.openMatters') return 'casos em aberto';
  if (focus === 'kpi.openTasks') return 'tarefas em aberto';
  if (focus === 'kpi.pendingDeadlines') return 'prazos pendentes';
  if (focus === 'status') return focusValue ? `status ${focusValue}` : 'status';
  if (focus === 'area') return focusValue ? `área ${focusValue}` : 'área';
  return 'filtro selecionado';
}

function buildQuery(params: ReportsPageProps['searchParams']) {
  const q = new URLSearchParams();
  if (params?.days) q.set('days', params.days);
  if (params?.q) q.set('q', params.q);
  if (params?.status) q.set('status', params.status);
  if (params?.area) q.set('area', params.area);
  if (params?.responsible) q.set('responsible', params.responsible);
  if (params?.deadlineType) q.set('deadlineType', params.deadlineType);
  if (params?.compare) q.set('compare', params.compare);
  return q.toString();
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await Promise.resolve(searchParams || {});
  const rangeDays = Math.max(7, Number(params.days) || 14);
  const compareEnabled = String(params.compare || '1') !== '0';
  const focus = String(params.focus || '').trim();
  const focusValue = String(params.value || '').trim();
  const drillAll = String(params.drillAll || '0') === '1';
  const me = await apiGet<MeProfile>('/me').catch(() => ({
    role: '',
    permissions: [],
    tenantTimezone: 'America/Manaus',
  }));
  const tenantTimeZone = me?.tenantTimezone || 'America/Manaus';
  const generatedAt = formatDateBR(new Date().toISOString(), tenantTimeZone);
  const permissions = Array.isArray(me.permissions) ? me.permissions : [];
  if (!permissions.includes('reports.read')) {
    return <AccessDeniedView area="Relatórios" />;
  }

  const apiQuery = new URLSearchParams();
  apiQuery.set('days', String(rangeDays));
  if (params.q) apiQuery.set('q', params.q);
  if (params.status) apiQuery.set('status', params.status);
  if (params.area) apiQuery.set('area', params.area);
  if (params.responsible) apiQuery.set('responsible', params.responsible);
  if (params.deadlineType) apiQuery.set('deadlineType', params.deadlineType);

  let matters: Matter[] = [];
  let dashboard: DashboardResp | null = null;
  let comparison: ReportsComparison | null = null;
  let goals: ReportsGoals | null = null;
  let indicators: ReportsIndicators | null = null;
  let alerts: ReportsAlerts | null = null;
  let historicalSeries: ReportsHistoryRow[] = [];
  try {
    const data = await apiGet<{
      matters: Matter[];
      dashboard: DashboardResp;
      comparison: ReportsComparison;
      goals: ReportsGoals;
      indicators: ReportsIndicators;
      alerts: ReportsAlerts;
      historicalSeries: ReportsHistoryRow[];
    }>(`/reports/data?${apiQuery.toString()}`);
    matters = Array.isArray(data?.matters) ? data.matters : [];
    dashboard = data?.dashboard || null;
    comparison = data?.comparison || null;
    goals = data?.goals || null;
    indicators = data?.indicators || null;
    alerts = data?.alerts || null;
    historicalSeries = Array.isArray(data?.historicalSeries) ? data.historicalSeries : [];
  } catch (e: unknown) {
    if (e instanceof ApiError && e.status === 403) {
      return <AccessDeniedView area="Relatórios" />;
    }
    throw e;
  }
  if (!dashboard || !comparison || !goals || !indicators || !alerts) {
    return <AccessDeniedView area="Relatórios" />;
  }

  const statusGroups = groupBy(matters, (m) => formatStatus(m.status));
  const areaGroups = groupBy(matters, (m) => (m.area || 'Não informado'));
  const weekly = weeklySeries(matters, rangeDays, tenantTimeZone);
  const maxWeekly = Math.max(1, ...weekly.map((w) => w.count));
  const totalMatters = matters.length;
  const closedMatters = matters.filter((matter) => matter.status.toLowerCase().includes('encerr')).length;
  const productivityRate = totalMatters > 0 ? Math.round((closedMatters / totalMatters) * 100) : 0;
  const highPriorityOpenTasks = dashboard.openTasks.filter((task) =>
    String(task.priority || '').toLowerCase().includes('alta')
  ).length;
  const nextDeadline = dashboard.upcomingDeadlines
    .map((deadline) => deadline.dueDate)
    .sort()[0];
  const sortedDeadlines = [...dashboard.upcomingDeadlines].sort((a, b) =>
    compareDueDateAsc(a.dueDate, b.dueDate),
  );
  const sortedOpenTasks = [...dashboard.openTasks].sort((a, b) =>
    compareDueDateAsc(a.dueDate, b.dueDate),
  );
  const mattersDelta = calcDelta(comparison.current.mattersCreated, comparison.previous.mattersCreated);
  const tasksDelta = calcDelta(comparison.current.tasksCreated, comparison.previous.tasksCreated);
  const deadlinesDelta = calcDelta(comparison.current.deadlinesCreated, comparison.previous.deadlinesCreated);
  const historyMax = Math.max(
    1,
    ...historicalSeries.map((item) => Math.max(item.openMatters, item.openTasks, item.pendingDeadlines)),
    dashboard.counts.openTasks,
  );
  const historyRows = [...historicalSeries]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);
  const historyWithLive = [
    {
      key: 'live-now',
      label: 'Agora (tempo real)',
      value: dashboard.counts.openTasks,
      isLive: true,
    },
    ...historyRows.map((item) => ({
      key: `snapshot-${item.date}`,
      label: formatDateBR(item.date, tenantTimeZone),
      value: item.openTasks,
      isLive: false,
    })),
  ];
  const baseQuery = buildQuery(params);
  const withBase = (extra: string) => `/reports?${baseQuery}${baseQuery ? '&' : ''}${extra}`;
  const focusQuery = `focus=${encodeURIComponent(focus)}${focusValue ? `&value=${encodeURIComponent(focusValue)}` : ''}`;

  const drillDownItems = (() => {
    if (!focus) return [];
    if (focus === 'kpi.openMatters') {
      return matters
        .filter((item) => String(item.status).toUpperCase() === 'OPEN')
        .map((item) => ({
          id: item.id,
          title: item.title,
          meta: `${item.area || 'Não informado'} · ${formatStatus(item.status)}`,
          href: '/matters',
        }));
    }
    if (focus === 'kpi.openTasks') {
      return sortedOpenTasks.map((item) => ({
        id: item.id,
        title: item.title,
        meta: `${item.assignedTo?.name || 'Não atribuído'} · ${item.matter?.title || 'Sem caso'}`,
        href: item.matter?.id ? `/matters/${item.matter.id}` : '/agenda',
      }));
    }
    if (focus === 'kpi.pendingDeadlines') {
      return sortedDeadlines.map((item) => ({
        id: item.id,
        title: item.title,
          meta: `${item.matter.title} · ${formatDateBR(item.dueDate, tenantTimeZone)}`,
          href: item.matter?.id ? `/matters/${item.matter.id}` : '/agenda',
        }));
    }
    if (focus === 'status' && focusValue) {
      return matters
        .filter((item) => formatStatus(item.status) === focusValue)
        .map((item) => ({
          id: item.id,
          title: item.title,
          meta: `${item.area || 'Não informado'} · ${focusValue}`,
          href: '/matters',
        }));
    }
    if (focus === 'area' && focusValue) {
      return matters
        .filter((item) => (item.area || 'Não informado') === focusValue)
        .map((item) => ({
          id: item.id,
          title: item.title,
          meta: `${formatStatus(item.status)} · ${item.client?.name || 'Sem cliente'}`,
          href: '/matters',
        }));
    }
    return [];
  })();

  return (
    <main className={styles.page}>
      <div className={styles.printHeader}>
        <div className={styles.printTitle}>Relatório LexFlow</div>
        <div className={styles.printMeta}>
          Período: {rangeDays} dias · Gerado em {generatedAt}
        </div>
      </div>
      <header className={styles.header}>
        <div className={styles.headerTopRow}>
          <div className={styles.headerTitleBlock}>
            <SectionHeader
              title="Relatórios"
              description="Painel executivo com visão consolidada da operação."
              headingAs="h1"
              className={styles.reportHeaderUi}
            />
            <div className={styles.metaLine}>
              <span>{rangeDays} dias analisados</span>
              <span>Atualizado em {generatedAt}</span>
            </div>
          </div>
          <BackButton fallbackHref="/dashboard" className={styles.linkMuted} />
        </div>
        <div className={styles.headerActions}>
          <ReportsActions rangeDays={rangeDays} matters={matters} dashboard={dashboard} />
        </div>
      </header>

      <section className={styles.kpis}>
        <Link href={`${withBase('focus=kpi.openMatters')}#drilldown`} className={styles.kpiLinkWrap}>
          <StatCard
            className={styles.kpiCardUi}
            label="Casos em aberto"
            value={dashboard.counts.openMatters}
            meta={
              <>
                <div className={styles.kpiMeta}>Total monitorado: {totalMatters}</div>
                {compareEnabled ? (
                  <div className={`${styles.kpiDelta} ${deltaClass(mattersDelta)}`}>
                    <span className={styles.deltaArrow} aria-hidden>{deltaArrow(mattersDelta)}</span>
                    {mattersDelta > 0 ? '+' : ''}{mattersDelta}% vs período anterior
                  </div>
                ) : null}
              </>
            }
          />
        </Link>
        <Link href={`${withBase('focus=kpi.openTasks')}#drilldown`} className={styles.kpiLinkWrap}>
          <StatCard
            className={styles.kpiCardUi}
            label="Tarefas em aberto"
            value={dashboard.counts.openTasks}
            meta={
              <>
                <div className={styles.kpiMeta}>Prioridade alta: {highPriorityOpenTasks}</div>
                {compareEnabled ? (
                  <div className={`${styles.kpiDelta} ${deltaClass(tasksDelta)}`}>
                    <span className={styles.deltaArrow} aria-hidden>{deltaArrow(tasksDelta)}</span>
                    {tasksDelta > 0 ? '+' : ''}{tasksDelta}% vs período anterior
                  </div>
                ) : null}
              </>
            }
          />
        </Link>
        <Link href={`${withBase('focus=kpi.pendingDeadlines')}#drilldown`} className={styles.kpiLinkWrap}>
          <StatCard
            className={styles.kpiCardUi}
            label="Prazos pendentes"
            value={dashboard.counts.pendingDeadlines}
            meta={
              <>
                <div className={styles.kpiMeta}>
                  Próximo vencimento: {nextDeadline ? formatDateBR(nextDeadline, tenantTimeZone) : 'Sem prazos'}
                </div>
                {compareEnabled ? (
                  <div className={`${styles.kpiDelta} ${deltaClass(deadlinesDelta)}`}>
                    <span className={styles.deltaArrow} aria-hidden>{deltaArrow(deadlinesDelta)}</span>
                    {deadlinesDelta > 0 ? '+' : ''}{deadlinesDelta}% vs período anterior
                  </div>
                ) : null}
              </>
            }
          />
        </Link>
        <StatCard
          className={styles.kpiCardUi}
          label="Produtividade"
          value={`${productivityRate}%`}
          meta={<div className={styles.kpiMeta}>Casos encerrados no período: {closedMatters}</div>}
        />
      </section>

      <section className={styles.summaryRow}>
        <Card className={styles.card}>
          <div className={styles.cardTitle}>Metas e SLA</div>
          <div className={styles.insights}>
            <div className={styles.insightRow}>
              <span className={styles.insightLabel}>Prazos cumpridos</span>
              <strong className={goals.deadlineOnTimeCurrent >= goals.deadlineOnTimeTarget ? styles.textSuccess : styles.textWarning}>
                {goals.deadlineOnTimeCurrent}% / meta {goals.deadlineOnTimeTarget}%
              </strong>
            </div>
            <div className={styles.insightRow}>
              <span className={styles.insightLabel}>Backlog de tarefas</span>
              <strong className={goals.taskBacklogCurrent <= goals.taskBacklogTarget ? styles.textSuccess : styles.textWarning}>
                {goals.taskBacklogCurrent} / meta ≤ {goals.taskBacklogTarget}
              </strong>
            </div>
            <div className={styles.insightRow}>
              <span className={styles.insightLabel}>Idade média dos casos</span>
              <strong>{indicators.averageMatterAgeDays} dia(s)</strong>
            </div>
          </div>
        </Card>
        <Card className={styles.card}>
          <div className={styles.cardTitle}>Alertas inteligentes</div>
          <div className={styles.insights}>
            <div className={styles.insightRow}>
              <span className={styles.insightLabel}>Prazos de alto risco (≤2 dias)</span>
              <strong className={alerts.highRiskDeadlines > 0 ? styles.textWarning : styles.textSuccess}>{alerts.highRiskDeadlines}</strong>
            </div>
            <div className={styles.insightRow}>
              <span className={styles.insightLabel}>Tarefas críticas</span>
              <strong className={alerts.highRiskTasks > 0 ? styles.textWarning : styles.textSuccess}>{alerts.highRiskTasks}</strong>
            </div>
            <div className={styles.insightRow}>
              <span className={styles.insightLabel}>Risco total</span>
              <strong className={alerts.totalHighRisk > 0 ? styles.textWarning : styles.textSuccess}>{alerts.totalHighRisk}</strong>
            </div>
          </div>
        </Card>
      </section>

      <section className={styles.executiveLayout}>
        <div className={styles.mainColumn}>
          <div className={styles.grid}>
            <Card className={styles.card}>
              <div className={styles.cardTitle}>Casos por status</div>
              <div className={styles.chart}>
                {statusGroups.map(([label, count]) => (
                  <div key={label} className={styles.chartRow}>
                    <div>
                      <Link href={`${withBase(`focus=status&value=${encodeURIComponent(label)}`)}#drilldown`}>
                        <span className={`${styles.badge} ${statusBadgeClass(label)}`}>Status: {label}</span>
                      </Link>
                    </div>
                    <div className={styles.chartTrack}>
                      <span
                        className={styles.chartBar}
                        style={{ width: `${Math.min(100, count * 12)}%` }}
                      />
                    </div>
                    <div className={styles.chartValue}>{count}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className={styles.card}>
              <div className={styles.cardTitle}>Casos por área</div>
              <div className={styles.chart}>
                {areaGroups.map(([label, count]) => (
                  <div key={label} className={styles.chartRow}>
                    <div className={styles.chartLabel}>
                      <Link href={`${withBase(`focus=area&value=${encodeURIComponent(label)}`)}#drilldown`}>{label}</Link>
                    </div>
                    <div className={styles.chartTrack}>
                      <span
                        className={styles.chartBarAlt}
                        style={{ width: `${Math.min(100, count * 12)}%` }}
                      />
                    </div>
                    <div className={styles.chartValue}>{count}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className={`${styles.card} ${styles.cardWide}`}>
              <div className={styles.cardTitle}>Casos criados por semana</div>
              <div className={styles.lineChart}>
                <svg viewBox="0 0 320 120" className={styles.lineSvg} aria-hidden>
                  <polyline className={styles.lineGrid} points="0,20 320,20" />
                  <polyline className={styles.lineGrid} points="0,60 320,60" />
                  <polyline className={styles.lineGrid} points="0,100 320,100" />
                  <polyline
                    className={styles.linePath}
                    points={weekly
                      .map((item, index) => {
                        const x = (index / Math.max(1, weekly.length - 1)) * 320;
                        const y = 110 - (item.count / maxWeekly) * 90;
                        return `${x.toFixed(2)},${y.toFixed(2)}`;
                      })
                      .join(' ')}
                  />
                  {weekly.map((item, index) => {
                    const x = (index / Math.max(1, weekly.length - 1)) * 320;
                    const y = 110 - (item.count / maxWeekly) * 90;
                    return <circle key={item.label} cx={x} cy={y} r="3" className={styles.lineDot} />;
                  })}
                </svg>
                <div className={styles.lineLegend}>
                  {weekly.map((item) => (
                    <div key={item.label} className={styles.lineLegendItem}>
                      <span>{item.label}</span>
                      <strong>{item.count}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

        </div>

        <aside className={styles.sideColumn}>
          <Card className={styles.card}>
            <div className={styles.cardTitle}>Prazos próximos ({rangeDays} dias)</div>
            {dashboard.upcomingDeadlines.length === 0 ? (
              <UIListEmpty>Nenhum prazo pendente.</UIListEmpty>
            ) : (
              <UIListStack className={styles.compactList}>
                {sortedDeadlines.slice(0, 3).map((d) => (
                  <UIListRow key={d.id} className={styles.listRow}>
                    <UIListRowMain className={styles.listText}>
                      <span className={styles.listTitle}>{d.title}</span>
                      <span className={styles.listMeta}>{d.matter.title}</span>
                    </UIListRowMain>
                    <UIListRowActions>
                      <span className={`${styles.badge} ${dueRiskClass(d.dueDate)}`}>{dueLabel(d.dueDate, tenantTimeZone)}</span>
                    </UIListRowActions>
                  </UIListRow>
                ))}
                {sortedDeadlines.length > 3 ? (
                  <Link
                    href={`${withBase('focus=kpi.pendingDeadlines')}#drilldown`}
                    className={styles.compactMore}
                  >
                    Ver todos ({sortedDeadlines.length})
                  </Link>
                ) : null}
              </UIListStack>
            )}
          </Card>

          <Card className={styles.card}>
            <div className={styles.cardTitle}>Tarefas abertas</div>
            {dashboard.openTasks.length === 0 ? (
              <UIListEmpty>Nenhuma tarefa em aberto.</UIListEmpty>
            ) : (
              <UIListStack className={styles.compactList}>
                {sortedOpenTasks.slice(0, 3).map((t) => (
                  <UIListRow key={t.id} className={styles.listRow}>
                    <UIListRowMain className={styles.listText}>
                      <span className={styles.listTitle}>{t.title}</span>
                      <span className={styles.listMeta}>
                        {t.matter?.title || 'Sem caso'} · {t.assignedTo?.name || 'Não atribuído'}
                      </span>
                    </UIListRowMain>
                    <UIListRowActions>
                      <span className={`${styles.badge} ${dueRiskClass(t.dueDate)}`}>{dueLabel(t.dueDate, tenantTimeZone)}</span>
                    </UIListRowActions>
                  </UIListRow>
                ))}
                {sortedOpenTasks.length > 3 ? (
                  <Link
                    href={`${withBase('focus=kpi.openTasks')}#drilldown`}
                    className={styles.compactMore}
                  >
                    Ver todas ({sortedOpenTasks.length})
                  </Link>
                ) : null}
              </UIListStack>
            )}
          </Card>
        </aside>
      </section>

      <section className={styles.belowGrid}>
        <div className={styles.mainHistoryBlock}>
          <Card className={styles.card}>
            <div className={styles.cardTitle}>Histórico (snapshot diário)</div>
            <div className={styles.muted}>Snapshot diário + linha em tempo real.</div>
            {historyWithLive.length === 0 ? (
              <div className={styles.muted}>Sem histórico ainda.</div>
            ) : (
              <div className={styles.miniSeries}>
                {historyWithLive.map((item) => (
                  <div key={item.key} className={styles.miniSeriesRow}>
                    <span className={item.isLive ? styles.textSuccess : undefined}>{item.label}</span>
                    <div className={styles.miniSeriesTrack}>
                      <span style={{ width: `${Math.max(6, (item.value / historyMax) * 100)}%` }} />
                    </div>
                    <strong className={item.isLive ? styles.textSuccess : undefined}>{item.value}</strong>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className={styles.mainLowerGrid}>
          <Card className={styles.card}>
            <div className={`${styles.cardTitle} ${styles.cardTitleSmall}`}>Indicadores por responsável</div>
            {indicators.completionByResponsible.length === 0 ? (
              <div className={styles.muted}>Sem dados no período.</div>
            ) : (
              <div className={styles.miniSeries}>
                {indicators.completionByResponsible.map((item) => (
                  <div key={item.responsibleId} className={styles.miniSeriesRow}>
                    <span>{item.responsible}</span>
                    <div className={styles.miniSeriesTrack}>
                      <span style={{ width: `${Math.max(6, item.completionRate)}%` }} />
                    </div>
                    <strong>{item.completionRate}%</strong>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card className={styles.card}>
            <div className={`${styles.cardTitle} ${styles.cardTitleSmall}`}>Backlog por responsável</div>
            {indicators.backlogByResponsible.length === 0 ? (
              <div className={styles.muted}>Sem backlog.</div>
            ) : (
              <div className={styles.miniSeries}>
                {indicators.backlogByResponsible.map((item) => (
                  <div key={item.responsibleId} className={styles.miniSeriesRow}>
                    <span>{item.responsible}</span>
                    <div className={styles.miniSeriesTrack}>
                      <span style={{ width: `${Math.max(6, (item.backlog / Math.max(1, indicators.backlogByResponsible[0].backlog)) * 100)}%` }} />
                    </div>
                    <strong>{item.backlog}</strong>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </section>

      {focus ? (
        <section id="drilldown" className={styles.drilldownSection}>
          <Card as="div" className={styles.card}>
            <div className={styles.cardTitle}>Detalhamento</div>
            <div className={styles.muted}>Detalhamento de {focusLabel(focus, focusValue)}</div>
            {drillDownItems.length === 0 ? (
              <UIListEmpty>Sem registros para este recorte.</UIListEmpty>
            ) : (
              <UIListStack className={styles.compactList}>
                {(drillAll ? drillDownItems : drillDownItems.slice(0, 5)).map((item) => (
                  <UIListRow key={item.id} className={styles.listRow}>
                    <UIListRowMain className={styles.listText}>
                      <Link href={item.href} className={styles.listTitleLink}>
                        <span className={styles.listTitle}>{item.title}</span>
                      </Link>
                      <span className={styles.listMeta}>{item.meta}</span>
                    </UIListRowMain>
                    <UIListRowActions>
                      <Link href={item.href} className={`${styles.badge} ${styles.badgeInfo}`}>
                        Abrir
                      </Link>
                    </UIListRowActions>
                  </UIListRow>
                ))}
                {drillDownItems.length > 5 ? (
                  <Link
                    href={drillAll ? `${withBase(focusQuery)}#drilldown` : `${withBase(`${focusQuery}&drillAll=1`)}#drilldown`}
                    className={styles.compactMore}
                  >
                    {drillAll ? 'Mostrar menos' : `Ver todas (${drillDownItems.length})`}
                  </Link>
                ) : null}
              </UIListStack>
            )}
          </Card>
        </section>
      ) : null}

      <div className={styles.printFooter}>
        LexFlow · Relatório gerado em {generatedAt}
      </div>
    </main>
  );
}

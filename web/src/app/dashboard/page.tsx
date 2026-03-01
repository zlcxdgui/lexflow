import Link from 'next/link';
import { apiGet } from '@/lib/serverApi';
import { ApiError } from '@/lib/serverApi';
import { formatDateBR, formatDeadlineType, formatPriority, formatStatus } from '@/lib/format';
import { can } from '@/lib/permissions';
import { AccessDeniedView } from '@/components/AccessDeniedView';
import { UIButton } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/SectionHeader';
import styles from './dashboard.module.css';

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
    notes: string | null;
    isDone: boolean;
    matter: {
      id: string;
      title: string;
      court: string;
      caseNumber: string;
      status: string;
    };
  }>;
  openTasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    matter?: {
      id: string;
      title: string;
      court: string;
      caseNumber: string;
      status: string;
    } | null;
    assignedTo?: { id: string; name: string; email: string } | null;
    createdBy?: { id: string; name: string; email: string } | null;
  }>;
};

type BadgeTone = 'default' | 'info' | 'success' | 'warning' | 'danger' | 'muted';

function dateKeyInTimeZone(value?: string | Date | null, timeZone?: string) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const byType = parts.reduce<Record<string, string>>((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  if (!byType.year || !byType.month || !byType.day) return '';
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function badge(text: string, tone: BadgeTone = 'default'): React.ReactNode {
  const toneClass =
    tone === 'info'
      ? styles.badgeInfo
      : tone === 'success'
      ? styles.badgeSuccess
      : tone === 'warning'
      ? styles.badgeWarning
      : tone === 'danger'
      ? styles.badgeDanger
      : tone === 'muted'
      ? styles.badgeMuted
      : styles.badgeDefault;
  return <span className={`${styles.badge} ${toneClass}`}>{text}</span>;
}

function priorityTone(priority: string): BadgeTone {
  const p = priority.toUpperCase();
  if (p === 'HIGH') return 'danger';
  if (p === 'MEDIUM') return 'warning';
  return 'muted';
}

function statusTone(status: string): BadgeTone {
  const s = status.toUpperCase();
  if (s === 'DONE') return 'success';
  if (s === 'DOING' || s === 'OPEN') return 'info';
  return 'default';
}

function EmptyState({ title, desc, actionHref, actionText }: { title: string; desc: string; actionHref: string; actionText: string }) {
  return (
    <div className={styles.ctaCard}>
      <div className={styles.ctaTitle}>{title}</div>
      <div className={styles.ctaDesc}>{desc}</div>
      <UIButton href={actionHref} className={styles.ctaButton} variant="secondary">
        {actionText}
      </UIButton>
    </div>
  );
}

export default async function DashboardPage() {
  const me = await apiGet<{ role?: string; tenantTimezone?: string }>('/me').catch(() => ({
    role: '',
    tenantTimezone: 'America/Manaus',
  }));
  const tenantTimeZone = String(me?.tenantTimezone || 'America/Manaus');
  let data: DashboardResp | null = null;

  try {
    data = await apiGet<DashboardResp>('/dashboard?days=14');
  } catch (e: unknown) {
    if (e instanceof ApiError && e.status === 403) {
      return <AccessDeniedView area="Painel" />;
    }
    const msg = e instanceof Error ? e.message : String(e);

    // Se for 401 (cookie ausente/expirado), mostra estado amigável
    if (msg.includes('401') || msg.toLowerCase().includes('unauthorized')) {
      return (
        <main className={`${styles.page} appPageShell`}>
          <h1 className={styles.title}>Sessão expirada</h1>
          <p className={styles.metaLoose}>
            Faça login novamente para ver seu painel.
          </p>

          <Link href="/api/auth/logout" className={styles.ctaButton}>
            Ir para entrar
          </Link>
        </main>
      );
    }

    // Outros erros: mostra mensagem sem quebrar tudo
    return (
      <main className={`${styles.page} appPageShell`}>
        <h1 className={styles.title}>Painel</h1>
        <p className={styles.errorMeta}>
          Ocorreu um erro ao carregar.
        </p>
        <pre className={styles.errorPre}>
          {msg}
        </pre>
      </main>
    );
  }

  const rangeDays = data?.rangeDays ?? 14;
  const counts = data?.counts ?? { openMatters: 0, openTasks: 0, pendingDeadlines: 0 };
  const deadlines = data?.upcomingDeadlines ?? [];
  const tasks = data?.openTasks ?? [];
  const DASHBOARD_PREVIEW_LIMIT = 4;
  const deadlinePreview = deadlines.slice(0, DASHBOARD_PREVIEW_LIMIT);
  const tasksPreview = tasks.slice(0, DASHBOARD_PREVIEW_LIMIT);
  const hiddenDeadlines = Math.max(0, deadlines.length - deadlinePreview.length);
  const hiddenTasks = Math.max(0, tasks.length - tasksPreview.length);
  const todayKey = dateKeyInTimeZone(new Date(), tenantTimeZone);
  const overdueDeadlines = deadlines.filter((d) => {
    const dueKey = dateKeyInTimeZone(d.dueDate, tenantTimeZone);
    return !!dueKey && dueKey < todayKey;
  }).length;
  const dueTodayDeadlines = deadlines.filter((d) => {
    const dueKey = dateKeyInTimeZone(d.dueDate, tenantTimeZone);
    return !!dueKey && dueKey === todayKey;
  }).length;
  const highPriorityTasks = tasks.filter((t) => t.priority?.toUpperCase() === 'HIGH').length;
  const trendSeries = [
    { label: 'Casos', value: counts.openMatters },
    { label: 'Tarefas', value: counts.openTasks },
    { label: 'Prazos', value: counts.pendingDeadlines },
    { label: 'Atrasos', value: overdueDeadlines },
    { label: 'Urgentes', value: highPriorityTasks },
  ];
  const trendMax = Math.max(1, ...trendSeries.map((p) => p.value));
  const trendPoints = trendSeries
    .map((point, index) => {
      const x = (index / Math.max(1, trendSeries.length - 1)) * 100;
      const y = 100 - (point.value / trendMax) * 100;
      return `${x},${Number.isFinite(y) ? y : 100}`;
    })
    .join(' ');
  const totalItems = counts.openTasks + counts.pendingDeadlines;
  const overduePct = totalItems > 0 ? Math.round((overdueDeadlines / totalItems) * 100) : 0;
  const urgencyPct = counts.openTasks > 0 ? Math.round((highPriorityTasks / counts.openTasks) * 100) : 0;

  return (
    <main className={`${styles.page} appPageShell`}>
      <section className={styles.hero}>
        <div className={styles.heroIntro}>
          <SectionHeader
            eyebrow="Painel operacional"
            title="Visão geral do escritório"
            description={`Próximos ${rangeDays} dias de tarefas, prazos e atendimentos.`}
            headingAs="h1"
            className={styles.heroHeader}
          />

          {can(me.role, 'matter.create') || can(me.role, 'task.create') ? (
            <div className={styles.quickActionRow}>
              {can(me.role, 'matter.create') ? (
                <UIButton href="/matters/new" className={styles.heroButtonPrimary} variant="primary">
                  Novo caso
                </UIButton>
              ) : null}
              {can(me.role, 'task.create') ? (
                <UIButton href="/appointments" className={styles.heroButtonSecondary} variant="secondary">
                  Novo atendimento
                </UIButton>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className={styles.heroMetrics}>
          <Link href="/matters" className={`${styles.metricCard} ${styles.metricCardMain}`}>
            <div className={styles.metricLabel}>Casos abertos</div>
            <div className={styles.metricValue}>{counts.openMatters}</div>
            <div className={styles.metricHint}>Em acompanhamento no escritório</div>
          </Link>
          <Link href="/agenda?taskStatus=OPEN" className={styles.metricCard}>
            <div className={styles.metricLabel}>Tarefas em aberto</div>
            <div className={styles.metricValue}>{counts.openTasks}</div>
            <div className={styles.metricHint}>Pendências operacionais</div>
          </Link>
          <Link href="/agenda?deadlineStatus=PENDING" className={styles.metricCard}>
            <div className={styles.metricLabel}>Prazos pendentes</div>
            <div className={styles.metricValue}>{counts.pendingDeadlines}</div>
            <div className={styles.metricHint}>Acompanhar vencimentos</div>
          </Link>
        </div>
      </section>

      <section className={styles.kpiStrip}>
        <Link href="/agenda?deadlineStatus=OVERDUE" className={`${styles.kpiTile} ${styles.kpiDanger}`}>
          <div className={styles.kpiTitle}>Atrasados</div>
          <div className={styles.kpiValue}>{overdueDeadlines}</div>
          <div className={styles.kpiHint}>Prazos vencidos</div>
        </Link>
        <Link href="/agenda?deadlineStatus=TODAY" className={`${styles.kpiTile} ${styles.kpiWarning}`}>
          <div className={styles.kpiTitle}>Vencem hoje</div>
          <div className={styles.kpiValue}>{dueTodayDeadlines}</div>
          <div className={styles.kpiHint}>Exigem atenção imediata</div>
        </Link>
        <Link href="/agenda?taskPriority=HIGH" className={`${styles.kpiTile} ${styles.kpiInfo}`}>
          <div className={styles.kpiTitle}>Tarefas urgentes</div>
          <div className={styles.kpiValue}>{highPriorityTasks}</div>
          <div className={styles.kpiHint}>Prioridade alta</div>
        </Link>
      </section>

      <section className={styles.insightBoard}>
        <section className={styles.analyticsPanel}>
          <div className={styles.analyticsHeader}>
            <div>
              <div className={styles.analyticsTitle}>Pulso da operação</div>
              <div className={styles.analyticsSubtitle}>Distribuição atual das filas de trabalho</div>
            </div>
            <div className={styles.analyticsChips}>
              {badge(`${counts.openMatters} casos`, 'info')}
              {badge(`${counts.openTasks} tarefas`, 'muted')}
              {badge(`${counts.pendingDeadlines} prazos`, 'warning')}
            </div>
          </div>

          <div className={styles.chartWrap}>
            <svg viewBox="0 0 100 100" className={styles.chartSvg} preserveAspectRatio="none" aria-hidden="true">
              <polyline className={styles.chartGridLine} points="0,20 100,20" />
              <polyline className={styles.chartGridLine} points="0,50 100,50" />
              <polyline className={styles.chartGridLine} points="0,80 100,80" />
              <polyline className={styles.chartArea} points={`0,100 ${trendPoints} 100,100`} />
              <polyline className={styles.chartLine} points={trendPoints} />
              {trendSeries.map((point, index) => {
                const x = (index / Math.max(1, trendSeries.length - 1)) * 100;
                const y = 100 - (point.value / trendMax) * 100;
                return <circle key={point.label} cx={x} cy={y} r="1.6" className={styles.chartDot} />;
              })}
            </svg>
          </div>
          <div className={styles.chartLegend}>
            {trendSeries.map((point) => (
              <div key={point.label} className={styles.chartLegendItem}>
                <span className={styles.chartLegendLabel}>{point.label}</span>
                <strong className={styles.chartLegendValue}>{point.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.insightSide}>
          <div className={styles.miniWidget}>
            <div className={styles.miniWidgetLabel}>Risco de atraso</div>
            <div className={styles.miniWidgetValue}>{overduePct}%</div>
            <div className={styles.miniProgress}>
              <span className={styles.miniProgressFillDanger} style={{ width: `${Math.min(overduePct, 100)}%` }} />
            </div>
            <div className={styles.miniWidgetMeta}>Base: tarefas + prazos pendentes</div>
          </div>
          <div className={styles.miniWidget}>
            <div className={styles.miniWidgetLabel}>Urgência operacional</div>
            <div className={styles.miniWidgetValue}>{urgencyPct}%</div>
            <div className={styles.miniProgress}>
              <span className={styles.miniProgressFillInfo} style={{ width: `${Math.min(urgencyPct, 100)}%` }} />
            </div>
            <div className={styles.miniWidgetMeta}>Tarefas de alta prioridade</div>
          </div>
          <div className={styles.miniWidget}>
            <div className={styles.miniWidgetLabel}>Execução imediata</div>
            <div className={styles.miniWidgetValue}>{dueTodayDeadlines + highPriorityTasks}</div>
            <div className={styles.miniWidgetMeta}>Vencem hoje + tarefas urgentes</div>
          </div>
        </section>
      </section>

      <div className={styles.dashboardGrid}>
        <div className={styles.mainColumn}>
          {/* Prazos */}
          <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Prazos próximos</h2>
            <div className={styles.sectionActions}>
              <div className={styles.metaSmall}>{deadlines.length} item(ns)</div>
              <Link href="/agenda?deadlineStatus=PENDING" className={styles.inlineLink}>
                Ver agenda
              </Link>
            </div>
          </div>

          {deadlines.length === 0 ? (
            <div className={styles.empty}>
              Nenhum prazo pendente nos próximos {rangeDays} dias.
            </div>
          ) : (
            <div className={styles.list}>
              {deadlinePreview.map((d) => (
                <div key={d.id} className={styles.itemCard}>
                  <div className={styles.rowTop}>
                    <div className={styles.itemTitleWrap}>
                      <div className={styles.itemTitle}>{d.title}</div>
                      <div className={styles.itemMetaInline}>
                        Caso:{' '}
                        <Link href={`/matters/${d.matter.id}`} className={styles.link}>
                          {d.matter.title}
                        </Link>
                      </div>
                    </div>
                    <div className={styles.itemBadges}>
                      {badge(`Vence: ${formatDateBR(d.dueDate, tenantTimeZone)}`, 'warning')}
                      {badge(formatDeadlineType(d.type), 'muted')}
                    </div>
                  </div>
                </div>
              ))}
              {hiddenDeadlines > 0 ? (
                <div className={styles.metaSmall}>
                  + {hiddenDeadlines} prazo(s) não exibido(s). Use &quot;Ver agenda&quot; para ver todos.
                </div>
              ) : null}
            </div>
          )}
          </section>

          {/* Tarefas */}
          <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Tarefas em aberto</h2>
            <div className={styles.sectionActions}>
              <div className={styles.metaSmall}>{tasks.length} item(ns)</div>
              <Link href="/agenda?taskStatus=OPEN" className={styles.inlineLink}>
                Ver agenda
              </Link>
            </div>
          </div>

          {tasks.length === 0 ? (
            <div className={styles.empty}>
              Nenhuma tarefa em aberto.
            </div>
          ) : (
            <div className={styles.list}>
              {tasksPreview.map((t) => (
                <div key={t.id} className={styles.itemCard}>
                  <div className={styles.rowTop}>
                    <div className={styles.itemTitleWrap}>
                      <div className={styles.itemTitle}>{t.title}</div>
                      <div className={styles.itemMetaInline}>
                        {t.matter ? (
                          <>
                            Caso:{' '}
                            <Link href={`/matters/${t.matter.id}`} className={styles.link}>
                              {t.matter.title}
                            </Link>
                          </>
                        ) : (
                          <span className={styles.subtle}>Sem caso vinculado</span>
                        )}
                        {t.assignedTo ? (
                          <span className={styles.subtle}> · Resp.: {t.assignedTo.name}</span>
                        ) : null}
                      </div>
                    </div>
                    <div className={styles.itemBadges}>
                      {badge(formatStatus(t.status), statusTone(t.status))}
                      {badge(formatPriority(t.priority), priorityTone(t.priority))}
                      {t.dueDate ? badge(formatDateBR(t.dueDate, tenantTimeZone), 'warning') : badge('Sem prazo', 'muted')}
                    </div>
                  </div>
                </div>
              ))}
              {hiddenTasks > 0 ? (
                <div className={styles.metaSmall}>
                  + {hiddenTasks} tarefa(s) não exibida(s). Use &quot;Ver agenda&quot; para ver todas.
                </div>
              ) : null}
            </div>
          )}
          </section>
        </div>

        <aside className={styles.sideColumn}>
          <section className={styles.panel}>
            <div className={styles.sidePanelTitle}>Resumo rápido</div>
            <div className={styles.summaryList}>
              <div className={styles.summaryRow}>
                <span>Casos abertos</span>
                <strong>{counts.openMatters}</strong>
              </div>
              <div className={styles.summaryRow}>
                <span>Tarefas em aberto</span>
                <strong>{counts.openTasks}</strong>
              </div>
              <div className={styles.summaryRow}>
                <span>Prazos pendentes</span>
                <strong>{counts.pendingDeadlines}</strong>
              </div>
              <div className={styles.summaryRow}>
                <span>Prazos atrasados</span>
                <strong>{overdueDeadlines}</strong>
              </div>
            </div>
          </section>

          <EmptyState
            title="Próximo passo"
            desc="Centralize a operação no painel com ações rápidas e filtros por perfil do usuário."
            actionHref="/matters"
            actionText="Ir para Casos"
          />
        </aside>
      </div>
    </main>
  );
}

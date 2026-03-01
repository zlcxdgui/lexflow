import { ApiError, apiGet } from '@/lib/serverApi';
import { AccessDeniedView } from '@/components/AccessDeniedView';
import { BackButton } from '@/components/BackButton';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import NotificationsList from '@/components/NotificationsList';
import styles from './notifications.module.css';

type NotificationsResp = {
  total: number;
  unreadTotal: number;
  counters: {
    overdueDeadlines: number;
    todayDeadlines: number;
    highPriorityTasks: number;
    pendingInvites: number;
  };
  items: Array<{
    id: string;
    itemKey: string;
    kind:
      | 'DEADLINE_OVERDUE'
      | 'DEADLINE_TODAY'
      | 'TASK_HIGH'
      | 'TASK_ASSIGNED'
      | 'INVITE_PENDING';
    title: string;
    subtitle: string;
    href: string;
    when?: string | null;
    isRead: boolean;
  }>;
};

export default async function NotificationsPage() {
  const me = await apiGet<{ tenantTimezone?: string }>('/me').catch(() => ({
    tenantTimezone: 'America/Manaus',
  }));
  const tenantTimeZone = String(me?.tenantTimezone || 'America/Manaus');
  let data: NotificationsResp = {
    total: 0,
    unreadTotal: 0,
    counters: {
      overdueDeadlines: 0,
      todayDeadlines: 0,
      highPriorityTasks: 0,
      pendingInvites: 0,
    },
    items: [],
  };
  let loadError = '';

  try {
    data = await apiGet<NotificationsResp>('/dashboard/notifications');
  } catch (err: unknown) {
    if (err instanceof ApiError && err.status === 403) {
      return <AccessDeniedView area="Notificações" />;
    }
    loadError = err instanceof Error ? err.message : 'Erro ao carregar notificações';
  }

  return (
    <main className={`${styles.page} appPageShell`}>
      <header className={styles.header}>
        <SectionHeader
          title="Notificações"
          description="Alertas operacionais do escritório."
          headingAs="h1"
          className={styles.headerTitleBlock}
        />
        <BackButton fallbackHref="/dashboard" className={styles.backLink} />
      </header>

      <section className={styles.kpiRow}>
        <Card className={`${styles.kpiCard} ${styles.kpiDanger}`} padding="sm">
          <span>Atrasados</span>
          <strong>{data.counters.overdueDeadlines}</strong>
        </Card>
        <Card className={`${styles.kpiCard} ${styles.kpiWarning}`} padding="sm">
          <span>Vencem hoje</span>
          <strong>{data.counters.todayDeadlines}</strong>
        </Card>
        <Card className={`${styles.kpiCard} ${styles.kpiInfo}`} padding="sm">
          <span>Tarefas urgentes</span>
          <strong>{data.counters.highPriorityTasks}</strong>
        </Card>
        <Card className={styles.kpiCard} padding="sm">
          <span>Convites pendentes</span>
          <strong>{data.counters.pendingInvites}</strong>
        </Card>
      </section>

      {loadError ? (
        <Card as="section" className={styles.errorBox} padding="sm">{loadError}</Card>
      ) : (
        <Card as="section" className={styles.listCard} padding="sm">
          <NotificationsList
            items={data.items}
            unreadTotal={data.unreadTotal}
            tenantTimeZone={tenantTimeZone}
          />
        </Card>
      )}
    </main>
  );
}

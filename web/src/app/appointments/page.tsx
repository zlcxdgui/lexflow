import { ApiError, apiGet } from '@/lib/serverApi';
import { AppointmentsCrudView } from './AppointmentsCrudView';
import { AppointmentsCreatePanel } from './AppointmentsCreatePanel';
import { AccessDeniedView } from '@/components/AccessDeniedView';
import { BackButton } from '@/components/BackButton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Card } from '@/components/ui/Card';
import styles from './page.module.css';

type TaskItem = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueDate?: string | null;
  matter?: { id: string; title: string } | null;
  assignedTo?: { id: string; name: string; email: string } | null;
};

function isAppointment(title: string) {
  return String(title || '').trim().toLowerCase().startsWith('atendimento');
}

type AppointmentsPageProps = {
  searchParams?:
    | { appointmentId?: string }
    | Promise<{ appointmentId?: string }>;
};

export default async function AppointmentsPage({ searchParams }: AppointmentsPageProps) {
  const params = await Promise.resolve(searchParams || {});
  const appointmentId = String(params?.appointmentId || '').trim();

  let tasks: TaskItem[] = [];
  let error = '';
  const me = await apiGet<{ tenantTimezone?: string }>('/me').catch(() => ({
    tenantTimezone: 'America/Manaus',
  }));
  const tenantTimeZone = String(me?.tenantTimezone || 'America/Manaus');
  try {
    const response = await apiGet<TaskItem[] | { value: TaskItem[] }>('/appointments?status=ALL');
    tasks = Array.isArray(response) ? response : response?.value || [];
  } catch (err: unknown) {
    if (err instanceof ApiError && err.status === 403) {
      return <AccessDeniedView area="Atendimento" />;
    }
    error = err instanceof Error ? err.message : 'Erro ao carregar atendimentos.';
  }

  const appointments = tasks
    .filter((task) => isAppointment(task.title))
    .filter((task) => (appointmentId ? task.id === appointmentId : true))
    .sort((a, b) => {
      const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });

  return (
    <main className={`${styles.page} appPageShell`}>
      <SectionHeader
        title="Atendimento"
        description="Cadastre e gerencie atendimentos do escritório em uma tela única."
        headingAs="h1"
        className={styles.header}
        actions={<BackButton fallbackHref="/dashboard" className={styles.backLink} />}
      />

      {error ? <Card as="section" className={styles.error} padding="sm">{error}</Card> : null}

      <AppointmentsCreatePanel />

      <AppointmentsCrudView
        items={appointments}
        focusedAppointmentId={appointmentId || undefined}
        tenantTimeZone={tenantTimeZone}
      />
    </main>
  );
}

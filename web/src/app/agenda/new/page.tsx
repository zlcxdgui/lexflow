import AgendaAppointmentForm from '@/components/AgendaAppointmentForm';
import { BackButton } from '@/components/BackButton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import styles from './page.module.css';

export default function NewAgendaAppointmentPage() {
  return (
    <main className={`${styles.page} appPageShell`}>
      <SectionHeader
        title="Novo atendimento na agenda"
        description="Crie um compromisso e vincule responsável, cliente e caso (opcional)."
        headingAs="h1"
        className={styles.header}
        actions={<BackButton fallbackHref="/dashboard" className={styles.backLink} />}
      />

      <AgendaAppointmentForm />
    </main>
  );
}

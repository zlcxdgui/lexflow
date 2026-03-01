'use client';

import type { ReactNode } from 'react';
import styles from './DashboardQuickAppointmentCard.module.css';

type Props = {
  title?: string;
  loading?: boolean;
  error?: string;
  success?: string;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
  children: ReactNode;
};

export default function AppointmentTaskFormCard({
  title = 'Novo atendimento na agenda',
  loading = false,
  error = '',
  success = '',
  onSubmit,
  children,
}: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
      </div>

      {loading ? <div className={styles.muted}>Carregando dados...</div> : null}
      {error ? <div className={styles.error}>{error}</div> : null}
      {success ? <div className={styles.success}>{success}</div> : null}

      <form className={styles.form} onSubmit={onSubmit} suppressHydrationWarning>
        {children}
      </form>
    </div>
  );
}

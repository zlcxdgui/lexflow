'use client';

import { useState } from 'react';
import AgendaAppointmentForm from '@/components/AgendaAppointmentForm';
import { UIButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import styles from './page.module.css';

export function AppointmentsCreatePanel() {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  return (
    <Card as="section" className={`${styles.card} ${styles.createCard}`} padding="md">
      <SectionHeader
        title="Novo atendimento"
        className={styles.createHeader}
        actions={
          <UIButton type="button" variant="primary" onClick={() => setOpen((prev) => !prev)}>
            {open ? 'Fechar formulário' : 'Adicionar à agenda'}
          </UIButton>
        }
      />

      {open ? (
        <div className={styles.createFormWrap}>
          <AgendaAppointmentForm
            key={formKey}
            redirectTo="/appointments"
            apiBase="/api/appointments"
            onSuccess={() => {
              setFormKey((prev) => prev + 1);
              setOpen(false);
            }}
          />
        </div>
      ) : null}
    </Card>
  );
}

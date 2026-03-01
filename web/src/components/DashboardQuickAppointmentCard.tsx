'use client';

import { useState } from 'react';
import AppointmentTaskFormCard from './AppointmentTaskFormCard';
import AppointmentTaskFormFields from './AppointmentTaskFormFields';
import {
  appointmentClientSimpleLabel,
  appointmentToLocalIsoLocal,
} from './appointmentUtils';
import useAppointmentTaskForm from './useAppointmentTaskForm';
import styles from './DashboardQuickAppointmentCard.module.css';

export default function DashboardQuickAppointmentCard() {
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState('');
  const {
    loading,
    dataError,
    submitting,
    submitError,
    clientSuggestions,
    matterSuggestions,
    responsibleSuggestions,
    clientQuery,
    matterQuery,
    responsibleQuery,
    openPicker,
    date,
    time,
    notes,
    setClientQuery,
    setMatterQuery,
    setResponsibleQuery,
    setOpenPicker,
    setDate,
    setTime,
    setNotes,
    clearClientSelection,
    clearMatterSelection,
    selectClient,
    selectMatter,
    selectResponsible,
    submit,
  } = useAppointmentTaskForm({
    apiBase: '/api/tasks',
    dueDateFormatter: appointmentToLocalIsoLocal,
    clientSearchText: (client) => `${client.code || ''} ${client.name}`,
    clientSelectedLabel: (client) => client.name,
    showSuggestionsWhenEmpty: true,
    resetOnSuccess: 'notes',
    onSuccess: () => {
      setSuccess('Atendimento adicionado à agenda.');
    },
  });

  return (
    <section className={styles.wrap}>
      <button
        type="button"
        className={styles.quickButton}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.quickTitle}>Ação rápida</span>
        <span className={styles.quickAction}>Novo atendimento</span>
      </button>

      {open ? (
        <AppointmentTaskFormCard
          loading={loading}
          error={submitError || dataError}
          success={success}
          onSubmit={async (e) => {
            e.preventDefault();
            setSuccess('');
            await submit();
          }}
        >
          <AppointmentTaskFormFields
            loading={loading}
            submitting={submitting}
            clientSuggestions={clientSuggestions}
            matterSuggestions={matterSuggestions}
            responsibleSuggestions={responsibleSuggestions}
            clientQuery={clientQuery}
            matterQuery={matterQuery}
            responsibleQuery={responsibleQuery}
            openPicker={openPicker}
            date={date}
            time={time}
            notes={notes}
            setClientQuery={setClientQuery}
            setMatterQuery={setMatterQuery}
            setResponsibleQuery={setResponsibleQuery}
            setOpenPicker={setOpenPicker}
            setDate={setDate}
            setTime={setTime}
            setNotes={setNotes}
            clearClientSelection={clearClientSelection}
            clearMatterSelection={clearMatterSelection}
            selectClient={selectClient}
            selectMatter={selectMatter}
            selectResponsible={selectResponsible}
            clientOptionLabel={(client) => <span>{appointmentClientSimpleLabel(client)}</span>}
            clientInputMode="focus-opens"
            submitLabel="Adicionar à agenda"
            submittingLabel="Salvando..."
          />
        </AppointmentTaskFormCard>
      ) : null}
    </section>
  );
}

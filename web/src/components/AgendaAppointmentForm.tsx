'use client';

import { useRouter } from 'next/navigation';
import AppointmentTaskFormCard from './AppointmentTaskFormCard';
import AppointmentTaskFormFields from './AppointmentTaskFormFields';
import {
  appointmentClientFullLabel,
  appointmentToLocalIsoUtc,
} from './appointmentUtils';
import useAppointmentTaskForm from './useAppointmentTaskForm';

export default function AgendaAppointmentForm({
  redirectTo = '/dashboard',
  apiBase = '/api/tasks',
  onSuccess,
}: {
  redirectTo?: string;
  apiBase?: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
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
    apiBase,
    dueDateFormatter: appointmentToLocalIsoUtc,
    clientSearchText: (client) => `${client.code || ''} ${client.name} ${client.cpf || ''}`,
    clientSelectedLabel: appointmentClientFullLabel,
    showSuggestionsWhenEmpty: false,
    resetOnSuccess: 'all',
    onSuccess: async () => {
      onSuccess?.();
      if (redirectTo) {
        router.push(redirectTo);
      }
      router.refresh();
    },
  });

  return (
    <AppointmentTaskFormCard
      loading={loading}
      error={submitError || dataError}
      onSubmit={async (e) => {
        e.preventDefault();
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
        clientOptionLabel={(client) => <span>{appointmentClientFullLabel(client)}</span>}
        clientInputMode="type-opens"
        submitLabel="Adicionar à agenda"
        submittingLabel="Salvando..."
      />
    </AppointmentTaskFormCard>
  );
}

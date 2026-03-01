'use client';

import AppointmentPickerField from './AppointmentPickerField';
import styles from './DashboardQuickAppointmentCard.module.css';
import type { AppointmentClient, AppointmentMatter, AppointmentMember } from './useAppointmentPickerData';

type PickerKey = 'client' | 'matter' | 'responsible';

type Props = {
  loading: boolean;
  submitting: boolean;
  clientSuggestions: AppointmentClient[];
  matterSuggestions: AppointmentMatter[];
  responsibleSuggestions: AppointmentMember[];
  clientQuery: string;
  matterQuery: string;
  responsibleQuery: string;
  openPicker: PickerKey | null;
  date: string;
  time: string;
  notes: string;
  setClientQuery: (value: string) => void;
  setMatterQuery: (value: string) => void;
  setResponsibleQuery: (value: string) => void;
  setOpenPicker: (picker: PickerKey | null) => void;
  setDate: (value: string) => void;
  setTime: (value: string) => void;
  setNotes: (value: string) => void;
  clearClientSelection: () => void;
  clearMatterSelection: () => void;
  selectClient: (id: string) => void;
  selectMatter: (id: string) => void;
  selectResponsible: (userId: string) => void;
  clientOptionLabel: (client: AppointmentClient) => React.ReactNode;
  clientInputMode: 'focus-opens' | 'type-opens';
  submitLabel: string;
  submittingLabel: string;
};

export default function AppointmentTaskFormFields({
  loading,
  submitting,
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
  clientOptionLabel,
  clientInputMode,
  submitLabel,
  submittingLabel,
}: Props) {
  const openOnFocus = clientInputMode === 'focus-opens';
  const closeOnFocus = clientInputMode === 'type-opens';
  const showWhenEmpty = clientInputMode === 'focus-opens';

  return (
    <>
      <AppointmentPickerField
        label="Cliente (opcional)"
        query={clientQuery}
        onQueryChange={setClientQuery}
        placeholder="Buscar cliente por código ou nome"
        disabled={loading}
        isOpen={openPicker === 'client'}
        onOpenChange={(open) => setOpenPicker(open ? 'client' : null)}
        options={clientSuggestions}
        getOptionKey={(client) => client.id}
        renderOption={clientOptionLabel}
        onSelect={(client) => selectClient(client.id)}
        clearOptionLabel="Sem cliente vinculado"
        onClearSelection={clearClientSelection}
        openOnFocus={openOnFocus}
        closeOnFocus={closeOnFocus}
        showWhenEmpty={showWhenEmpty}
        elevateOnOpen={closeOnFocus}
      />

      <AppointmentPickerField
        label="Caso vinculado (opcional)"
        query={matterQuery}
        onQueryChange={setMatterQuery}
        placeholder="Buscar caso por título"
        disabled={loading}
        isOpen={openPicker === 'matter'}
        onOpenChange={(open) => setOpenPicker(open ? 'matter' : null)}
        options={matterSuggestions}
        getOptionKey={(matter) => matter.id}
        renderOption={(matter) => <span>{matter.title}</span>}
        onSelect={(matter) => selectMatter(matter.id)}
        clearOptionLabel="Sem caso vinculado"
        onClearSelection={clearMatterSelection}
        openOnFocus={openOnFocus}
        closeOnFocus={closeOnFocus}
        showWhenEmpty={showWhenEmpty}
        elevateOnOpen={closeOnFocus}
      />

      <AppointmentPickerField
        label="Responsável"
        query={responsibleQuery}
        onQueryChange={setResponsibleQuery}
        placeholder="Buscar responsável por nome ou e-mail"
        disabled={loading}
        isOpen={openPicker === 'responsible'}
        onOpenChange={(open) => setOpenPicker(open ? 'responsible' : null)}
        options={responsibleSuggestions}
        getOptionKey={(member) => member.user.id}
        renderOption={(member) => (
          <>
            <span>{member.user.name}</span>
            <span className={styles.personOptionMeta}>{member.user.email}</span>
          </>
        )}
        onSelect={(member) => selectResponsible(member.user.id)}
        openOnFocus={openOnFocus}
        closeOnFocus={closeOnFocus}
        showWhenEmpty={showWhenEmpty}
        elevateOnOpen={closeOnFocus}
      />

      <div className={styles.row}>
        <label className={styles.field}>
          <span>Data</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Hora</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
      </div>

      <label className={styles.field}>
        <span>Observações</span>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex.: cliente virá para assinatura de procuração."
        />
      </label>

      <div className={styles.actions}>
        <button type="submit" disabled={loading || submitting}>
          {submitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { todayIsoDate } from './appointmentUtils';
import useAppointmentPickerData from './useAppointmentPickerData';

type PickerKey = 'client' | 'matter' | 'responsible';
type ResetMode = 'all' | 'notes' | 'none';

type UseAppointmentTaskFormOptions = {
  apiBase: string;
  dueDateFormatter: (date: string, time: string) => string;
  clientSearchText: (client: {
    code?: number | null;
    name: string;
    cpf?: string | null;
  }) => string;
  clientSelectedLabel: (client: { code?: number | null; name: string; cpf?: string | null }) => string;
  showSuggestionsWhenEmpty: boolean;
  resetOnSuccess?: ResetMode;
  onSuccess?: () => void | Promise<void>;
};

export default function useAppointmentTaskForm(options: UseAppointmentTaskFormOptions) {
  const {
    loading,
    error: dataError,
    clients,
    matters,
    members,
  } = useAppointmentPickerData();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [clientId, setClientId] = useState('');
  const [matterId, setMatterId] = useState('');
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [clientQuery, setClientQuery] = useState('');
  const [matterQuery, setMatterQuery] = useState('');
  const [responsibleQuery, setResponsibleQuery] = useState('');
  const [openPicker, setOpenPicker] = useState<PickerKey | null>(null);
  const [date, setDate] = useState(todayIsoDate());
  const [time, setTime] = useState('09:00');
  const [notes, setNotes] = useState('');

  function resetAll() {
    setClientId('');
    setMatterId('');
    setAssignedToUserId('');
    setClientQuery('');
    setMatterQuery('');
    setResponsibleQuery('');
    setOpenPicker(null);
    setDate(todayIsoDate());
    setTime('09:00');
    setNotes('');
    setSubmitError('');
  }

  const mattersByClient = useMemo(() => {
    if (!clientId) return matters;
    const matched = matters.filter((m) => (m.client?.id || m.clientId || '') === clientId);
    return matched.length > 0 ? matched : matters;
  }, [matters, clientId]);

  const clientSuggestions = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q && !options.showSuggestionsWhenEmpty) return [];
    return clients.filter((c) => options.clientSearchText(c).toLowerCase().includes(q));
  }, [clients, clientQuery, options]);

  const matterSuggestions = useMemo(() => {
    const q = matterQuery.trim().toLowerCase();
    if (!q && !options.showSuggestionsWhenEmpty) return [];
    return mattersByClient.filter((m) => m.title.toLowerCase().includes(q));
  }, [mattersByClient, matterQuery, options.showSuggestionsWhenEmpty]);

  const responsibleSuggestions = useMemo(() => {
    const q = responsibleQuery.trim().toLowerCase();
    if (!q && !options.showSuggestionsWhenEmpty) return [];
    return members.filter((m) => `${m.user.name} ${m.user.email}`.toLowerCase().includes(q));
  }, [members, responsibleQuery, options.showSuggestionsWhenEmpty]);

  useEffect(() => {
    if (!mattersByClient.some((m) => m.id === matterId)) {
      setMatterId('');
      setMatterQuery('');
    }
  }, [mattersByClient, matterId]);

  useEffect(() => {
    if (!clientId) return;
    const selected = clients.find((c) => c.id === clientId);
    if (!selected) return;
    const label = options.clientSelectedLabel(selected);
    if (clientQuery !== label) setClientQuery(label);
  }, [clientId, clientQuery, clients, options]);

  useEffect(() => {
    if (!matterId) return;
    const selected = mattersByClient.find((m) => m.id === matterId);
    if (selected && matterQuery !== selected.title) setMatterQuery(selected.title);
  }, [matterId, matterQuery, mattersByClient]);

  useEffect(() => {
    if (!assignedToUserId) return;
    const selected = members.find((m) => m.user.id === assignedToUserId);
    if (selected && responsibleQuery !== selected.user.name) {
      setResponsibleQuery(selected.user.name);
    }
  }, [assignedToUserId, members, responsibleQuery]);

  function selectClient(id: string) {
    const selected = clients.find((item) => item.id === id);
    setClientId(id);
    setClientQuery(selected ? options.clientSelectedLabel(selected) : '');
    setOpenPicker(null);
  }

  function selectMatter(id: string) {
    const selected = mattersByClient.find((item) => item.id === id);
    setMatterId(id);
    setMatterQuery(selected?.title || '');
    setOpenPicker(null);
  }

  function selectResponsible(userId: string) {
    const selected = members.find((m) => m.user.id === userId);
    setAssignedToUserId(userId);
    setResponsibleQuery(selected?.user.name || '');
    setOpenPicker(null);
  }

  async function submit() {
    setSubmitError('');

    if (!assignedToUserId) {
      setSubmitError('Selecione o responsável.');
      return false;
    }
    if (!date) {
      setSubmitError('Informe a data do atendimento.');
      return false;
    }

    const client = clients.find((c) => c.id === clientId);
    const title = client?.name
      ? `Atendimento: ${client.name}`
      : 'Atendimento (sem cliente vinculado)';
    const dueDate = options.dueDateFormatter(date, time);
    const descriptionParts: string[] = [];
    if (client?.name) descriptionParts.push(`Cliente: ${client.name}`);
    if (notes.trim()) descriptionParts.push(notes.trim());

    setSubmitting(true);
    try {
      const resp = await fetch(options.apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matterId: matterId || undefined,
          title,
          description: descriptionParts.join('\n') || null,
          priority: 'MEDIUM',
          dueDate,
          assignedToUserId,
        }),
      });
      const text = await resp.text();
      if (!resp.ok) throw new Error(text || 'Falha ao criar registro na agenda.');

      if (options.resetOnSuccess === 'all') resetAll();
      if (options.resetOnSuccess === 'notes') setNotes('');
      await options.onSuccess?.();
      return true;
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Falha ao criar atendimento.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  return {
    loading,
    dataError,
    submitting,
    submitError,
    clients,
    matters,
    members,
    mattersByClient,
    clientSuggestions,
    matterSuggestions,
    responsibleSuggestions,
    clientId,
    matterId,
    assignedToUserId,
    clientQuery,
    matterQuery,
    responsibleQuery,
    openPicker,
    date,
    time,
    notes,
    setClientQuery: (next: string) => {
      setClientQuery(next);
      setClientId('');
    },
    setMatterQuery: (next: string) => {
      setMatterQuery(next);
      setMatterId('');
    },
    setResponsibleQuery: (next: string) => {
      setResponsibleQuery(next);
      setAssignedToUserId('');
    },
    setOpenPicker,
    setDate,
    setTime,
    setNotes,
    clearClientSelection: () => {
      setClientId('');
      setClientQuery('');
    },
    clearMatterSelection: () => {
      setMatterId('');
      setMatterQuery('');
    },
    selectClient,
    selectMatter,
    selectResponsible,
    submit,
    resetAll,
  };
}

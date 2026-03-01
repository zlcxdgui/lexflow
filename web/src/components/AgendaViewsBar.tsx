'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import styles from '@/app/agenda/agenda.module.css';
import { UISelect } from '@/components/ui/Select';

type AgendaViewFilters = {
  taskStatus?: string;
  taskPriority?: string;
  deadlineStatus?: string;
  deadlineType?: string;
  assignee?: string;
  q?: string;
};

type AgendaView = {
  id: string;
  name: string;
  isDefault: boolean;
  filters: AgendaViewFilters;
};

type Props = {
  views: AgendaView[];
  currentFilters: AgendaViewFilters;
  canDelete?: boolean;
};

export default function AgendaViewsBar({
  views,
  currentFilters,
  canDelete = true,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [selectedId, setSelectedId] = useState<string>(views.find((v) => v.isDefault)?.id || views[0]?.id || '');
  const [name, setName] = useState('');
  const [renameName, setRenameName] = useState('');
  const [busy, setBusy] = useState<'save' | 'default' | 'delete' | ''>('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selected = useMemo(() => views.find((v) => v.id === selectedId) || null, [selectedId, views]);

  function withFilters(filters: AgendaViewFilters) {
    const next = new URLSearchParams(params.toString());
    const mapping: Record<string, string | undefined> = {
      taskStatus: filters.taskStatus || 'ALL',
      taskPriority: filters.taskPriority || 'ALL',
      deadlineStatus: filters.deadlineStatus || 'ALL',
      deadlineType: filters.deadlineType || 'ALL',
      assignee: filters.assignee || '',
      q: filters.q || '',
    };
    Object.entries(mapping).forEach(([k, v]) => {
      if (v && v !== 'ALL') next.set(k, v);
      else if (k === 'taskStatus' || k === 'taskPriority' || k === 'deadlineStatus' || k === 'deadlineType') next.set(k, 'ALL');
      else next.delete(k);
    });
    next.set('eventsPage', '1');
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  async function saveView() {
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Informe um nome para salvar a visão.');
      setSuccess('');
      return;
    }
    setError('');
    setSuccess('');
    setBusy('save');
    try {
      const resp = await fetch('/api/agenda/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName, filters: currentFilters }),
      });
      if (!resp.ok) throw new Error('Falha ao salvar visão');
      setName('');
      setSuccess('Visão salva com sucesso.');
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar visão');
    } finally {
      setBusy('');
    }
  }

  async function setDefault() {
    if (!selected) return;
    setError('');
    setSuccess('');
    setBusy('default');
    try {
      const resp = await fetch(`/api/agenda/views/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setDefault: true }),
      });
      if (!resp.ok) throw new Error('Falha ao definir padrão');
      setSuccess('Visão definida como padrão.');
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Falha ao definir padrão');
    } finally {
      setBusy('');
    }
  }

  async function renameView() {
    if (!selected) return;
    const cleanName = renameName.trim();
    if (!cleanName) {
      setError('Informe um nome para renomear.');
      setSuccess('');
      return;
    }
    setError('');
    setSuccess('');
    setBusy('default');
    try {
      const resp = await fetch(`/api/agenda/views/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName }),
      });
      if (!resp.ok) throw new Error('Falha ao renomear visão');
      setRenameName('');
      setSuccess('Visão renomeada com sucesso.');
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Falha ao renomear visão');
    } finally {
      setBusy('');
    }
  }

  async function duplicateView() {
    if (!selected) return;
    setError('');
    setSuccess('');
    setBusy('save');
    try {
      const resp = await fetch('/api/agenda/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${selected.name} (cópia)`,
          filters: selected.filters,
          setDefault: false,
        }),
      });
      if (!resp.ok) throw new Error('Falha ao duplicar visão');
      setSuccess('Visão duplicada com sucesso.');
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Falha ao duplicar visão');
    } finally {
      setBusy('');
    }
  }

  async function removeView() {
    if (!selected) return;
    setError('');
    setSuccess('');
    setBusy('delete');
    try {
      const resp = await fetch(`/api/agenda/views/${selected.id}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error('Falha ao excluir visão');
      setSelectedId('');
      setSuccess('Visão excluída com sucesso.');
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Falha ao excluir visão');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className={styles.viewsBar}>
      <div className={styles.viewsLeft}>
        <label className={styles.field}>
          <span>Visões salvas</span>
          <UISelect
            className={styles.input}
            value={selectedId}
            onChange={setSelectedId}
            ariaLabel="Visões salvas"
            options={[
              { value: '', label: 'Selecione' },
              ...views.map((view) => ({
                value: view.id,
                label: `${view.name}${view.isDefault ? ' (padrão)' : ''}`,
              })),
            ]}
          />
        </label>
        <button
          type="button"
          className={styles.submitBtn}
          disabled={!selected}
          onClick={() => selected && withFilters(selected.filters)}
        >
          Aplicar visão
        </button>
        <button
          type="button"
          className={styles.navBtn}
          disabled={!selected || busy !== ''}
          onClick={duplicateView}
        >
          {busy === 'save' ? 'Duplicando...' : 'Duplicar'}
        </button>
        <button
          type="button"
          className={styles.navBtn}
          disabled={!selected || busy !== ''}
          onClick={setDefault}
        >
          {busy === 'default' ? 'Salvando...' : 'Definir padrão'}
        </button>
        {canDelete ? (
          <button
            type="button"
            className={styles.navBtn}
            disabled={!selected || busy !== ''}
            onClick={removeView}
          >
            {busy === 'delete' ? 'Excluindo...' : 'Excluir'}
          </button>
        ) : null}
      </div>

      <div className={styles.viewsRight}>
        <label className={styles.field}>
          <span>Salvar visão atual</span>
          <input
            className={styles.input}
            placeholder="Ex.: Prazos críticos"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button
          type="button"
          className={styles.submitBtn}
          disabled={busy !== ''}
          onClick={saveView}
        >
          {busy === 'save' ? 'Salvando...' : 'Salvar visão'}
        </button>
        <label className={styles.field}>
          <span>Renomear visão selecionada</span>
          <input
            className={styles.input}
            placeholder={selected ? selected.name : 'Selecione uma visão'}
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            disabled={!selected}
          />
        </label>
        <button
          type="button"
          className={styles.submitBtn}
          disabled={!selected || busy !== ''}
          onClick={renameView}
        >
          {busy === 'default' ? 'Renomeando...' : 'Renomear'}
        </button>
      </div>
      {error ? <div className={styles.errorInline}>{error}</div> : null}
      {success ? <div className={styles.successInline}>{success}</div> : null}
    </div>
  );
}

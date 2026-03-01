'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import styles from '@/app/audit/audit.module.css';
import { UISelect } from '@/components/ui/Select';

type Option = {
  value: string;
  label: string;
};

type Props = {
  q: string;
  action: string;
  routine: string;
  user: string;
  from: string;
  to: string;
  run: boolean;
  routineOptions: Option[];
  userOptions: Option[];
};

export function AuditFilters({
  q,
  action,
  routine,
  user,
  from,
  to,
  run,
  routineOptions,
  userOptions,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const base = useMemo(() => new URLSearchParams(search.toString()), [search]);

  const [localQ, setLocalQ] = useState(q);
  const [localRoutine, setLocalRoutine] = useState(routine);
  const [localUser, setLocalUser] = useState(user);
  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);
  const [exportingPdf, setExportingPdf] = useState(false);

  async function applyFilters() {
    const params = new URLSearchParams(base.toString());
    params.set('page', '1');
    params.set('run', '1');
    if (localQ.trim()) params.set('q', localQ.trim());
    else params.delete('q');
    if (action) params.set('action', action);
    else params.delete('action');
    if (localRoutine) params.set('routine', localRoutine);
    else params.delete('routine');
    if (localUser) params.set('user', localUser);
    else params.delete('user');
    if (localFrom) params.set('from', localFrom);
    else params.delete('from');
    if (localTo) params.set('to', localTo);
    else params.delete('to');
    try {
      await fetch('/api/audit/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'PROCESS',
          q: localQ.trim(),
          routine: localRoutine,
          user: localUser,
          from: localFrom,
          to: localTo,
        }),
      });
    } catch {
      // não bloquear processamento por falha de auditoria
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await applyFilters();
  }

  async function exportPdf() {
    try {
      setExportingPdf(true);
      const params = new URLSearchParams();
      if (localQ.trim()) params.set('q', localQ.trim());
      if (action) params.set('action', action);
      if (localRoutine) params.set('routine', localRoutine);
      if (localUser) params.set('user', localUser);
      if (localFrom) params.set('from', localFrom);
      if (localTo) params.set('to', localTo);

      try {
        await fetch('/api/audit/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'EXPORT_PDF',
            q: localQ.trim(),
            routine: localRoutine,
            user: localUser,
            from: localFrom,
            to: localTo,
          }),
        });
      } catch {
        // não bloquear exportação por falha de auditoria de ação
      }

      const query = params.toString();
      window.location.href = query
        ? `/api/audit/export/pdf?${query}`
        : '/api/audit/export/pdf';
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <form className={styles.auditFiltersPanel} onSubmit={onSubmit} suppressHydrationWarning>
      <div className={styles.auditTabsWrap}>
        <span className={styles.auditTabsLabel}>Rotina</span>
        <div className={styles.auditTabs}>
          {routineOptions.map((item) => (
            <button
              key={item.value || 'all'}
              type="button"
              className={`${styles.auditTab} ${localRoutine === item.value ? styles.auditTabActive : ''}`}
              onClick={() => setLocalRoutine(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.auditFiltersRow}>
        <label className={styles.field}>
          <span>Período de análise inicial</span>
          <input
            className={styles.input}
            type="date"
            value={localFrom}
            onChange={(event) => setLocalFrom(event.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>Período de análise final</span>
          <input
            className={styles.input}
            type="date"
            value={localTo}
            onChange={(event) => setLocalTo(event.target.value)}
          />
        </label>
      </div>

      <div className={styles.auditFiltersRow}>
        <label className={styles.field}>
          <span>Usuário</span>
          <UISelect
            className={styles.input}
            value={localUser}
            onChange={setLocalUser}
            ariaLabel="Usuário"
            options={[
              { value: '', label: 'Todos' },
              ...userOptions.map((item) => ({ value: item.value, label: item.label })),
            ]}
          />
        </label>
        <div className={styles.field} />
      </div>

      <div className={styles.auditFiltersRow}>
        <label className={`${styles.field} ${styles.auditFiltersSearch}`}>
          <span>Busca textual (opcional)</span>
          <input
            className={styles.input}
            value={localQ}
            onChange={(event) => setLocalQ(event.target.value)}
            placeholder="Buscar por detalhe, usuário ou caso..."
          />
        </label>
        <div className={styles.auditFiltersActions}>
          <button type="submit" className={styles.submitBtn}>
            {run ? 'Processar novamente' : 'Processar'}
          </button>
          <button
            type="button"
            className={styles.submitBtn}
            onClick={exportPdf}
            disabled={exportingPdf}
          >
            {exportingPdf ? 'Exportando PDF...' : 'Exportar PDF'}
          </button>
          <Link href="/audit" className={styles.clearBtn}>
            Limpar filtros
          </Link>
        </div>
      </div>
    </form>
  );
}

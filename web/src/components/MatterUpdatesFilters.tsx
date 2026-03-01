'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import styles from '@/app/matters/[id]/matter.module.css';
import { UISelect } from '@/components/ui/Select';

type Props = {
  matterId: string;
  updateType: string;
  updateFrom: string;
  updateTo: string;
  updateQ: string;
  updateOrder: string;
};

export function MatterUpdatesFilters({
  matterId,
  updateType,
  updateFrom,
  updateTo,
  updateQ,
  updateOrder,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [q, setQ] = useState(updateQ);

  const base = useMemo(() => new URLSearchParams(search.toString()), [search]);

  useEffect(() => {
    setQ(updateQ);
  }, [updateQ]);

  function replaceParam(name: string, value: string, resetPage = true) {
    const params = new URLSearchParams(base.toString());
    params.set('tab', 'updates');
    if (resetPage) params.set('updatePage', '1');
    if (value) params.set(name, value);
    else params.delete(name);
    router.replace(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      replaceParam('updateQ', q.trim());
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className={styles.updateFiltersWrap}>
    <div className={styles.updateFiltersGrid}>
      <label className={`${styles.updateField} ${styles.updateFieldWide}`}>
        <span>Busca</span>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por título, descrição ou usuário..."
          className={styles.updateInput}
        />
      </label>
      <label className={`${styles.updateField} ${styles.updateFieldCompact}`}>
        <span>Tipo</span>
        <UISelect
          value={updateType}
          onChange={(value) => replaceParam('updateType', value)}
          className={styles.updateInput}
          ariaLabel="Tipo"
          options={[
            { value: 'ALL', label: 'Todos' },
            { value: 'GERAL', label: 'Geral' },
            { value: 'PROCESSUAL', label: 'Processual' },
            { value: 'AUDIENCIA', label: 'Audiência' },
            { value: 'ATENDIMENTO', label: 'Atendimento' },
          ]}
        />
      </label>
      <label className={`${styles.updateField} ${styles.updateFieldCompact}`}>
        <span>Ordem</span>
        <UISelect
          value={updateOrder}
          onChange={(value) => replaceParam('updateOrder', value, false)}
          className={styles.updateInput}
          ariaLabel="Ordem"
          options={[
            { value: 'recent', label: 'Mais recentes' },
            { value: 'oldest', label: 'Mais antigos' },
            { value: 'type', label: 'Tipo (A-Z)' },
          ]}
        />
      </label>
      <label
        className={`${styles.updateField} ${styles.updateFieldCompact} ${styles.updateDateField}`}
      >
        <span>De</span>
        <input
          type="date"
          value={updateFrom}
          onChange={(e) => replaceParam('updateFrom', e.target.value)}
          className={styles.updateInput}
        />
      </label>
      <label
        className={`${styles.updateField} ${styles.updateFieldCompact} ${styles.updateDateField}`}
      >
        <span>Até</span>
        <input
          type="date"
          value={updateTo}
          onChange={(e) => replaceParam('updateTo', e.target.value)}
          className={styles.updateInput}
        />
      </label>
      <div className={styles.updateFilterActions}>
        <Link
          href={`/matters/${matterId}?tab=updates`}
          className={`${styles.actionLink} ${styles.updateClearButton}`}
        >
          Limpar filtros
        </Link>
      </div>
    </div>
    </div>
  );
}

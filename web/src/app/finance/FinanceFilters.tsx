'use client';

import Link from 'next/link';
import { useState } from 'react';
import { UISelect } from '@/components/ui/Select';
import styles from './finance.module.css';

type OptionItem = { id: string; name: string };

type FinanceFiltersProps = {
  categories: OptionItem[];
  costCenters: OptionItem[];
  accounts: OptionItem[];
  initial?: {
    q?: string;
    categoryId?: string;
    costCenterId?: string;
    accountId?: string;
    status?: string;
    direction?: string;
    from?: string;
    to?: string;
  };
};

export function FinanceFilters({ categories, costCenters, accounts, initial }: FinanceFiltersProps) {
  const current = (name: keyof NonNullable<FinanceFiltersProps['initial']>) => initial?.[name] || '';
  const [from, setFrom] = useState(current('from'));
  const [to, setTo] = useState(current('to'));

  return (
    <form method="GET" action="/finance">
      {initial?.direction ? <input type="hidden" name="direction" value={initial.direction} /> : null}
      <div className={styles.filterGrid}>
        <input
          name="q"
          className={styles.filterInput}
          defaultValue={current('q')}
          placeholder="Buscar por descrição, pessoa ou caso"
        />
        <UISelect
          className={styles.filterSelect}
          name="categoryId"
          defaultValue={current('categoryId')}
          ariaLabel="Categoria"
          options={[
            { value: '', label: 'Categoria' },
            ...categories.map((item) => ({ value: item.id, label: item.name })),
          ]}
        />
        <UISelect
          className={styles.filterSelect}
          name="costCenterId"
          defaultValue={current('costCenterId')}
          ariaLabel="Centro de custo"
          options={[
            { value: '', label: 'Centro de custo' },
            ...costCenters.map((item) => ({ value: item.id, label: item.name })),
          ]}
        />
        <UISelect
          className={styles.filterSelect}
          name="accountId"
          defaultValue={current('accountId')}
          ariaLabel="Conta"
          options={[
            { value: '', label: 'Conta' },
            ...accounts.map((item) => ({ value: item.id, label: item.name })),
          ]}
        />
        <UISelect
          className={styles.filterSelect}
          name="status"
          defaultValue={current('status')}
          ariaLabel="Status"
          options={[
            { value: '', label: 'Status' },
            { value: 'OPEN', label: 'Em aberto' },
            { value: 'OVERDUE', label: 'Vencido' },
            { value: 'SETTLED', label: 'Quitado' },
            { value: 'CANCELED', label: 'Cancelado' },
          ]}
        />
      </div>
      <div className={styles.row} style={{ marginTop: 10 }}>
        <label className={styles.label}>
          <span>De</span>
          <input
            type="date"
            name="from"
            className={styles.filterInput}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className={styles.label}>
          <span>Até</span>
          <input
            type="date"
            name="to"
            className={styles.filterInput}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      <div className={styles.filterActions}>
        <button type="submit" className={styles.smallBtn}>
          Aplicar filtros
        </button>
        <Link href="/finance" className={styles.smallBtn}>
          Limpar
        </Link>
      </div>
    </form>
  );
}

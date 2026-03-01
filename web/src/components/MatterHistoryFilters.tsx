'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import styles from '@/app/matters/[id]/matter.module.css';

type Props = {
  matterId: string;
  historyQ: string;
};

export function MatterHistoryFilters({ matterId, historyQ }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [q, setQ] = useState(historyQ);

  const base = useMemo(() => new URLSearchParams(search.toString()), [search]);

  useEffect(() => {
    setQ(historyQ);
  }, [historyQ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(base.toString());
      params.set('tab', 'history');
      params.set('historyPage', '1');
      const value = q.trim();
      if (value) params.set('historyQ', value);
      else params.delete('historyQ');
      router.replace(`${pathname}?${params.toString()}`);
    }, 300);
    return () => clearTimeout(timer);
  }, [base, pathname, q, router]);

  return (
    <div className={styles.historyFilters}>
      <input
        type="text"
        className={styles.updateInput}
        placeholder="Buscar por ação, detalhe ou usuário..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <Link
        href={`/matters/${matterId}?tab=history`}
        className={`${styles.actionLink} ${styles.updateClearButton}`}
      >
        Limpar filtros
      </Link>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import styles from '@/app/agenda/agenda.module.css';

export default function AgendaQuickSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQ = searchParams.get('q') || '';
  const [query, setQuery] = useState(urlQ);

  useEffect(() => {
    setQuery(urlQ);
  }, [urlQ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('eventsPage', '1');
      const next = query.trim();
      if (next) params.set('q', next);
      else params.delete('q');
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, 300);

    return () => clearTimeout(timer);
  }, [pathname, query, router, searchParams]);

  return (
    <input
      type="text"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      className={styles.v2Search}
      placeholder="Buscar por título, status, usuário ou caso..."
    />
  );
}

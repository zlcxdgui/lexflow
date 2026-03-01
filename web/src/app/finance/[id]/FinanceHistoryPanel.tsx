'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDateTimeBR } from '@/lib/format';
import { formatAuditActionLabel, formatAuditMetaEntries } from '../../../../../shared/auditI18n';
import styles from '../finance.module.css';

type AuditItem = {
  id: string;
  action: string;
  createdAt: string;
  metaJson?: string | null;
  user?: { id: string; name: string; email: string } | null;
};

type AuditResponse = {
  value: AuditItem[];
};

type HistoryFilter = 'all' | 'entry' | 'installments' | 'recurrence';

const PAGE_SIZE = 5;

function parseAuditMetaSummary(item: AuditItem) {
  if (!item.metaJson) return '';
  try {
    const meta = JSON.parse(item.metaJson) as Record<string, unknown>;
    return formatAuditMetaEntries(meta, 4);
  } catch {
    return '';
  }
}

function classifyFinanceAuditAction(action: string): Exclude<HistoryFilter, 'all'> {
  const value = String(action || '').toUpperCase();
  if (value.includes('INSTALLMENT')) return 'installments';
  if (value.includes('RECURRENCE')) return 'recurrence';
  return 'entry';
}

function historyFilterLabel(filter: HistoryFilter) {
  if (filter === 'entry') return 'Lançamento';
  if (filter === 'installments') return 'Parcelas';
  if (filter === 'recurrence') return 'Recorrência';
  return 'Todos';
}

export function FinanceHistoryPanel({
  entryId,
  tenantTimeZone,
}: {
  entryId: string;
  tenantTimeZone?: string;
}) {
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AuditItem[]>([]);
  const [hiddenByPermission, setHiddenByPermission] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ q: entryId, limit: '100', page: '1' });
        const res = await fetch(`/api/audit?${qs.toString()}`, { cache: 'no-store' });
        if (res.status === 401 || res.status === 403) {
          if (!active) return;
          setHiddenByPermission(true);
          return;
        }
        if (!res.ok) throw new Error('Falha ao carregar histórico');
        const data = (await res.json()) as AuditResponse;
        const next = (data.value || [])
          .filter((item) => String(item.action || '').startsWith('FINANCE_'))
          .filter((item) => String(item.metaJson || '').includes(entryId))
          .slice(0, 100);
        if (!active) return;
        setItems(next);
      } catch {
        if (!active) return;
        setError('Não foi possível carregar o histórico financeiro.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [entryId]);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((item) => classifyFinanceAuditAction(item.action) === filter);
  }, [items, filter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedItems = filteredItems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (hiddenByPermission) return null;

  return (
    <>
      <div className={styles.rowActions} style={{ justifyContent: 'space-between' }}>
        <div>
          <div className={styles.kpiLabel}>Histórico financeiro</div>
          <div className={styles.metaMuted}>Últimas ações auditadas deste lançamento</div>
        </div>
        <Link href="/audit" className={styles.linkMuted}>
          Abrir auditoria
        </Link>
      </div>

      <div className={styles.rowActions} style={{ marginTop: 10 }}>
        {(['all', 'entry', 'installments', 'recurrence'] as HistoryFilter[]).map((itemFilter) => (
          <button
            key={itemFilter}
            type="button"
            className={`${styles.smallBtn} ${filter === itemFilter ? styles.smallBtnActive : ''}`}
            onClick={() => {
              setFilter(itemFilter);
              setPage(1);
            }}
          >
            {historyFilterLabel(itemFilter)}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        {loading ? <div className={styles.metaMuted}>Carregando histórico...</div> : null}
        {!loading && error ? <div className={styles.metaMuted}>{error}</div> : null}
        {!loading && !error ? (
          pagedItems.length ? (
            <div className={styles.auditList}>
              {pagedItems.map((item) => (
                <div key={item.id} className={styles.auditRow}>
                  <div>
                    <div className={styles.auditTitle}>{formatAuditActionLabel(item.action)}</div>
                    <div className={styles.metaMuted}>
                      {item.user?.name || item.user?.email || 'Sistema'} ·{' '}
                      {formatDateTimeBR(item.createdAt, tenantTimeZone)}
                    </div>
                    {parseAuditMetaSummary(item) ? (
                      <div className={styles.metaMuted} style={{ marginTop: 4 }}>
                        {parseAuditMetaSummary(item)}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.metaMuted}>
              Nenhuma ação encontrada para o filtro {historyFilterLabel(filter)}.
            </div>
          )
        ) : null}

        {!loading && !error && filteredItems.length > PAGE_SIZE ? (
          <div className={styles.rowActions} style={{ marginTop: 10 }}>
            <span className={styles.metaMuted}>
              Página {safePage} de {totalPages}
            </span>
            <button
              type="button"
              className={styles.smallBtn}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={safePage <= 1}
            >
              Anterior
            </button>
            <button
              type="button"
              className={styles.smallBtn}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={safePage >= totalPages}
            >
              Próxima
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}

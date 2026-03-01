'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { formatDateBR, formatDeadlineType, formatPriority } from '@/lib/format';
import { Card } from '@/components/ui/Card';
import { UIButton } from '@/components/ui/Button';
import { UIListEmpty, UIListPager, UIListPagerPage, UIListRow, UIListStack } from '@/components/ui/ListRow';
import { SectionHeader } from '@/components/ui/SectionHeader';
import styles from './agenda.module.css';

export type UpcomingEventItem = {
  id: string;
  kind: 'TASK' | 'DEADLINE';
  title: string;
  date: string;
  timeLabel?: string | null;
  statusLabel: string;
  taskPriority?: string | null;
  deadlineType?: string | null;
  href?: string;
};

export function UpcomingEvents({
  items,
  pageSize = 5,
  tenantTimeZone,
}: {
  items: UpcomingEventItem[];
  pageSize?: number;
  tenantTimeZone?: string;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [currentPage, items, pageSize]);

  return (
    <Card as="section" className={styles.summaryCard} padding="sm">
      <SectionHeader title="Próximos eventos" headingAs="h2" className={styles.summaryHeader} />
      <UIListStack className={styles.quickList}>
        {pagedItems.map((e) => {
          const typeLabel =
            e.kind === 'TASK'
              ? 'Tarefa'
              : `Prazo (${formatDeadlineType(e.deadlineType || 'GENERIC')})`;
          const statusText =
            e.kind === 'TASK'
              ? `${e.statusLabel} · ${formatPriority(e.taskPriority || 'MEDIUM')}`
              : e.statusLabel;
          const content = (
            <>
              <div className={styles.quickDateBlock}>
                <span className={styles.quickDate}>{formatDateBR(e.date, tenantTimeZone)}</span>
                {e.timeLabel ? <span className={styles.quickTime}>{e.timeLabel}</span> : null}
              </div>
              <div className={styles.quickMain}>
                <div className={styles.quickTitleRow}>
                  <span
                    className={`${styles.quickTypeChip} ${
                      e.kind === 'TASK' ? styles.quickTypeTask : styles.quickTypeDeadline
                    }`}
                  >
                    {typeLabel}
                  </span>
                  <strong className={styles.quickEventTitle}>{e.title}</strong>
                </div>
              </div>
              <div className={styles.quickMetaCol}>
                <span className={styles.quickStatusChip}>{statusText}</span>
              </div>
            </>
          );

          return (
            <UIListRow key={`${e.kind}-${e.id}`} className={styles.quickListItem}>
              {e.href ? (
                <Link href={e.href} className={styles.quickLink}>
                  {content}
                </Link>
              ) : (
                <div className={styles.quickRow}>{content}</div>
              )}
            </UIListRow>
          );
        })}
        {pagedItems.length === 0 ? (
          <UIListEmpty className={styles.empty}>Sem eventos no período selecionado.</UIListEmpty>
        ) : null}
      </UIListStack>
      {totalPages > 1 ? (
        <UIListPager
          className={styles.eventsPagination}
          meta={<UIListPagerPage>Página {currentPage} de {totalPages}</UIListPagerPage>}
          actions={
            <>
          <UIButton
            type="button"
            variant="ghost"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </UIButton>
          <UIButton
            type="button"
            variant="ghost"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Próxima
          </UIButton>
            </>
          }
        />
      ) : null}
    </Card>
  );
}

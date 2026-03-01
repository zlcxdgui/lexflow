'use client';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { formatDateBR } from '@/lib/format';
import { UIButton } from '@/components/ui/Button';
import {
  UIListEmpty,
  UIListPager,
  UIListPagerPage,
  UIListRow,
  UIListRowActions,
  UIListRowMain,
  UIListStack,
} from '@/components/ui/ListRow';
import { UISelect } from '@/components/ui/Select';
import styles from '@/app/notifications/notifications.module.css';

type NotificationItem = {
  id: string;
  itemKey: string;
  kind:
    | 'DEADLINE_OVERDUE'
    | 'DEADLINE_TODAY'
    | 'TASK_HIGH'
    | 'TASK_ASSIGNED'
    | 'INVITE_PENDING';
  title: string;
  subtitle: string;
  href: string;
  when?: string | null;
  isRead: boolean;
};

function kindLabel(kind: NotificationItem['kind']) {
  if (kind === 'DEADLINE_OVERDUE') return 'Prazo atrasado';
  if (kind === 'DEADLINE_TODAY') return 'Prazo hoje';
  if (kind === 'TASK_HIGH') return 'Tarefa urgente';
  if (kind === 'TASK_ASSIGNED') return 'Tarefa atribuída';
  return 'Convite pendente';
}

export default function NotificationsList({
  items,
  unreadTotal,
  tenantTimeZone,
}: {
  items: NotificationItem[];
  unreadTotal: number;
  tenantTimeZone?: string;
}) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string>('');
  const [busyAll, setBusyAll] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const unreadItems = items.filter((item) => !item.isRead);
  const totalItems = unreadItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = totalItems === 0 ? 0 : Math.min(currentPage * pageSize, totalItems);
  const paginatedItems = useMemo(
    () => unreadItems.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [unreadItems, currentPage, pageSize],
  );

  async function markRead(itemKey: string) {
    setBusyKey(itemKey);
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemKey }),
      });
      router.refresh();
    } finally {
      setBusyKey('');
    }
  }

  async function markAllRead() {
    setBusyAll(true);
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
      router.refresh();
    } finally {
      setBusyAll(false);
    }
  }

  return (
    <>
      <div className={styles.actionsRow}>
        <span className={styles.unreadInfo}>{unreadTotal} não lida(s)</span>
        <UIButton
          type="button"
          variant="secondary"
          size="sm"
          className={styles.markAllBtn}
          disabled={busyAll || unreadTotal === 0}
          onClick={markAllRead}
        >
          {busyAll ? 'Marcando...' : 'Marcar todas como lidas'}
        </UIButton>
      </div>

      <UIListStack className={styles.list}>
        {unreadItems.length === 0 ? (
          <UIListEmpty className={styles.empty}>Nenhuma notificação no momento.</UIListEmpty>
        ) : (
          paginatedItems.map((item) => (
            <UIListRow key={`${item.kind}-${item.id}`} className={styles.item}>
              <UIListRowMain>
                <div className={styles.row}>
                <strong className={styles.itemTitle}>{item.title}</strong>
                <span className={styles.kind}>{kindLabel(item.kind)}</span>
              </div>
              <div className={styles.subtitleRow}>{item.subtitle}</div>
              <div className={styles.footer}>
                <span>{item.when ? formatDateBR(item.when, tenantTimeZone) : '-'}</span>
              </div>
              </UIListRowMain>
                <UIListRowActions className={styles.itemActions}>
                  <span className={`${styles.unreadTag} ${styles.statusTag}`}>Não lida</span>
                  <UIButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={styles.markReadBtn}
                    disabled={busyKey === item.itemKey}
                    onClick={() => markRead(item.itemKey)}
                  >
                    {busyKey === item.itemKey ? 'Marcando...' : 'Marcar lida'}
                  </UIButton>
                  <UIButton href={item.href} variant="secondary" size="sm" className={styles.openLink}>
                    Abrir
                  </UIButton>
                </UIListRowActions>
            </UIListRow>
          ))
        )}
      </UIListStack>
      {unreadItems.length > 0 ? (
        <UIListPager
          className={styles.paginationRow}
          meta={
            <span className={styles.paginationInfo}>
            Exibindo {startIndex}-{endIndex} de {totalItems}
            </span>
          }
          actions={
            <div className={styles.paginationControls}>
            <label className={styles.paginationLabel}>
              Itens:
              <UISelect
                className={styles.paginationSelect}
                value={String(pageSize)}
                ariaLabel="Itens por página"
                onChange={(value) => {
                  setPageSize(Number(value));
                  setPage(1);
                }}
                options={[
                  { value: '10', label: '10' },
                  { value: '20', label: '20' },
                  { value: '50', label: '50' },
                ]}
              />
            </label>
            <UIButton
              type="button"
              variant="ghost"
              size="sm"
              className={styles.markReadBtn}
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </UIButton>
            <UIListPagerPage>Página {currentPage} de {totalPages}</UIListPagerPage>
            <UIButton
              type="button"
              variant="ghost"
              size="sm"
              className={styles.markReadBtn}
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Próxima
            </UIButton>
          </div>
          }
        />
      ) : null}
    </>
  );
}

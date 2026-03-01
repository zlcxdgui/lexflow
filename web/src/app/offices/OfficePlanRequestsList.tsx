'use client';

import { useMemo, useState } from 'react';
import styles from './offices.module.css';
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

type OfficePlanChangeRequest = {
  id: string;
  status: string;
  requestedBillingCycle: string;
  notes?: string | null;
  requestedByEmail?: string | null;
  reviewedByEmail?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  requestedPlan: { id: string; key: string; name: string };
};

const PAGE_SIZE = 3;

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
}

export function OfficePlanRequestsList({
  requests,
  saving,
  onApprove,
  onReject,
}: {
  requests: OfficePlanChangeRequest[];
  saving: boolean;
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(requests.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return requests.slice(start, start + PAGE_SIZE);
  }, [requests, safePage]);

  if (requests.length === 0) {
    return <UIListEmpty className={styles.muted}>Nenhuma solicitação.</UIListEmpty>;
  }

  return (
    <UIListStack>
      {pageItems.map((request) => (
        <UIListRow key={request.id} className={styles.officeRequestRow}>
          <UIListRowMain className={styles.officeRequestMain}>
            <div className={styles.officeRequestTitle}>
              <span>{request.requestedPlan.name}</span>
              <span className={styles.officeRequestBadge}>{request.status}</span>
              <span className={styles.officeRequestCycle}>
                {request.requestedBillingCycle === 'YEARLY' ? 'Anual' : 'Mensal'}
              </span>
            </div>
            <div className={styles.meta}>
              {formatDate(request.createdAt)} · {request.requestedByEmail || 'Sem usuário'}
            </div>
            {request.notes ? <div className={styles.meta}>Motivo: {request.notes}</div> : null}
            {request.reviewedAt ? (
              <div className={styles.meta}>
                Revisado em {formatDate(request.reviewedAt)} · {request.reviewedByEmail || '-'}
              </div>
            ) : null}
          </UIListRowMain>
          {request.status === 'PENDING' ? (
            <UIListRowActions className={styles.actions}>
              <UIButton
                type="button"
                variant="secondary"
                size="sm"
                disabled={saving}
                onClick={() => onApprove(request.id)}
              >
                Aprovar
              </UIButton>
              <UIButton
                type="button"
                variant="danger"
                size="sm"
                disabled={saving}
                onClick={() => onReject(request.id)}
              >
                Rejeitar
              </UIButton>
            </UIListRowActions>
          ) : null}
        </UIListRow>
      ))}

      <UIListPager
        className={styles.officeRequestPager}
        meta={
          <>
          Exibindo {(safePage - 1) * PAGE_SIZE + 1}-{Math.min(safePage * PAGE_SIZE, requests.length)} de{' '}
          {requests.length}
          </>
        }
        actions={
          <>
          <UIButton
            type="button"
            variant="ghost"
            size="sm"
            disabled={safePage <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            Anterior
          </UIButton>
          <UIListPagerPage>
            Página {safePage} de {totalPages}
          </UIListPagerPage>
          <UIButton
            type="button"
            variant="ghost"
            size="sm"
            disabled={safePage >= totalPages}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          >
            Próxima
          </UIButton>
          </>
        }
      />
    </UIListStack>
  );
}

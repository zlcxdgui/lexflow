'use client';

import { useMemo, useState } from 'react';
import styles from './billing.module.css';
import { UIButton } from '@/components/ui/Button';
import {
  UIListEmpty,
  UIListPager,
  UIListPagerPage,
  UIListRow,
  UIListRowMain,
  UIListStack,
} from '@/components/ui/ListRow';

type PlanChangeRequestItem = {
  id: string;
  status: string;
  requestedBillingCycle: string;
  notes?: string | null;
  requestedByEmail?: string | null;
  reviewedByEmail?: string | null;
  reviewedAt?: string | null;
  resolutionNotes?: string | null;
  createdAt: string;
  requestedPlan: { id: string; key: string; name: string };
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
}

function cycleLabel(cycle?: string | null) {
  const normalized = String(cycle || '').toUpperCase();
  if (normalized === 'MONTHLY') return 'Mensal';
  if (normalized === 'YEARLY') return 'Anual';
  return '-';
}

function requestStatusLabel(status?: string | null) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'PENDING') return 'Pendente';
  if (normalized === 'APPROVED') return 'Aprovada';
  if (normalized === 'REJECTED') return 'Rejeitada';
  if (normalized === 'CANCELED') return 'Cancelada';
  return normalized || '-';
}

const PAGE_SIZE = 3;

export function BillingRequestsList({ requests }: { requests: PlanChangeRequestItem[] }) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(requests.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return requests.slice(start, start + PAGE_SIZE);
  }, [requests, safePage]);

  if (requests.length === 0) {
    return <UIListEmpty className={styles.requestEmpty}>Nenhuma solicitação registrada.</UIListEmpty>;
  }

  return (
    <UIListStack className={styles.requestsList}>
      {pageItems.map((request) => (
        <UIListRow key={request.id} className={styles.requestRow}>
          <UIListRowMain className={styles.requestMain}>
            <div className={styles.requestTitleLine}>
              <strong>{request.requestedPlan.name}</strong>
              <span className={styles.requestBadge}>{requestStatusLabel(request.status)}</span>
              <span className={styles.requestCycle}>{cycleLabel(request.requestedBillingCycle)}</span>
            </div>
            <div className={styles.requestMeta}>
              Solicitada em {formatDate(request.createdAt)}
              {request.requestedByEmail ? ` · por ${request.requestedByEmail}` : ''}
              {request.reviewedAt ? ` · revisada em ${formatDate(request.reviewedAt)}` : ''}
              {request.reviewedByEmail ? ` por ${request.reviewedByEmail}` : ''}
            </div>
            {request.notes ? <div className={styles.requestNotes}>Motivo: {request.notes}</div> : null}
            {request.resolutionNotes ? (
              <div className={styles.requestNotes}>Revisão: {request.resolutionNotes}</div>
            ) : null}
          </UIListRowMain>
        </UIListRow>
      ))}

      <UIListPager
        className={styles.requestPager}
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

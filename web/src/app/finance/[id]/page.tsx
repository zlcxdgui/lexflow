import Link from 'next/link';
import { ApiError, apiGet } from '@/lib/serverApi';
import { formatCurrencyBRLFromCents, formatDateBR } from '@/lib/format';
import { financeDirectionLabel, financeStatusLabel } from '@/lib/financeLabels';
import { AccessDeniedView } from '@/components/AccessDeniedView';
import { BackButton } from '@/components/BackButton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Card } from '@/components/ui/Card';
import { FinanceEntryCancelButton, FinanceInstallmentActions } from '../FinanceDetailActions';
import { FinanceHistoryPanel } from './FinanceHistoryPanel';
import styles from '../finance.module.css';

type FinanceEntryDetail = {
  id: string;
  code: number;
  direction: 'IN' | 'OUT';
  description: string;
  notes?: string | null;
  issueDate: string;
  competenceDate?: string | null;
  totalAmountCents: number;
  effectiveStatus: string;
  client?: { id: string; name: string } | null;
  matter?: { id: string; title: string } | null;
  category?: { id: string; name: string } | null;
  costCenter?: { id: string; name: string } | null;
  account?: { id: string; name: string } | null;
  installments: Array<{
    id: string;
    number: number;
    description?: string | null;
    dueDate: string;
    amountCents: number;
    paidAmountCents?: number | null;
    paidAt?: string | null;
    paymentMethod?: string | null;
    effectiveStatus: string;
    discountCents?: number;
    interestCents?: number;
    fineCents?: number;
  }>;
};

function pillClass(status: string) {
  const s = String(status || '').toUpperCase();
  if (s === 'SETTLED') return `${styles.pill} ${styles.pillSettled}`;
  if (s === 'OVERDUE') return `${styles.pill} ${styles.pillOverdue}`;
  if (s === 'CANCELED') return `${styles.pill} ${styles.pillCanceled}`;
  return `${styles.pill} ${styles.pillOpen}`;
}

export default async function FinanceEntryPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolved = await Promise.resolve(params);
  try {
    const me = await apiGet<{ tenantTimezone?: string }>('/me').catch(() => ({
      tenantTimezone: 'America/Manaus',
    }));
    const tenantTimeZone = String(me?.tenantTimezone || 'America/Manaus');
    const entry = await apiGet<FinanceEntryDetail>(`/finance/entries/${resolved.id}`);
    return (
      <main className={`${styles.page} appPageShell`}>
        <SectionHeader
          title={`Lançamento #${entry.code}`}
          description={entry.description}
          headingAs="h1"
          className={styles.header}
          actions={
            <div className={styles.headerActions}>
              <BackButton fallbackHref="/finance" className={styles.linkMuted} />
              <Link href={`/finance/${entry.id}/edit`} className={styles.ghostButton}>Editar</Link>
              <FinanceEntryCancelButton entryId={entry.id} />
            </div>
          }
        />

        <section className={styles.kpiGrid}>
          <article className={styles.kpiCard}><div className={styles.kpiLabel}>Tipo</div><div className={styles.kpiValue}>{financeDirectionLabel(entry.direction)}</div></article>
          <article className={styles.kpiCard}><div className={styles.kpiLabel}>Valor total</div><div className={styles.kpiValue}>{formatCurrencyBRLFromCents(entry.totalAmountCents)}</div></article>
          <article className={styles.kpiCard}><div className={styles.kpiLabel}>Status</div><div className={styles.kpiValue}><span className={pillClass(entry.effectiveStatus)}>{financeStatusLabel(entry.effectiveStatus)}</span></div></article>
          <article className={styles.kpiCard}><div className={styles.kpiLabel}>Pessoa</div><div className={styles.metaMuted}>{entry.client?.name || '-'}</div></article>
          <article className={styles.kpiCard}><div className={styles.kpiLabel}>Caso</div><div className={styles.metaMuted}>{entry.matter?.title || '-'}</div></article>
          <article className={styles.kpiCard}><div className={styles.kpiLabel}>Conta</div><div className={styles.metaMuted}>{entry.account?.name || '-'}</div></article>
        </section>

        <Card as="section" className={styles.formCard} padding="md">
          <div className={styles.row3}>
            <div><div className={styles.kpiLabel}>Categoria</div><div>{entry.category?.name || '-'}</div></div>
            <div><div className={styles.kpiLabel}>Centro de custo</div><div>{entry.costCenter?.name || '-'}</div></div>
            <div><div className={styles.kpiLabel}>Emissão / Competência</div><div>{formatDateBR(entry.issueDate, tenantTimeZone)} / {formatDateBR(entry.competenceDate || undefined, tenantTimeZone)}</div></div>
          </div>
          {entry.notes ? <div style={{ marginTop: 12 }} className={styles.metaMuted}>{entry.notes}</div> : null}
        </Card>

        <section className="appDataTableWrap appListTableCard" style={{ marginTop: 14 }}>
          <table className="appDataTable">
            <thead>
              <tr>
                <th>Parcela</th>
                <th>Vencimento</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Baixa</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {entry.installments.map((inst) => (
                <tr key={inst.id}>
                  <td>{inst.number}</td>
                  <td>{formatDateBR(inst.dueDate, tenantTimeZone)}</td>
                  <td>{formatCurrencyBRLFromCents(inst.amountCents)}</td>
                  <td><span className={pillClass(inst.effectiveStatus)}>{financeStatusLabel(inst.effectiveStatus)}</span></td>
                  <td className={styles.metaMuted}>
                    {inst.paidAt ? `${formatCurrencyBRLFromCents(inst.paidAmountCents || inst.amountCents)} em ${formatDateBR(inst.paidAt, tenantTimeZone)}` : '-'}
                  </td>
                  <td><FinanceInstallmentActions installment={inst} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <Card as="section" className={styles.formCard} padding="md">
          <FinanceHistoryPanel entryId={entry.id} tenantTimeZone={tenantTimeZone} />
        </Card>
      </main>
    );
  } catch (e: unknown) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return <AccessDeniedView area="Financeiro" />;
    throw e;
  }
}

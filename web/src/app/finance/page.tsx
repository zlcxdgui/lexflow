import Link from 'next/link';
import { ApiError, apiGet } from '@/lib/serverApi';
import { formatCurrencyBRLFromCents, formatDateBR } from '@/lib/format';
import { financeDirectionLabel, financeStatusLabel } from '@/lib/financeLabels';
import { AccessDeniedView } from '@/components/AccessDeniedView';
import { BackButton } from '@/components/BackButton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Card } from '@/components/ui/Card';
import { FinanceFilters } from './FinanceFilters';
import styles from './finance.module.css';

type SearchParams = {
  status?: string;
  direction?: string;
  q?: string;
  categoryId?: string;
  costCenterId?: string;
  accountId?: string;
  from?: string;
  to?: string;
  page?: string;
};

type EntryItem = {
  id: string;
  code: number;
  direction: 'IN' | 'OUT';
  description: string;
  issueDate: string;
  totalAmountCents: number;
  effectiveStatus: string;
  client?: { id: string; name: string; code?: number | null } | null;
  matter?: { id: string; title: string; code?: number | null } | null;
  category?: { id: string; name: string } | null;
  costCenter?: { id: string; name: string } | null;
  installmentsSummary?: {
    total: number;
    open: number;
    settled: number;
    overdue: number;
    canceled: number;
  };
};

type EntryListResponse = {
  value: EntryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type SummaryResponse = {
  previstoReceber: number;
  previstoPagar: number;
  abertoReceber: number;
  abertoPagar: number;
  realizadoReceber: number;
  realizadoPagar: number;
  saldoPeriodo: number;
  inadimplenciaReceber: number;
  period: { from: string; to: string };
};

type NamedCatalog = { id: string; name: string };

function statusPillClass(status: string) {
  const s = String(status || '').toUpperCase();
  if (s === 'SETTLED') return `${styles.pill} ${styles.pillSettled}`;
  if (s === 'OVERDUE') return `${styles.pill} ${styles.pillOverdue}`;
  if (s === 'CANCELED') return `${styles.pill} ${styles.pillCanceled}`;
  return `${styles.pill} ${styles.pillOpen}`;
}

function installmentsSummaryLabel(summary?: EntryItem['installmentsSummary']) {
  if (!summary) return '-';
  const total = Number(summary.total || 0);
  const settled = Number(summary.settled || 0);
  const open = Number(summary.open || 0);
  const overdue = Number(summary.overdue || 0);
  const canceled = Number(summary.canceled || 0);
  const pendentes = open + overdue;
  const parts: string[] = [];
  if (pendentes > 0) parts.push(`${pendentes} pend.`);
  if (canceled > 0) parts.push(`${canceled} canc.`);
  return `${settled}/${total}${parts.length ? ` · ${parts.join(' · ')}` : ''}`;
}

function buildHref(base: SearchParams, next: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  const merged: Record<string, string | undefined> = {
    status: base.status,
    direction: base.direction,
    q: base.q,
    categoryId: base.categoryId,
    costCenterId: base.costCenterId,
    accountId: base.accountId,
    from: base.from,
    to: base.to,
    ...next,
  };
  Object.entries(merged).forEach(([key, value]) => {
    if (!value || value === 'ALL') return;
    params.set(key, value);
  });
  const qs = params.toString();
  return qs ? `/finance?${qs}` : '/finance';
}

function quickTypeHref(base: SearchParams, tab: 'ALL' | 'IN' | 'OUT') {
  if (tab === 'ALL') {
    return buildHref(base, { direction: undefined, page: undefined });
  }
  return buildHref(base, { direction: tab, page: undefined });
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const resolved = await Promise.resolve(searchParams);
  try {
    const me = await apiGet<{ tenantTimezone?: string }>('/me').catch(() => ({
      tenantTimezone: 'America/Manaus',
    }));
    const tenantTimeZone = String(me?.tenantTimezone || 'America/Manaus');
    const effectiveFrom = resolved?.from;
    const effectiveTo = resolved?.to;

    const entriesQuery = new URLSearchParams();
    const summaryQuery = new URLSearchParams();
    for (const [key, value] of Object.entries(resolved || {})) {
      if (!value) continue;
      if (key === 'from' || key === 'to') {
        continue;
      }
      entriesQuery.set(key, value);
    }
    if (effectiveFrom) {
      summaryQuery.set('from', effectiveFrom);
      entriesQuery.set('dueFrom', effectiveFrom);
    }
    if (effectiveTo) {
      summaryQuery.set('to', effectiveTo);
      entriesQuery.set('dueTo', effectiveTo);
    }

    const [summary, entries, categories, costCenters, accounts] = await Promise.all([
      apiGet<SummaryResponse>(`/finance/summary${summaryQuery.toString() ? `?${summaryQuery.toString()}` : ''}`),
      apiGet<EntryListResponse>(`/finance/entries${entriesQuery.toString() ? `?${entriesQuery.toString()}` : ''}`),
      apiGet<NamedCatalog[]>('/finance/categories'),
      apiGet<NamedCatalog[]>('/finance/cost-centers'),
      apiGet<NamedCatalog[]>('/finance/accounts'),
    ]);

    const direction = String(resolved?.direction || 'ALL').toUpperCase();
    const activeTypeTab: 'ALL' | 'IN' | 'OUT' =
      direction === 'IN' || direction === 'OUT' ? (direction as 'IN' | 'OUT') : 'ALL';

    return (
      <main className={`${styles.page} appPageShell appListPage`}>
        <SectionHeader
          title="Financeiro"
          description="Contas a receber e a pagar, com visão de fluxo e inadimplência."
          headingAs="h1"
          className={`${styles.header} appListHeader`}
          actions={
            <div className={`${styles.headerActions} appListHeaderActions`}>
              <BackButton fallbackHref="/dashboard" className={styles.linkMuted} />
              <Link href="/finance/settings" className={styles.ghostButton}>Cadastros</Link>
              <Link href="/finance/recurrence" className={styles.ghostButton}>Recorrência</Link>
              <Link href="/finance/new" className={styles.primaryButton}>Novo lançamento</Link>
            </div>
          }
        />

        <Card as="section" className={styles.formCard} padding="md">
          <div className={styles.quickFiltersWrap}>
            <div className={styles.quickFilterGroup}>
              <div className={styles.kpiLabel}>Tipo</div>
              <div className={styles.quickFilterTabs}>
                <Link href={quickTypeHref(resolved || {}, 'ALL')} className={`appFilterTab ${activeTypeTab === 'ALL' ? 'appFilterTabActive' : ''}`}>Todos</Link>
                <Link href={quickTypeHref(resolved || {}, 'IN')} className={`appFilterTab ${activeTypeTab === 'IN' ? 'appFilterTabActive' : ''}`}>Receber</Link>
                <Link href={quickTypeHref(resolved || {}, 'OUT')} className={`appFilterTab ${activeTypeTab === 'OUT' ? 'appFilterTabActive' : ''}`}>Pagar</Link>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <FinanceFilters
              categories={categories}
              costCenters={costCenters}
              accounts={accounts}
              initial={{
                q: resolved?.q,
                categoryId: resolved?.categoryId,
                costCenterId: resolved?.costCenterId,
                accountId: resolved?.accountId,
                status: resolved?.status,
                direction: resolved?.direction,
                from: effectiveFrom,
                to: effectiveTo,
              }}
            />
          </div>
        </Card>

        <section className={styles.kpiGrid}>
          <article className={styles.kpiCard}><div className={styles.kpiLabel}>A receber em aberto</div><div className={styles.kpiValue}>{formatCurrencyBRLFromCents(summary.abertoReceber)}</div></article>
          <article className={styles.kpiCard}><div className={styles.kpiLabel}>A pagar em aberto</div><div className={styles.kpiValue}>{formatCurrencyBRLFromCents(summary.abertoPagar)}</div></article>
          <article className={styles.kpiCard}><div className={styles.kpiLabel}>Inadimplência</div><div className={styles.kpiValue}>{formatCurrencyBRLFromCents(summary.inadimplenciaReceber)}</div></article>
          <article className={styles.kpiCard}><div className={styles.kpiLabel}>Recebido</div><div className={styles.kpiValue}>{formatCurrencyBRLFromCents(summary.realizadoReceber)}</div></article>
          <article className={styles.kpiCard}><div className={styles.kpiLabel}>Pago</div><div className={styles.kpiValue}>{formatCurrencyBRLFromCents(summary.realizadoPagar)}</div></article>
          <article className={styles.kpiCard}><div className={styles.kpiLabel}>Saldo</div><div className={styles.kpiValue}>{formatCurrencyBRLFromCents(summary.saldoPeriodo)}</div></article>
          <article className={styles.kpiCard}><div className={styles.kpiLabel}>Previsto receber (período)</div><div className={styles.kpiValue}>{formatCurrencyBRLFromCents(summary.previstoReceber)}</div></article>
          <article className={styles.kpiCard}><div className={styles.kpiLabel}>Previsto pagar (período)</div><div className={styles.kpiValue}>{formatCurrencyBRLFromCents(summary.previstoPagar)}</div></article>
        </section>

        <section className="appDataTableWrap appListTableCard" style={{ marginTop: 14 }}>
          <table className="appDataTable">
            <thead>
              <tr>
                <th>Lançamento</th>
                <th>Tipo</th>
                <th>Pessoa</th>
                <th>Caso</th>
                <th>Categoria</th>
                <th>Emissão</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Parcelas</th>
              </tr>
            </thead>
            <tbody>
              {entries.value.length === 0 ? (
                <tr><td colSpan={9} className="appDataTableEmpty">Nenhum lançamento encontrado.</td></tr>
              ) : (
                entries.value.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/finance/${row.id}`} className={styles.linkMuted}>
                        #{row.code} · {row.description}
                      </Link>
                    </td>
                    <td>{financeDirectionLabel(row.direction)}</td>
                    <td>{row.client?.name || '-'}</td>
                    <td>{row.matter?.title || '-'}</td>
                    <td>{row.category?.name || '-'}</td>
                    <td>{formatDateBR(row.issueDate, tenantTimeZone)}</td>
                    <td>{formatCurrencyBRLFromCents(row.totalAmountCents)}</td>
                    <td><span className={statusPillClass(row.effectiveStatus)}>{financeStatusLabel(row.effectiveStatus)}</span></td>
                    <td className={styles.metaMuted}>
                      {installmentsSummaryLabel(row.installmentsSummary)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <Card className="appListPaginationCard" padding="sm" as="section">
          <div className="appListPaginationControls">
            <span className="appListPaginationInfo">Página {entries.page} de {entries.totalPages} · {entries.total} item(ns)</span>
            <div className={styles.headerActions}>
              <Link href={buildHref(resolved || {}, { page: String(Math.max(1, entries.page - 1)) })} className={styles.ghostButton}>Anterior</Link>
              <Link href={buildHref(resolved || {}, { page: String(Math.min(entries.totalPages, entries.page + 1)) })} className={styles.ghostButton}>Próxima</Link>
            </div>
          </div>
        </Card>
      </main>
    );
  } catch (e: unknown) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      return <AccessDeniedView area="Financeiro" />;
    }
    throw e;
  }
}

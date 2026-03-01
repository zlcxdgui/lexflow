import Link from 'next/link';
import { ApiError, apiGet } from '@/lib/serverApi';
import { formatDateBR, formatStatus } from '@/lib/format';
import { MattersSearch } from '@/components/MattersSearch';
import { MattersPageSizeSelect } from '@/components/MattersPageSizeSelect';
import { can } from '@/lib/permissions';
import { AccessDeniedView } from '@/components/AccessDeniedView';
import { BackButton } from '@/components/BackButton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import styles from './matters.module.css';

type Matter = {
  id: string;
  title: string;
  area: string | null;
  subject: string | null;
  court: string | null;
  caseNumber: string | null;
  status: string;
  createdAt: string;
  client?: { id: string; name: string; code?: number | null } | null;
};

type SearchParams = {
  status?: string;
  q?: string;
  page?: string;
  pageSize?: string;
};

export default async function MattersPage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const resolvedSearch = await Promise.resolve(searchParams);
  const me = await apiGet<{ role?: string; tenantTimezone?: string }>('/me').catch(() => ({
    role: '',
    tenantTimezone: 'America/Manaus',
  }));
  const tenantTimeZone = String(me?.tenantTimezone || 'America/Manaus');
  let matters: Matter[] = [];
  try {
    matters = await apiGet<Matter[]>('/matters');
  } catch (e: unknown) {
    if (e instanceof ApiError && e.status === 403) {
      return <AccessDeniedView area="Casos" />;
    }
    throw e;
  }
  const status = (resolvedSearch?.status || 'ALL').toUpperCase();
  const q = (resolvedSearch?.q || '').trim().toLowerCase();
  const pageRaw = Number(resolvedSearch?.page || '1');
  const pageSizeRaw = Number(resolvedSearch?.pageSize || '10');
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const pageSize = [10, 20, 50].includes(pageSizeRaw) ? pageSizeRaw : 10;

  const filtered = matters.filter((m) => {
    if (status !== 'ALL' && m.status !== status) return false;
    if (q) {
      const hay = `${m.title} ${m.client?.name || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const counts = {
    ALL: matters.length,
    OPEN: matters.filter((m) => m.status === 'OPEN').length,
    CLOSED: matters.filter((m) => m.status === 'CLOSED').length,
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);
  const startItem = filtered.length === 0 ? 0 : start + 1;
  const endItem = Math.min(start + pageSize, filtered.length);

  const buildHref = (next: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    if (status !== 'ALL') params.set('status', status);
    if (q) params.set('q', q);
    if (pageSize !== 10) params.set('pageSize', String(pageSize));
    Object.entries(next).forEach(([key, value]) => {
      if (value === undefined || value === '' || value === 'ALL') params.delete(key);
      else params.set(key, String(value));
    });
    const qs = params.toString();
    return qs ? `/matters?${qs}` : '/matters';
  };

  return (
    <main className={`${styles.page} appPageShell appListPage`}>
      <SectionHeader
        title="Casos"
        description="Visão geral dos processos ativos e encerrados."
        headingAs="h1"
        className={`${styles.header} appListHeader`}
        actions={<div className={`${styles.headerActions} appListHeaderActions`}>
            <BackButton fallbackHref="/dashboard" className={styles.linkMuted} />
            {can(me.role, 'matter.create') ? (
              <Link href="/matters/new" className={styles.primaryButton}>
                Novo caso
              </Link>
            ) : null}
          </div>}
      />

      <section className={`${styles.controls} appListControlsCard`}>
        <div className="appFilterTabs">
          <Link href={buildHref({ status: 'ALL', page: undefined })} className={`appFilterTab ${status === 'ALL' ? 'appFilterTabActive' : ''}`}>
            <span>Todos</span>
            <span className="appFilterTabCount">{counts.ALL}</span>
          </Link>
          <Link href={buildHref({ status: 'OPEN', page: undefined })} className={`appFilterTab ${status === 'OPEN' ? 'appFilterTabActive' : ''}`}>
            <span>Abertos</span>
            <span className="appFilterTabCount">{counts.OPEN}</span>
          </Link>
          <Link href={buildHref({ status: 'CLOSED', page: undefined })} className={`appFilterTab ${status === 'CLOSED' ? 'appFilterTabActive' : ''}`}>
            <span>Encerrados</span>
            <span className="appFilterTabCount">{counts.CLOSED}</span>
          </Link>
        </div>

        <MattersSearch
          className={`${styles.search} appListSearchWrap`}
          inputClassName={`${styles.searchInput} appListSearchInput`}
          buttonClassName={styles.searchButton}
          showButton={false}
        />
      </section>

      <section className={`${styles.tableWrap} appDataTableWrap appListTableCard`}>
        <table className={`${styles.table} appDataTable`}>
          <thead>
            <tr>
              <th>Título</th>
              <th>Pessoa</th>
              <th>Nº Processo</th>
              <th>Área</th>
              <th>Assunto</th>
              <th>Status</th>
              <th>Criado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className={`${styles.empty} appDataTableEmpty`}>
                  Nenhum caso encontrado.
                </td>
              </tr>
            ) : (
              pageItems.map((m) => (
                <tr key={m.id}>
                  <td className={styles.cellTitle}>
                    <Link href={`/matters/${m.id}`} className={styles.link}>
                      {m.title}
                    </Link>
                  </td>
                  <td>{m.client?.name || '-'}</td>
                  <td>{m.caseNumber || '-'}</td>
                  <td>{m.area || '-'}</td>
                  <td>{m.subject || '-'}</td>
                  <td>
                    <span
                      className={`${styles.status} ${
                        m.status === 'CLOSED' ? styles.statusClosed : styles.statusOpen
                      }`}
                    >
                      {formatStatus(m.status)}
                    </span>
                  </td>
                  <td>{formatDateBR(m.createdAt, tenantTimeZone)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
      <div className={`${styles.paginationRow} appListPaginationCard`}>
        <div className={`${styles.paginationInfo} appListPaginationInfo`}>
          Exibindo {startItem}-{endItem} de {filtered.length}
        </div>
        <div className={`${styles.paginationControls} appListPaginationControls`}>
          <MattersPageSizeSelect currentPageSize={pageSize} />
          <Link href={buildHref({ page: Math.max(1, currentPage - 1) })} className={`${styles.paginationButton} appListPaginationButton`}>
            Anterior
          </Link>
          <span className={`${styles.pageNumber} appListPageNumber`}>
            Página {currentPage} de {totalPages}
          </span>
          <Link href={buildHref({ page: Math.min(totalPages, currentPage + 1) })} className={`${styles.paginationButton} appListPaginationButton`}>
            Próxima
          </Link>
        </div>
      </div>
    </main>
  );
}

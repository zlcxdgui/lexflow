import Link from 'next/link';
import { ApiError, apiGet } from '@/lib/serverApi';
import { formatDateBR } from '@/lib/format';
import {
  labelGroupPermission,
  labelPermission,
  summarizeSettingsForAudit,
} from '@/lib/permissionLabels';
import { AuditPageSizeSelect } from '@/components/AuditPageSizeSelect';
import { AuditFilters } from '@/components/AuditFilters';
import { AccessDeniedView } from '@/components/AccessDeniedView';
import { BackButton } from '@/components/BackButton';
import { Card } from '@/components/ui/Card';
import {
  UIListEmpty,
  UIListPager,
  UIListRow,
  UIListRowMain,
  UIListStack,
} from '@/components/ui/ListRow';
import { SectionHeader } from '@/components/ui/SectionHeader';
import {
  formatAuditActionLabel,
  formatAuditMetaEntries,
  formatAuditMetaKeyLabel,
  formatAuditMetaValueText,
} from '../../../../shared/auditI18n';
import styles from './audit.module.css';

type Me = {
  role?: string;
  tenantTimezone?: string;
};

type AuditItem = {
  id: string;
  action: string;
  metaJson?: string | null;
  createdAt: string;
  user?: { id: string; name: string; email: string } | null;
  matter?: { id: string; title: string } | null;
};

type AuditResponse = {
  value: AuditItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type SearchParams = {
  q?: string;
  action?: string;
  routine?: string;
  user?: string;
  from?: string;
  to?: string;
  run?: string;
  page?: string;
  pageSize?: string;
};

function actionLabel(action: string) {
  return formatAuditActionLabel(action);
}

function metaText(item: AuditItem) {
  if (!item.metaJson) return '';
  try {
    const meta = JSON.parse(item.metaJson) as Record<string, unknown>;
    if (item.action === 'DOCUMENT_RENAMED') {
      const prev = meta?.previousOriginalName || meta?.oldName || '';
      const next = meta?.nextOriginalName || meta?.newName || '';
      if (prev && next) return `De "${prev}" para "${next}"`;
    }
    if (item.action === 'DOCUMENT_DELETED' && meta?.originalName) {
      return `Arquivo removido: ${String(meta.originalName)}`;
    }
    if (item.action === 'DOCUMENT_DOWNLOADED' && meta?.originalName) {
      return `Arquivo baixado: ${String(meta.originalName)}`;
    }
    if (item.action === 'DOCUMENT_VIEWED' && meta?.originalName) {
      return `Arquivo visualizado: ${String(meta.originalName)}`;
    }
    if (item.action === 'DOCUMENT_UPLOADED' && meta?.originalName) {
      return `Arquivo enviado: ${String(meta.originalName)}`;
    }
    if (item.action.startsWith('AGENDA_VIEW_') && meta?.name) {
      return `Visão: ${String(meta.name)}`;
    }
    if (item.action === 'TENANT_MEMBER_SETTINGS_UPDATED' && meta?.settings) {
      const summary = summarizeSettingsForAudit(meta.settings);
      const targetEmail = meta?.targetEmail ? String(meta.targetEmail) : '';
      return [targetEmail ? `Usuário: ${targetEmail}` : null, summary]
        .filter(Boolean)
        .join(' · ');
    }
    if (item.action === 'TENANT_MEMBER_PROFILE_UPDATED') {
      const parts: string[] = [];
      if (
        meta?.previousName !== undefined &&
        meta?.nextName !== undefined &&
        String(meta.previousName ?? '') !== String(meta.nextName ?? '')
      ) {
        parts.push(`Nome: ${String(meta.previousName || '-')} → ${String(meta.nextName || '-')}`);
      }
      if (
        meta?.previousEmail !== undefined &&
        meta?.nextEmail !== undefined &&
        String(meta.previousEmail ?? '') !== String(meta.nextEmail ?? '')
      ) {
        parts.push(
          `E-mail: ${String(meta.previousEmail || '-')} → ${String(meta.nextEmail || '-')}`,
        );
      }
      if (meta?.employeeClientId !== undefined) {
        parts.push(
          `Funcionário vinculado: ${
            meta.employeeClientId ? 'atualizado' : 'sem vínculo'
          }`,
        );
      }
      return parts.join(' · ');
    }
    if (item.action === 'MATTER_STATUS_CHANGED') {
      const parts: string[] = [];
      if (meta?.previousStatus !== undefined || meta?.nextStatus !== undefined) {
        parts.push(
          `Status: ${formatAuditMetaValueText('status', meta.previousStatus)} → ${formatAuditMetaValueText('status', meta.nextStatus)}`,
        );
      }
      if (meta?.reason) {
        parts.push(`${formatAuditMetaKeyLabel('reason')}: ${String(meta.reason)}`);
      }
      return parts.join(' · ');
    }
    if (item.action === 'AUDIT_FILTER_PROCESSED') {
      const parts: string[] = [];
      if (meta?.routine) {
        parts.push(`Rotina: ${formatAuditMetaValueText('routine', meta.routine)}`);
      }
      if (meta?.userId) parts.push('Filtro por usuário');
      if (meta?.from) parts.push(`Início: ${String(meta.from)}`);
      if (meta?.to) parts.push(`Fim: ${String(meta.to)}`);
      if (meta?.q) parts.push(`Busca: ${String(meta.q)}`);
      return parts.length ? parts.join(' · ') : 'Processamento manual da auditoria';
    }
    if (item.action === 'TENANT_MEMBER_UPDATED') {
      const parts: string[] = [];
      if (meta?.prevRole || meta?.nextRole) {
        const prevRole = labelGroupPermission(String(meta.prevRole || '-'));
        const nextRole = labelGroupPermission(String(meta.nextRole || '-'));
        parts.push(`Cargo: ${prevRole} → ${nextRole}`);
      }
      if (meta?.prevIsActive !== undefined || meta?.nextIsActive !== undefined) {
        const prev = meta?.prevIsActive ? 'Ativo' : 'Inativo';
        const next = meta?.nextIsActive ? 'Ativo' : 'Inativo';
        parts.push(`Status: ${prev} → ${next}`);
      }
      if (parts.length > 0) return parts.join(' · ');
    }
    if (item.action === 'TENANT_MEMBER_INVITED') {
      const role = meta?.role ? labelGroupPermission(String(meta.role)) : '';
      const email = meta?.invitedEmail ? String(meta.invitedEmail) : '';
      const fullName = meta?.fullName ? String(meta.fullName) : '';
      return [fullName || null, email || null, role ? `Cargo: ${role}` : null]
        .filter(Boolean)
        .join(' · ');
    }
    if (Array.isArray(meta?.modulePermissions)) {
      const labels = (meta.modulePermissions as unknown[])
        .map((value) => labelPermission(String(value)));
      return `Permissões: ${labels.join(', ')}`;
    }
    return formatAuditMetaEntries(meta || {}, 3);
  } catch {
    return '';
  }
}

function buildHref(
  current: SearchParams,
  patch: Partial<SearchParams>,
) {
  const next: SearchParams = { ...current, ...patch };
  const qs = new URLSearchParams();
  Object.entries(next).forEach(([k, v]) => {
    if (v && String(v).trim()) qs.set(k, String(v));
  });
  const s = qs.toString();
  return s ? `/audit?${s}` : '/audit';
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const q = (resolved?.q || '').trim().toLowerCase();
  const action = (resolved?.action || '').trim();
  const routine = (resolved?.routine || '').trim();
  const user = (resolved?.user || '').trim();
  const from = (resolved?.from || '').trim();
  const to = (resolved?.to || '').trim();
  const run = (resolved?.run || '').trim();
  const pageRaw = Number(resolved?.page || '1');
  const pageSizeRaw = Number(resolved?.pageSize || '10');
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const pageSize = [10, 20, 50].includes(pageSizeRaw) ? pageSizeRaw : 10;

  let rows: AuditItem[] = [];
  let total = 0;
  let totalPages = 1;
  let currentPage = page;
  let loadError = '';
  let meRole = '';
  let tenantTimeZone = 'America/Manaus';
  const shouldRun = run === '1';

  try {
    if (!shouldRun) {
      const me = await apiGet<Me>('/me');
      meRole = String(me?.role || '').toUpperCase();
      tenantTimeZone = String(me?.tenantTimezone || 'America/Manaus');
    } else {
    const qs = new URLSearchParams();
    qs.set('limit', String(pageSize));
    qs.set('page', String(page));
    if (q) qs.set('q', q);
    if (action) qs.set('action', action);
    if (routine) qs.set('routine', routine);
    if (user) qs.set('user', user);
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);

    const [resp, me] = await Promise.all([
      apiGet<AuditResponse>(`/audit?${qs.toString()}`),
      apiGet<Me>('/me'),
    ]);
    rows = Array.isArray(resp?.value) ? resp.value : [];
    total = Number(resp?.total || 0);
    totalPages = Math.max(1, Number(resp?.totalPages || 1));
    currentPage = Math.max(1, Math.min(page, totalPages));
    meRole = String(me?.role || '').toUpperCase();
    tenantTimeZone = String(me?.tenantTimezone || 'America/Manaus');
    }
  } catch (err: unknown) {
    if (err instanceof ApiError && err.status === 403) {
      return <AccessDeniedView area="Auditoria" />;
    }
    loadError = err instanceof Error ? err.message : 'Erro ao carregar auditoria';
  }

  const isPlatformAdmin = meRole === 'ADMIN';
  const pageTitle = isPlatformAdmin ? 'Auditoria do sistema' : 'Auditoria do escritório';
  const pageSubtitle = isPlatformAdmin
    ? 'Rastreamento de ações por usuário, caso e documentos.'
    : 'Rastreamento operacional do escritório (ações de governança ocultas).';

  const users = Array.from(
    new Map(
      rows
        .filter((r) => r.user?.id)
        .map((r) => [r.user!.id, r.user!]),
    ).values(),
  );
  const routineOptions = [
    { value: '', label: 'Todas' },
    { value: 'casos', label: 'Casos' },
    { value: 'pessoas', label: 'Pessoas' },
    { value: 'atendimento', label: 'Atendimento' },
    { value: 'agenda', label: 'Agenda' },
    { value: 'financeiro', label: 'Financeiro' },
    { value: 'relatorios', label: 'Relatórios' },
    { value: 'equipe', label: 'Equipe' },
    { value: 'auditoria', label: 'Auditoria' },
    { value: 'notificacoes', label: 'Notificações' },
    ...(isPlatformAdmin ? [{ value: 'escritorios', label: 'Escritórios' }] : []),
  ];

  const pageRows = rows;
  const startItem = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, total);

  return (
    <main className={`${styles.page} appPageShell`}>
      <header className={styles.header}>
        <SectionHeader
          title={pageTitle}
          description={pageSubtitle}
          headingAs="h1"
          className={styles.headerTitleBlock}
        />
        <BackButton fallbackHref="/dashboard" className={styles.backLink} />
      </header>

      <Card as="section" className={styles.filtersCard} padding="none">
        <AuditFilters
          key={`${q}|${action}|${routine}|${user}|${from}|${to}|${run}`}
          q={q}
          action={action}
          routine={routine}
          user={user}
          from={from}
          to={to}
          run={shouldRun}
          routineOptions={routineOptions}
          userOptions={users.map((value) => ({
            value: value.id,
            label: `${value.name} (${value.email})`,
          }))}
        />
        <div className={styles.filtersFooter}>
          <span className={styles.counter}>
            {shouldRun ? `${total} evento(s)` : 'Aguardando processamento'}
          </span>
        </div>
      </Card>

      {loadError ? (
        <Card as="section" className={styles.errorBox} padding="sm">{loadError}</Card>
      ) : (
        <Card as="section" className={styles.listCard} padding="sm">
          {!shouldRun ? (
            <UIListEmpty className={styles.empty}>Defina os filtros e clique em Processar.</UIListEmpty>
          ) : pageRows.length === 0 ? (
            <UIListEmpty className={styles.empty}>Nenhum evento encontrado.</UIListEmpty>
          ) : (
            <UIListStack className={styles.list}>
            {pageRows.map((r) => (
              <UIListRow key={r.id} className={styles.item}>
                <UIListRowMain>
                <div className={styles.row}>
                  <strong>{actionLabel(r.action)}</strong>
                  <span>{formatDateBR(r.createdAt, tenantTimeZone)}</span>
                </div>
                <div className={styles.meta}>
                  {r.user?.name || 'Sistema'}
                  {r.user?.email ? ` (${r.user.email})` : ''}
                  {r.matter?.id ? (
                    <>
                      {' · Caso: '}
                      <Link href={`/matters/${r.matter.id}`} className={styles.link}>
                        {r.matter.title}
                      </Link>
                    </>
                  ) : null}
                </div>
                {metaText(r) ? <div className={styles.detail}>{metaText(r)}</div> : null}
                </UIListRowMain>
              </UIListRow>
            ))}
            </UIListStack>
          )}
        </Card>
      )}

      {shouldRun ? (
        <UIListPager
          className={styles.paginationRow}
          meta={<>Exibindo {startItem}-{endItem} de {total}</>}
          actions={
            <div className={styles.paginationControls}>
            <AuditPageSizeSelect currentPageSize={pageSize} />
            {currentPage > 1 ? (
              <Link
                href={buildHref(resolved || {}, { page: String(Math.max(1, currentPage - 1)) })}
                className={styles.pageBtn}
              >
                Anterior
              </Link>
            ) : (
              <span className={`${styles.pageBtn} ${styles.pageBtnDisabled}`}>Anterior</span>
            )}
            <span className={styles.pageNumber}>Página {currentPage} de {totalPages}</span>
            {currentPage < totalPages ? (
              <Link
                href={buildHref(resolved || {}, { page: String(Math.min(totalPages, currentPage + 1)) })}
                className={styles.pageBtn}
              >
                Próxima
              </Link>
            ) : (
              <span className={`${styles.pageBtn} ${styles.pageBtnDisabled}`}>Próxima</span>
            )}
            </div>
          }
        />
      ) : null}
    </main>
  );
}

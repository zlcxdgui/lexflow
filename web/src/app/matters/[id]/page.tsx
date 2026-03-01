import Link from "next/link";
import { apiGet } from "@/lib/serverApi";
import { formatDeadlineType, formatPriority, formatStatus, formatDateBR } from "@/lib/format";
import { CreateTaskForm } from "@/components/CreateTaskForm";
import { CreateDeadlineForm } from "@/components/CreateDeadlineForm";
import { DeadlineDoneAction, TaskStatusAction } from "@/components/MatterWorkflowActions";
import { TaskCrudActions } from "@/components/TaskCrudActions";
import { DeadlineCrudActions } from "@/components/DeadlineCrudActions";
import { TaskAssigneeFilter } from "@/components/TaskAssigneeFilter";
import DocumentsPanel from "@/components/DocumentsPanel";
import { MatterStatusAction } from "@/components/MatterStatusAction";
import { CreateMatterUpdateForm } from "@/components/CreateMatterUpdateForm";
import { MatterUpdatesFilters } from "@/components/MatterUpdatesFilters";
import { MatterHistoryFilters } from "@/components/MatterHistoryFilters";
import { MatterHistoryPageSizeSelect } from "@/components/MatterHistoryPageSizeSelect";
import { MatterUpdateActions } from "@/components/MatterUpdateActions";
import {
  UIListEmpty,
  UIListPager,
  UIListPagerPage,
  UIListRow,
  UIListRowMain,
  UIListStack,
} from "@/components/ui/ListRow";
import { UISelect } from "@/components/ui/Select";
import { can } from "@/lib/permissions";
import { financeDirectionLabel, financeStatusLabel } from "@/lib/financeLabels";
import styles from "./matter.module.css";

type Matter = {
  id: string;
  tenantId: string;
  clientId: string | null;
  client?: { id: string; name: string; code?: number | null } | null;
  title: string;
  area: string | null;
  subject: string | null;
  court: string | null;
  caseNumber: string | null;
  status: "OPEN" | "CLOSED";
  createdAt: string;
};

type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: "OPEN" | "DOING" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueDate?: string | null;
  assignedTo?: { id: string; name: string; email: string } | null;
  createdBy?: { id: string; name: string; email: string } | null;
};

type Deadline = {
  id: string;
  title: string;
  type: string;
  dueDate: string;
  isDone: boolean;
  notes: string | null;
};

type DocumentItem = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256?: string | null;
  createdAt: string;
  uploadedBy?: { id: string; name: string; email: string } | null;
};

type AuditItem = {
  id: string;
  action: string;
  metaJson?: string | null;
  createdAt: string;
  user?: { id: string; name: string; email: string } | null;
};
type AuditResponse = {
  value: AuditItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type MatterUpdate = {
  id: string;
  title: string;
  description: string;
  type: string;
  eventDate?: string | null;
  createdAt: string;
  user?: { id: string; name: string; email: string } | null;
};
type Me = { role: string; tenantTimezone?: string };
type MatterFinanceInstallment = {
  id: string;
  number: number;
  dueDate: string;
  amountCents: number;
  paidAmountCents?: number | null;
  paidAt?: string | null;
  effectiveStatus: string;
  entry?: {
    id: string;
    code?: number | null;
    description?: string;
    direction?: 'IN' | 'OUT';
    client?: { id: string; name: string } | null;
    category?: { id: string; name: string } | null;
  } | null;
};

type MatterFinanceInstallmentsResp = {
  value: MatterFinanceInstallment[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function timelineActionLabel(action: string) {
  if (action === 'MATTER_CREATED') return 'Caso criado';
  if (action === 'MATTER_UPDATED') return 'Caso atualizado';
  if (action === 'MATTER_STATUS_CHANGED') return 'Status alterado';
  if (action === 'DOCUMENT_UPLOADED') return 'Documento enviado';
  if (action === 'DOCUMENT_RENAMED') return 'Documento renomeado';
  if (action === 'DOCUMENT_DELETED') return 'Documento excluído';
  if (action === 'DOCUMENT_DOWNLOADED') return 'Documento baixado';
  if (action === 'MATTER_UPDATE_ADDED') return 'Andamento registrado';
  if (action === 'MATTER_UPDATE_UPDATED') return 'Andamento alterado';
  if (action === 'MATTER_UPDATE_DELETED') return 'Andamento excluído';
  return action;
}

function timelineDetail(item: AuditItem) {
  if (!item.metaJson) return null;
  try {
    const meta = JSON.parse(item.metaJson);
    if (item.action === 'MATTER_STATUS_CHANGED') {
      const from = meta?.previousStatus ? formatStatus(meta.previousStatus) : null;
      const to = meta?.nextStatus ? formatStatus(meta.nextStatus) : null;
      const reason = meta?.reason ? String(meta.reason) : '';
      return [from && to ? `${from} → ${to}` : null, reason || null].filter(Boolean).join(' · ');
    }
    if (item.action === 'MATTER_CREATED' && meta?.title) return String(meta.title);
    if (item.action === 'DOCUMENT_UPLOADED' && meta?.originalName) {
      return `Arquivo: ${String(meta.originalName)}`;
    }
    if (item.action === 'DOCUMENT_DELETED') {
      if (typeof meta?.originalName === 'string') {
        return `Arquivo removido: ${meta.originalName}`;
      }
      if (typeof meta?.fileName === 'string') return `Arquivo removido: ${meta.fileName}`;
      return null;
    }
    if (item.action === 'DOCUMENT_DOWNLOADED') {
      if (typeof meta?.originalName === 'string') {
        return `Arquivo baixado: ${meta.originalName}`;
      }
      if (typeof meta?.fileName === 'string') return `Arquivo baixado: ${meta.fileName}`;
      return null;
    }
    if (item.action === 'DOCUMENT_RENAMED') {
      const previousName =
        typeof meta?.previousOriginalName === 'string'
          ? meta.previousOriginalName
          : typeof meta?.oldName === 'string'
          ? meta.oldName
          : '';
      const nextName =
        typeof meta?.nextOriginalName === 'string'
          ? meta.nextOriginalName
          : typeof meta?.newName === 'string'
          ? meta.newName
          : '';
      if (previousName && nextName) return `De "${previousName}" para "${nextName}"`;
      if (nextName) return `Novo nome: "${nextName}"`;
      if (previousName) return `Nome anterior: "${previousName}"`;
      return null;
    }
    if (item.action === 'MATTER_UPDATE_ADDED' || item.action === 'MATTER_UPDATE_UPDATED') {
      const title = meta?.title ? String(meta.title) : '';
      const description = meta?.description ? String(meta.description) : '';
      return [title, description].filter(Boolean).join(' · ');
    }
    if (item.action === 'MATTER_UPDATE_DELETED') {
      return 'Andamento removido manualmente';
    }
  } catch {}
  return null;
}

function dateKeyInTimeZone(
  value?: string | Date | null,
  timeZone?: string,
) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const byType = parts.reduce<Record<string, string>>((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  if (!byType.year || !byType.month || !byType.day) return '';
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function addDaysToDateKey(key: string, days: number) {
  const [year, month, day] = key.split('-').map(Number);
  if (!year || !month || !day) return key;
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + days);
  const y = base.getUTCFullYear();
  const m = String(base.getUTCMonth() + 1).padStart(2, '0');
  const d = String(base.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

type PillTone = 'default' | 'info' | 'success' | 'warning' | 'danger' | 'muted';

function Pill({
  children,
  tone = 'default',
}: {
  children: React.ReactNode;
  tone?: PillTone;
}) {
  const toneClass =
    tone === 'info'
      ? styles.pillInfo
      : tone === 'success'
      ? styles.pillSuccess
      : tone === 'warning'
      ? styles.pillWarning
      : tone === 'danger'
      ? styles.pillDanger
      : tone === 'muted'
      ? styles.pillMuted
      : styles.pillDefault;
  return <span className={`${styles.pill} ${toneClass}`}>{children}</span>;
}

function Card({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>{title}</h2>
        {right}
      </div>
      <div className={styles.cardBody}>{children}</div>
    </section>
  );
}

function taskStatusTone(status: Task['status']): PillTone {
  if (status === 'DONE') return 'success';
  if (status === 'DOING') return 'info';
  return 'default';
}

function priorityTone(priority: Task['priority']): PillTone {
  if (priority === 'HIGH') return 'danger';
  if (priority === 'MEDIUM') return 'warning';
  return 'muted';
}

export default async function MatterPage({
  params,
  searchParams,
}: {
  params: { id: string } | Promise<{ id: string }>;
  searchParams?:
    | {
      tab?: string;
      taskFilter?: string;
      deadlineFilter?: string;
      assignee?: string;
      updateType?: string;
      updateFrom?: string;
      updateTo?: string;
      updateQ?: string;
      updateOrder?: string;
      updatePage?: string;
      updatePageSize?: string;
      historyQ?: string;
      historyPage?: string;
      historyPageSize?: string;
      financeDirection?: string;
      financeStatus?: string;
      financeDueFrom?: string;
      financeDueTo?: string;
      financeDateBasis?: string;
      financePage?: string;
    }
    | Promise<{
        tab?: string;
        taskFilter?: string;
        deadlineFilter?: string;
        assignee?: string;
        updateType?: string;
        updateFrom?: string;
        updateTo?: string;
        updateQ?: string;
        updateOrder?: string;
        updatePage?: string;
        updatePageSize?: string;
        historyQ?: string;
        historyPage?: string;
        historyPageSize?: string;
        financeDirection?: string;
        financeStatus?: string;
        financeDueFrom?: string;
        financeDueTo?: string;
        financeDateBasis?: string;
        financePage?: string;
      }>;
}) {
  const resolved = await Promise.resolve(params);
  const resolvedSearch = await Promise.resolve(searchParams);
  const id = resolved.id;
  const tab = (resolvedSearch?.tab || "overview").toLowerCase();
  const taskFilter = (resolvedSearch?.taskFilter || "open").toLowerCase();
  const deadlineFilter = (resolvedSearch?.deadlineFilter || "pending").toLowerCase();
  const assignee = resolvedSearch?.assignee || '';
  const updateType = (resolvedSearch?.updateType || 'ALL').toUpperCase();
  const updateFrom = resolvedSearch?.updateFrom || '';
  const updateTo = resolvedSearch?.updateTo || '';
  const updateQRaw = resolvedSearch?.updateQ || '';
  const updateOrder = (resolvedSearch?.updateOrder || 'recent').toLowerCase();
  const updatePageRaw = Number(resolvedSearch?.updatePage || '1');
  const updatePageSizeRaw = Number(resolvedSearch?.updatePageSize || '10');
  const updatePageSize = [10, 20, 50].includes(updatePageSizeRaw)
    ? updatePageSizeRaw
    : 10;
  const updatePage = Number.isFinite(updatePageRaw) && updatePageRaw > 0 ? updatePageRaw : 1;
  const historyQRaw = resolvedSearch?.historyQ || '';
  const historyPageRaw = Number(resolvedSearch?.historyPage || '1');
  const historyPageSizeRaw = Number(resolvedSearch?.historyPageSize || '10');
  const historyPageSize = [10, 20, 50].includes(historyPageSizeRaw)
    ? historyPageSizeRaw
    : 10;
  const historyPage =
    Number.isFinite(historyPageRaw) && historyPageRaw > 0 ? historyPageRaw : 1;
  const updateQ = updateQRaw.trim().toLowerCase();
  const financeDirectionRaw = String(resolvedSearch?.financeDirection || '').toUpperCase();
  const financeDirection =
    financeDirectionRaw === 'IN' || financeDirectionRaw === 'OUT'
      ? financeDirectionRaw
      : 'ALL';
  const financeStatusRaw = String(resolvedSearch?.financeStatus || '').toUpperCase();
  const financeStatus = ['OPEN', 'SETTLED', 'OVERDUE', 'CANCELED'].includes(financeStatusRaw)
    ? financeStatusRaw
    : 'ALL';
  const financeDateBasisRaw = String(resolvedSearch?.financeDateBasis || '').toUpperCase();
  const financeDateBasis = financeDateBasisRaw === 'PAID' ? 'PAID' : 'DUE';
  const financeDueFrom = String(resolvedSearch?.financeDueFrom || '').trim();
  const financeDueTo = String(resolvedSearch?.financeDueTo || '').trim();
  const financePageRaw = Number(resolvedSearch?.financePage || '1');
  const financePage = Number.isFinite(financePageRaw) && financePageRaw > 0 ? financePageRaw : 1;

  // carrega tudo no server (sem travar, sem useEffect)
  const matter = await apiGet<Matter>(`/matters/${id}`);
  const me = await apiGet<Me>('/me').catch(() => ({ role: '', tenantTimezone: 'America/Manaus' }));
  const tenantTimeZone = String(me?.tenantTimezone || 'America/Manaus');
  const canDelete = can(me.role, 'task.delete');
  const canTaskCreate = can(me.role, 'task.create');
  const canTaskEdit = can(me.role, 'task.edit');
  const canDeadlineCreate = can(me.role, 'deadline.create');
  const canDeadlineEdit = can(me.role, 'deadline.edit');
  const canUpdateCreate = can(me.role, 'update.create');
  const canUpdateEdit = can(me.role, 'update.edit');
  const canUpdateDelete = can(me.role, 'update.delete');
  const canDocumentUpload = can(me.role, 'document.upload');
  const canDocumentEdit = can(me.role, 'document.edit');
  const canMatterEdit = can(me.role, 'matter.edit');
  const canAuditRead = can(me.role, 'audit.read');
  const canFinanceRead = can(me.role, 'finance.read');

  const tasksResp = await apiGet<{ value: Task[] } | Task[]>(
    `/matters/${id}/tasks`
  );
  const tasks = Array.isArray(tasksResp) ? tasksResp : tasksResp.value ?? [];

  const deadlinesResp = await apiGet<{ value: Deadline[] } | Deadline[]>(
    `/matters/${id}/deadlines`
  );
  const deadlines = Array.isArray(deadlinesResp)
    ? deadlinesResp
    : deadlinesResp.value ?? [];

  const docsResp = await apiGet<{ value: DocumentItem[] } | DocumentItem[]>(
    `/matters/${id}/documents`
  );
  const documents = Array.isArray(docsResp) ? docsResp : docsResp.value ?? [];
  const financeListQuery = new URLSearchParams();
  financeListQuery.set('matterId', id);
  financeListQuery.set('pageSize', '10');
  financeListQuery.set('page', String(financePage));
  if (financeDirection !== 'ALL') financeListQuery.set('direction', financeDirection);
  if (financeStatus !== 'ALL') financeListQuery.set('status', financeStatus);
  if (financeDateBasis !== 'DUE') financeListQuery.set('dateBasis', financeDateBasis);
  if (financeDueFrom) financeListQuery.set('dueFrom', financeDueFrom);
  if (financeDueTo) financeListQuery.set('dueTo', financeDueTo);

  const financeTotalsQuery = new URLSearchParams();
  financeTotalsQuery.set('matterId', id);
  financeTotalsQuery.set('pageSize', '5000');
  if (financeDirection !== 'ALL') financeTotalsQuery.set('direction', financeDirection);
  if (financeStatus !== 'ALL') financeTotalsQuery.set('status', financeStatus);
  if (financeDateBasis !== 'DUE') financeTotalsQuery.set('dateBasis', financeDateBasis);
  if (financeDueFrom) financeTotalsQuery.set('dueFrom', financeDueFrom);
  if (financeDueTo) financeTotalsQuery.set('dueTo', financeDueTo);

  const financeResp: MatterFinanceInstallmentsResp = canFinanceRead
    ? await apiGet<MatterFinanceInstallmentsResp>(`/finance/installments?${financeListQuery.toString()}`).catch(() => ({
        value: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      }))
    : { value: [], total: 0, page: 1, pageSize: 10, totalPages: 1 };
  const financeInstallments = Array.isArray(financeResp.value) ? financeResp.value : [];
  const financeTotalsResp: MatterFinanceInstallmentsResp = canFinanceRead
    ? await apiGet<MatterFinanceInstallmentsResp>(`/finance/installments?${financeTotalsQuery.toString()}`).catch(() => ({
        value: [],
        total: 0,
        page: 1,
        pageSize: 5000,
        totalPages: 1,
      }))
    : { value: [], total: 0, page: 1, pageSize: 5000, totalPages: 1 };
  const financeInstallmentsForTotals = Array.isArray(financeTotalsResp.value) ? financeTotalsResp.value : [];
  const financeTotals = financeInstallmentsForTotals.reduce(
    (acc, inst) => {
      const dir = String(inst.entry?.direction || 'IN').toUpperCase() === 'OUT' ? 'OUT' : 'IN';
      const status = String(inst.effectiveStatus || '').toUpperCase();
      const amount = Number(inst.amountCents || 0);
      if (dir === 'IN') acc.toReceive += amount;
      else acc.toPay += amount;
      if (status === 'SETTLED') {
        if (dir === 'IN') acc.received += Number(inst.paidAmountCents || inst.amountCents || 0);
        else acc.paid += Number(inst.paidAmountCents || inst.amountCents || 0);
      }
      if (dir === 'IN' && status === 'OVERDUE') acc.overdue += amount;
      return acc;
    },
    { toReceive: 0, toPay: 0, received: 0, paid: 0, overdue: 0 },
  );

  let timeline: AuditItem[] = [];
  let totalHistory = 0;
  let totalHistoryPages = 1;
  let currentHistoryPage = historyPage;
  if (canAuditRead) {
    const historyQs = new URLSearchParams();
    historyQs.set('limit', String(historyPageSize));
    historyQs.set('page', String(historyPage));
    historyQs.set('systemOnly', '1');
    if (historyQRaw.trim()) historyQs.set('q', historyQRaw.trim());

    const auditResp = await apiGet<AuditResponse>(
      `/matters/${id}/audit?${historyQs.toString()}`,
    ).catch(() => []);
    const paged = auditResp as AuditResponse;
    timeline = Array.isArray(paged?.value) ? paged.value : [];
    totalHistory = Number(paged?.total || 0);
    totalHistoryPages = Math.max(1, Number(paged?.totalPages || 1));
    currentHistoryPage = Math.max(1, Math.min(historyPage, totalHistoryPages));
  }
  const updatesResp = await apiGet<{ value: MatterUpdate[] } | MatterUpdate[]>(
    `/matters/${id}/updates?limit=30`,
  );
  const updates = Array.isArray(updatesResp) ? updatesResp : updatesResp.value ?? [];
  const historyPageItems = timeline;

  const latestStatusEvent = timeline.find((ev) => ev.action === 'MATTER_STATUS_CHANGED');
  const latestStatusDetail = latestStatusEvent ? timelineDetail(latestStatusEvent) : null;

  const todayKey = dateKeyInTimeZone(new Date(), tenantTimeZone);
  const weekEndKeyExclusive = addDaysToDateKey(todayKey, 8);

  const filteredTasks = tasks.filter((t) => {
    if (assignee) {
      if (assignee === 'unassigned' && t.assignedTo) return false;
      if (assignee !== 'unassigned' && t.assignedTo?.id !== assignee) return false;
    }
    if (taskFilter === "all") return true;
    if (taskFilter === "done") return t.status === "DONE";
    if (taskFilter === "today") {
      const dueKey = dateKeyInTimeZone(t.dueDate, tenantTimeZone);
      return !!dueKey && dueKey === todayKey;
    }
    if (taskFilter === "week") {
      const dueKey = dateKeyInTimeZone(t.dueDate, tenantTimeZone);
      return !!dueKey && dueKey >= todayKey && dueKey < weekEndKeyExclusive && t.status !== "DONE";
    }
    return t.status !== "DONE";
  });

  const filteredDeadlines = deadlines.filter((d) => {
    if (deadlineFilter === "all") return true;
    if (deadlineFilter === "done") return d.isDone;

    const dueKey = dateKeyInTimeZone(d.dueDate, tenantTimeZone);
    if (deadlineFilter === "today") return !!dueKey && dueKey === todayKey && !d.isDone;
    if (deadlineFilter === "week") return !!dueKey && dueKey >= todayKey && dueKey < weekEndKeyExclusive && !d.isDone;
    if (deadlineFilter === "overdue") return !!dueKey && dueKey < todayKey && !d.isDone;
    return !d.isDone;
  });

  const assigneeOptions = Array.from(
    new Map(
      tasks
        .filter((t) => t.assignedTo)
        .map((t) => [t.assignedTo!.id, t.assignedTo!])
    ).values()
  );

  const filteredUpdates = updates.filter((u) => {
    if (updateType !== 'ALL' && String(u.type || '').toUpperCase() !== updateType) {
      return false;
    }

    const when = new Date(u.eventDate || u.createdAt).getTime();
    if (updateFrom) {
      const from = new Date(`${updateFrom}T00:00:00`).getTime();
      if (!Number.isNaN(from) && when < from) return false;
    }
    if (updateTo) {
      const to = new Date(`${updateTo}T23:59:59.999`).getTime();
      if (!Number.isNaN(to) && when > to) return false;
    }

    if (updateQ) {
      const text = `${u.title} ${u.description} ${u.user?.name || ''} ${u.user?.email || ''}`.toLowerCase();
      if (!text.includes(updateQ)) return false;
    }
    return true;
  });

  const orderedUpdates = [...filteredUpdates].sort((a, b) => {
    const aDate = new Date(a.eventDate || a.createdAt).getTime();
    const bDate = new Date(b.eventDate || b.createdAt).getTime();

    if (updateOrder === 'oldest') return aDate - bDate;
    if (updateOrder === 'type') {
      const byType = String(a.type || '').localeCompare(String(b.type || ''), 'pt-BR');
      if (byType !== 0) return byType;
      return bDate - aDate;
    }
    return bDate - aDate;
  });

  const totalUpdates = orderedUpdates.length;
  const totalUpdatePages = Math.max(1, Math.ceil(totalUpdates / updatePageSize));
  const currentUpdatePage = Math.min(updatePage, totalUpdatePages);
  const updateStart = (currentUpdatePage - 1) * updatePageSize;
  const updatePageItems = orderedUpdates.slice(updateStart, updateStart + updatePageSize);
  const updateStartItem = totalUpdates === 0 ? 0 : updateStart + 1;
  const updateEndItem = Math.min(updateStart + updatePageSize, totalUpdates);
  const historyStartItem = totalHistory === 0 ? 0 : (currentHistoryPage - 1) * historyPageSize + 1;
  const historyEndItem = Math.min(currentHistoryPage * historyPageSize, totalHistory);
  const financeCurrentPage = Math.max(1, Number(financeResp.page || 1));
  const financeTotalPages = Math.max(1, Number(financeResp.totalPages || 1));
  const financeTotalItems = Number(financeResp.total || 0);
  const financeStartItem = financeTotalItems === 0 ? 0 : (financeCurrentPage - 1) * 10 + 1;
  const financeEndItem = Math.min(financeCurrentPage * 10, financeTotalItems);

  const buildUpdatesHref = (next: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    params.set('tab', 'updates');
    if (updateType !== 'ALL') params.set('updateType', updateType);
    if (updateFrom) params.set('updateFrom', updateFrom);
    if (updateTo) params.set('updateTo', updateTo);
    if (updateQRaw.trim()) params.set('updateQ', updateQRaw.trim());
    if (updateOrder !== 'recent') params.set('updateOrder', updateOrder);
    if (updatePageSize !== 10) params.set('updatePageSize', String(updatePageSize));

    Object.entries(next).forEach(([key, value]) => {
      if (value === undefined || value === '') params.delete(key);
      else params.set(key, String(value));
    });

    const q = params.toString();
    return q ? `/matters/${id}?${q}` : `/matters/${id}?tab=updates`;
  };

  const buildHistoryHref = (next: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    params.set('tab', 'history');
    if (historyQRaw.trim()) params.set('historyQ', historyQRaw.trim());
    if (historyPageSize !== 10) params.set('historyPageSize', String(historyPageSize));

    Object.entries(next).forEach(([key, value]) => {
      if (value === undefined || value === '') params.delete(key);
      else params.set(key, String(value));
    });

    const q = params.toString();
    return q ? `/matters/${id}?${q}` : `/matters/${id}?tab=history`;
  };

  const buildFinanceHref = (next: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    params.set('tab', 'finance');
    if (financeDirection !== 'ALL') params.set('financeDirection', financeDirection);
    if (financeStatus !== 'ALL') params.set('financeStatus', financeStatus);
    if (financeDateBasis !== 'DUE') params.set('financeDateBasis', financeDateBasis);
    if (financeDueFrom) params.set('financeDueFrom', financeDueFrom);
    if (financeDueTo) params.set('financeDueTo', financeDueTo);
    if (financePage > 1) params.set('financePage', String(financePage));

    Object.entries(next).forEach(([key, value]) => {
      if (value === undefined || value === '') params.delete(key);
      else params.set(key, String(value));
    });

    const q = params.toString();
    return q ? `/matters/${id}?${q}` : `/matters/${id}?tab=finance`;
  };

  const financeExportQs = new URLSearchParams();
  if (financeDirection !== 'ALL') financeExportQs.set('direction', financeDirection);
  if (financeStatus !== 'ALL') financeExportQs.set('status', financeStatus);
  if (financeDateBasis !== 'DUE') financeExportQs.set('dateBasis', financeDateBasis);
  if (financeDueFrom) financeExportQs.set('dueFrom', financeDueFrom);
  if (financeDueTo) financeExportQs.set('dueTo', financeDueTo);
  const financeExportHref = `/api/finance/matters/${id}/export.pdf${
    financeExportQs.toString() ? `?${financeExportQs.toString()}` : ''
  }`;
  const financeStatusOptions = [
    { value: 'ALL', label: 'Todos status' },
    { value: 'OPEN', label: 'Em aberto' },
    { value: 'SETTLED', label: 'Quitado' },
    { value: 'OVERDUE', label: 'Vencido' },
    { value: 'CANCELED', label: 'Cancelado' },
  ];
  const financeDateBasisOptions = [
    { value: 'DUE', label: 'Vencimento' },
    { value: 'PAID', label: 'Baixa' },
  ];

  return (
    <main className={`${styles.page} appPageShell`}>
      <div className={styles.breadcrumbs}>
        <Link href="/matters" className={styles.linkMuted}>← Casos</Link>
      </div>

      <header className={styles.header}>
        <div className={styles.headerMain}>
          <h1 className={styles.title}>{matter.title}</h1>
          <div className={styles.meta}>
            <span><b>Nº:</b> {matter.caseNumber || '-'}</span>
            <span><b>Criado:</b> {formatDateBR(matter.createdAt, tenantTimeZone)}</span>
          </div>
          {latestStatusDetail ? (
            <div className={styles.statusReason}>
              <b>Última atualização de status:</b> {latestStatusDetail}
            </div>
          ) : null}
        </div>
        <div className={styles.pills}>
          <Pill>{matter.client?.name || 'Sem pessoa vinculada'}</Pill>
          <Pill>{matter.area || 'Sem área'}</Pill>
          <Pill>{matter.subject || 'Sem assunto'}</Pill>
          <Pill>{matter.court || 'Sem vara/tribunal'}</Pill>
          <Pill tone={matter.status === 'CLOSED' ? 'success' : 'info'}>Status: {formatStatus(matter.status)}</Pill>
        </div>
      </header>

      <nav className={styles.tabs}>
        <Link href={`/matters/${id}?tab=overview`} className={`${styles.tab} ${tab === "overview" ? styles.tabActive : ""}`}>Visão geral</Link>
        <Link href={`/matters/${id}?tab=tasks`} className={`${styles.tab} ${tab === "tasks" ? styles.tabActive : ""}`}>Tarefas</Link>
        <Link href={`/matters/${id}?tab=deadlines`} className={`${styles.tab} ${tab === "deadlines" ? styles.tabActive : ""}`}>Prazos</Link>
        <Link href={`/matters/${id}?tab=documents`} className={`${styles.tab} ${tab === "documents" ? styles.tabActive : ""}`}>Documentos</Link>
        <Link href={`/matters/${id}?tab=updates`} className={`${styles.tab} ${tab === "updates" ? styles.tabActive : ""}`}>Andamentos</Link>
        {canFinanceRead ? (
          <Link href={`/matters/${id}?tab=finance`} className={`${styles.tab} ${tab === "finance" ? styles.tabActive : ""}`}>Financeiro</Link>
        ) : null}
        {canAuditRead ? (
          <Link href={`/matters/${id}?tab=history`} className={`${styles.tab} ${tab === "history" ? styles.tabActive : ""}`}>Histórico do caso</Link>
        ) : null}
        <div className={styles.tabsActions}>
          <MatterStatusAction matterId={matter.id} status={matter.status} />
          {matter.status === 'OPEN' && canMatterEdit ? (
            <Link href={`/matters/${id}/edit`} className={styles.editButton}>Editar caso</Link>
          ) : null}
        </div>
      </nav>

      {tab === "overview" ? (
        <section className={styles.overviewGrid}>
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Tarefas abertas</div>
              <div className={styles.kpiValue}>{tasks.filter((t) => t.status !== "DONE").length}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Prazos pendentes</div>
              <div className={styles.kpiValue}>{deadlines.filter((d) => !d.isDone).length}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Documentos</div>
              <div className={styles.kpiValue}>{documents.length}</div>
            </div>
          </div>

          <div className={styles.overviewColumns}>
            <div className={styles.overviewMain}>
              <Card title={`Tarefas (${tasks.length})`}>
                {tasks.length === 0 ? (
                  <div className={styles.muted}>Nenhuma tarefa cadastrada.</div>
                ) : (
                  <div className={styles.list}>
                    {tasks.slice(0, 4).map((t) => (
                      <div key={t.id} className={styles.item}>
                        <div className={styles.itemRow}>
                          <div className={styles.itemTitle}>{t.title}</div>
                          <div className={styles.itemPills}>
                          <Pill tone={taskStatusTone(t.status)}>Status: {formatStatus(t.status)}</Pill>
                          <Pill tone={priorityTone(t.priority)}>Prioridade: {formatPriority(t.priority)}</Pill>
                          <Pill>Vence: {formatDateBR(t.dueDate ?? null, tenantTimeZone)}</Pill>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card title={`Prazos (${deadlines.length})`}>
                {deadlines.length === 0 ? (
                  <div className={styles.muted}>Nenhum prazo cadastrado.</div>
                ) : (
                  <div className={styles.list}>
                    {deadlines.slice(0, 4).map((d) => (
                      <div key={d.id} className={styles.item}>
                        <div className={styles.itemRow}>
                          <div className={styles.itemTitle}>{d.title}</div>
                          <div className={styles.itemPills}>
                          <Pill tone="muted">Tipo: {formatDeadlineType(d.type)}</Pill>
                          <Pill>Vence: {formatDateBR(d.dueDate, tenantTimeZone)}</Pill>
                          <Pill tone={d.isDone ? 'success' : 'warning'}>Status: {d.isDone ? "Concluído" : "Pendente"}</Pill>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <div className={styles.overviewSide}>
              <Card title={`Andamentos recentes (${updates.length})`}>
                {updates.length > 0 ? (
                  <div className={styles.timeline}>
                    {updates.slice(0, 5).map((u) => (
                      <div key={u.id} className={styles.timelineItem}>
                        <div className={styles.timelineHeader}>
                          <b>{u.title}</b>
                          <span>{formatDateBR(u.eventDate || u.createdAt, tenantTimeZone)}</span>
                        </div>
                        <div className={styles.timelineMeta}>
                          Tipo: {u.type} · {u.user?.name || 'Sistema'}
                          {u.user?.email ? ` (${u.user.email})` : ''}
                        </div>
                        {u.description ? (
                          <div className={styles.timelineDetail}>{u.description}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.muted}>Nenhum andamento manual registrado.</div>
                )}
                <div className={styles.spacer12} />
                <Link href={`/matters/${id}?tab=updates`} className={styles.actionLink}>
                  Ver todos os andamentos
                </Link>
              </Card>
            </div>
          </div>
        </section>
      ) : null}

      {tab === "tasks" ? (
        <Card title={`Tarefas (${tasks.length})`}>
          {canTaskCreate ? <CreateTaskForm matterId={matter.id} /> : null}
          <div className={styles.filters}>
            <Link href={`/matters/${id}?tab=tasks&taskFilter=open`} className={`${styles.filterTab} ${taskFilter === "open" ? styles.filterTabActive : ""}`}>Abertas</Link>
            <Link href={`/matters/${id}?tab=tasks&taskFilter=today`} className={`${styles.filterTab} ${taskFilter === "today" ? styles.filterTabActive : ""}`}>Hoje</Link>
            <Link href={`/matters/${id}?tab=tasks&taskFilter=week`} className={`${styles.filterTab} ${taskFilter === "week" ? styles.filterTabActive : ""}`}>Próx. 7 dias</Link>
            <Link href={`/matters/${id}?tab=tasks&taskFilter=done`} className={`${styles.filterTab} ${taskFilter === "done" ? styles.filterTabActive : ""}`}>Concluídas</Link>
            <Link href={`/matters/${id}?tab=tasks&taskFilter=all`} className={`${styles.filterTab} ${taskFilter === "all" ? styles.filterTabActive : ""}`}>Todas</Link>
          </div>
          <TaskAssigneeFilter
            matterId={id}
            taskFilter={taskFilter}
            assignee={assignee}
            users={assigneeOptions.map((u) => ({ id: u.id, name: u.name, email: u.email }))}
            wrapClassName={styles.assigneeFilterWrap}
            labelClassName={styles.assigneeLabel}
            selectClassName={styles.assigneeSelect}
          />

          {filteredTasks.length === 0 ? (
            <div className={styles.muted}>Nenhuma tarefa cadastrada.</div>
          ) : (
            <div className={styles.list}>
              {filteredTasks.map((t) => (
                <div key={t.id} className={styles.item}>
                  <div className={styles.itemRow}>
                    <div className={styles.itemTitle}>{t.title}</div>
                  </div>
                  <div className={styles.itemFooter}>
                    <div className={styles.itemPills}>
                      <Pill tone={taskStatusTone(t.status)}>Status: {formatStatus(t.status)}</Pill>
                      <Pill tone={priorityTone(t.priority)}>Prioridade: {formatPriority(t.priority)}</Pill>
                      {(() => {
                        const dueInput = dateKeyInTimeZone(t.dueDate, tenantTimeZone);
                        const overdue = !!dueInput && dueInput < todayKey && t.status !== 'DONE';
                        return <Pill tone={overdue ? 'danger' : 'default'}>{overdue ? `Atrasada: ${formatDateBR(t.dueDate ?? null, tenantTimeZone)}` : `Vence: ${formatDateBR(t.dueDate ?? null, tenantTimeZone)}`}</Pill>;
                      })()}
                      {(() => {
                        const dueInput = dateKeyInTimeZone(t.dueDate, tenantTimeZone);
                        const dueToday = !!dueInput && dueInput === todayKey && t.status !== 'DONE';
                        return dueToday ? <Pill tone="warning">Hoje</Pill> : null;
                      })()}
                    </div>
                    <div className={styles.itemActions}>
                      <TaskStatusAction taskId={t.id} currentStatus={t.status} />
                      <TaskCrudActions task={t} canEdit={canTaskEdit} canDelete={canDelete} />
                    </div>
                  </div>
                  {t.description ? <div className={styles.itemDesc}>{t.description}</div> : null}
                  <div className={styles.itemMeta}>
                    {t.assignedTo ? (
                      <>
                        <b>Responsável:</b> {t.assignedTo.name} ({t.assignedTo.email})
                      </>
                    ) : (
                      <span>Sem responsável.</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      {tab === "deadlines" ? (
        <Card title={`Prazos (${deadlines.length})`}>
          {canDeadlineCreate ? <CreateDeadlineForm matterId={matter.id} /> : null}

          <div className={styles.filters}>
            <Link href={`/matters/${id}?tab=deadlines&deadlineFilter=pending`} className={`${styles.filterTab} ${deadlineFilter === "pending" ? styles.filterTabActive : ""}`}>Pendentes</Link>
            <Link href={`/matters/${id}?tab=deadlines&deadlineFilter=overdue`} className={`${styles.filterTab} ${deadlineFilter === "overdue" ? styles.filterTabActive : ""}`}>Atrasados</Link>
            <Link href={`/matters/${id}?tab=deadlines&deadlineFilter=today`} className={`${styles.filterTab} ${deadlineFilter === "today" ? styles.filterTabActive : ""}`}>Hoje</Link>
            <Link href={`/matters/${id}?tab=deadlines&deadlineFilter=week`} className={`${styles.filterTab} ${deadlineFilter === "week" ? styles.filterTabActive : ""}`}>Próx. 7 dias</Link>
            <Link href={`/matters/${id}?tab=deadlines&deadlineFilter=done`} className={`${styles.filterTab} ${deadlineFilter === "done" ? styles.filterTabActive : ""}`}>Concluídos</Link>
            <Link href={`/matters/${id}?tab=deadlines&deadlineFilter=all`} className={`${styles.filterTab} ${deadlineFilter === "all" ? styles.filterTabActive : ""}`}>Todos</Link>
          </div>

          {filteredDeadlines.length === 0 ? (
            <div className={styles.muted}>Nenhum prazo cadastrado.</div>
          ) : (
            <div className={styles.list}>
              {filteredDeadlines.map((d) => (
                <div key={d.id} className={styles.item}>
                  <div className={styles.itemRow}>
                    <div className={styles.itemTitle}>{d.title}</div>
                  </div>
                  <div className={styles.itemFooter}>
                    <div className={styles.itemPills}>
                      <Pill tone="muted">Tipo: {formatDeadlineType(d.type)}</Pill>
                      {(() => {
                        const dueInput = dateKeyInTimeZone(d.dueDate, tenantTimeZone);
                        const overdue = !!dueInput && dueInput < todayKey && !d.isDone;
                        return <Pill tone={overdue ? 'danger' : 'default'}>{overdue ? `Atrasado: ${formatDateBR(d.dueDate, tenantTimeZone)}` : `Vence: ${formatDateBR(d.dueDate, tenantTimeZone)}`}</Pill>;
                      })()}
                      {(() => {
                        const dueInput = dateKeyInTimeZone(d.dueDate, tenantTimeZone);
                        const dueToday = !!dueInput && dueInput === todayKey && !d.isDone;
                        return dueToday ? <Pill tone="warning">Hoje</Pill> : null;
                      })()}
                      <Pill tone={d.isDone ? 'success' : 'warning'}>Status: {d.isDone ? "Concluído" : "Pendente"}</Pill>
                    </div>
                    <div className={styles.itemActions}>
                      <DeadlineDoneAction deadlineId={d.id} isDone={d.isDone} />
                      <DeadlineCrudActions deadline={d} canEdit={canDeadlineEdit} canDelete={canDelete} />
                    </div>
                  </div>
                  {d.notes ? <div className={styles.itemDesc}>{d.notes}</div> : null}
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      {tab === "documents" ? (
        <Card title={`Documentos (${documents.length})`}>
          <DocumentsPanel
            matterId={matter.id}
            documents={documents}
            canUpload={canDocumentUpload}
            canEdit={canDocumentEdit}
            canDelete={canDelete}
            tenantTimeZone={tenantTimeZone}
          />
        </Card>
      ) : null}

      {tab === "updates" ? (
        <Card title={`Andamentos (${totalUpdates})`}>
          {canUpdateCreate ? <CreateMatterUpdateForm matterId={id} /> : null}
          <div className={styles.spacer12} />
          <MatterUpdatesFilters
            matterId={id}
            updateType={updateType}
            updateFrom={updateFrom}
            updateTo={updateTo}
            updateQ={updateQRaw}
            updateOrder={updateOrder}
          />
          <div className={styles.spacer12} />
          {updatePageItems.length === 0 ? (
            <UIListEmpty className={styles.muted}>Nenhum andamento manual registrado.</UIListEmpty>
          ) : (
            <UIListStack className={styles.timeline}>
              {updatePageItems.map((u) => (
                <UIListRow key={u.id} className={styles.timelineItem}>
                  <UIListRowMain>
                  <div className={styles.timelineHeader}>
                    <b>{u.title}</b>
                    <span>{formatDateBR(u.eventDate || u.createdAt, tenantTimeZone)}</span>
                  </div>
                  <div className={styles.timelineMeta}>
                    Tipo: {u.type} · {u.user?.name || 'Sistema'}
                    {u.user?.email ? ` (${u.user.email})` : ''}
                  </div>
                  {u.description ? (
                    <div className={styles.timelineDetail}>{u.description}</div>
                  ) : null}
                  <MatterUpdateActions
                    matterId={id}
                    update={u}
                    canEdit={canUpdateEdit}
                    canDelete={canUpdateDelete}
                  />
                  </UIListRowMain>
                </UIListRow>
              ))}
            </UIListStack>
          )}
          {totalUpdatePages > 1 ? (
            <UIListPager
              className={styles.paginationRow}
              meta={<>Exibindo {updateStartItem}-{updateEndItem} de {totalUpdates}</>}
              actions={
                <div className={styles.paginationControls}>
                <Link
                  href={buildUpdatesHref({ updatePage: Math.max(1, currentUpdatePage - 1) })}
                  className={styles.actionLink}
                >
                  Anterior
                </Link>
                <span className={styles.pageNumber}>Página {currentUpdatePage} de {totalUpdatePages}</span>
                <Link
                  href={buildUpdatesHref({
                    updatePage: Math.min(totalUpdatePages, currentUpdatePage + 1),
                  })}
                  className={styles.actionLink}
                >
                  Próxima
                </Link>
                </div>
              }
            />
          ) : null}
        </Card>
      ) : null}

      {tab === "finance" ? (
        <Card title={`Financeiro do caso (${financeResp.total || financeInstallments.length})`}>
          <div className={styles.filters}>
            <Link href={buildFinanceHref({ financeDirection: '', financePage: '' })} className={`${styles.filterTab} ${financeDirection === 'ALL' ? styles.filterTabActive : ''}`}>Todos</Link>
            <Link href={buildFinanceHref({ financeDirection: 'IN', financePage: '' })} className={`${styles.filterTab} ${financeDirection === 'IN' ? styles.filterTabActive : ''}`}>Receber</Link>
            <Link href={buildFinanceHref({ financeDirection: 'OUT', financePage: '' })} className={`${styles.filterTab} ${financeDirection === 'OUT' ? styles.filterTabActive : ''}`}>Pagar</Link>
          </div>
          <form method="GET" action={`/matters/${id}`} className={styles.financeFilterRow}>
            <input type="hidden" name="tab" value="finance" />
            {financeDirection !== 'ALL' ? <input type="hidden" name="financeDirection" value={financeDirection} /> : null}
            <div className={styles.financeFilterField}>
              <span className={styles.assigneeLabel}>Status</span>
              <UISelect
                key={`finance-status-${financeStatus}`}
                className={styles.assigneeSelect}
                name="financeStatus"
                defaultValue={financeStatus}
                options={financeStatusOptions}
                ariaLabel="Status financeiro"
              />
            </div>
            <div className={styles.financeFilterField}>
              <span className={styles.assigneeLabel}>Base de data</span>
              <UISelect
                key={`finance-date-basis-${financeDateBasis}`}
                className={styles.assigneeSelect}
                name="financeDateBasis"
                defaultValue={financeDateBasis}
                options={financeDateBasisOptions}
                ariaLabel="Base de data do filtro financeiro"
              />
            </div>
            <label className={styles.financeFilterField} htmlFor="financeDueFrom">
              <span className={styles.assigneeLabel}>De</span>
              <input id="financeDueFrom" name="financeDueFrom" type="date" defaultValue={financeDueFrom} className={styles.assigneeSelect} />
            </label>
            <label className={styles.financeFilterField} htmlFor="financeDueTo">
              <span className={styles.assigneeLabel}>Até</span>
              <input id="financeDueTo" name="financeDueTo" type="date" defaultValue={financeDueTo} className={styles.assigneeSelect} />
            </label>
            <div className={styles.financeFilterActions}>
              <button type="submit" className={styles.ghostButton}>Aplicar</button>
              <Link href={buildFinanceHref({ financeDueFrom: '', financeDueTo: '', financePage: '' })} className={styles.ghostButton}>Limpar período</Link>
            </div>
          </form>
          <div className={styles.hint}>Base aplicada do período: {financeDateBasis === 'PAID' ? 'Data de baixa' : 'Data de vencimento'}.</div>
          <div className={styles.spacer12} />
          <div className={styles.financeKpiGrid}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>A receber (previsto)</div>
              <div className={styles.kpiValue}>{(financeTotals.toReceive / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>A pagar (previsto)</div>
              <div className={styles.kpiValue}>{(financeTotals.toPay / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Recebido</div>
              <div className={styles.kpiValue}>{(financeTotals.received / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Pago</div>
              <div className={styles.kpiValue}>{(financeTotals.paid / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Saldo realizado</div>
              <div className={styles.kpiValue}>{((financeTotals.received - financeTotals.paid) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Vencido (receber)</div>
              <div className={styles.kpiValue}>{(financeTotals.overdue / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
            </div>
          </div>
          <div className={styles.spacer12} />
          <div className={styles.rowActions}>
            <Link href={`/finance/new?matterId=${id}`} className={styles.editButton}>Novo lançamento financeiro</Link>
            <Link href={`/finance?matterId=${id}`} className={styles.ghostButton}>Abrir módulo financeiro</Link>
            <a href={financeExportHref} className={styles.ghostButton}>Exportar financeiro (PDF)</a>
          </div>
          <div className={styles.spacer12} />
          {financeInstallments.length === 0 ? (
            <div className={styles.empty}>Nenhum lançamento financeiro vinculado a este caso.</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Lançamento</th>
                    <th>Tipo</th>
                    <th>Categoria</th>
                    <th>Vencimento</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th>Baixa</th>
                  </tr>
                </thead>
                <tbody>
                  {financeInstallments.map((inst) => (
                    <tr key={inst.id}>
                      <td>
                        <Link href={`/finance/${inst.entry?.id || ''}`} className={styles.link}>
                          {inst.entry?.code ? `#${inst.entry.code} · ` : ''}{inst.entry?.description || `Parcela ${inst.number}`}
                        </Link>
                      </td>
                      <td>{financeDirectionLabel(inst.entry?.direction)}</td>
                      <td>{inst.entry?.category?.name || '-'}</td>
                      <td>{formatDateBR(inst.dueDate, tenantTimeZone)}</td>
                      <td>{(Number(inst.amountCents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td>{financeStatusLabel(inst.effectiveStatus)}</td>
                      <td>{inst.paidAt ? formatDateBR(inst.paidAt, tenantTimeZone) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {financeTotalItems > 0 ? (
            <div className={styles.paginationRow}>
              <div className={styles.meta}>Exibindo {financeStartItem}-{financeEndItem} de {financeTotalItems}</div>
              <div className={styles.paginationControls}>
                {financeCurrentPage > 1 ? (
                  <Link
                    href={buildFinanceHref({ financePage: String(Math.max(1, financeCurrentPage - 1)) })}
                    className={styles.actionLink}
                  >
                    Anterior
                  </Link>
                ) : (
                  <span className={`${styles.actionLink} ${styles.pageBtnDisabled}`}>Anterior</span>
                )}
                <span className={styles.pageNumber}>Página {financeCurrentPage} de {financeTotalPages}</span>
                {financeCurrentPage < financeTotalPages ? (
                  <Link
                    href={buildFinanceHref({ financePage: String(Math.min(financeTotalPages, financeCurrentPage + 1)) })}
                    className={styles.actionLink}
                  >
                    Próxima
                  </Link>
                ) : (
                  <span className={`${styles.actionLink} ${styles.pageBtnDisabled}`}>Próxima</span>
                )}
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      {tab === "history" ? (
        <Card title={`Histórico do caso (${totalHistory})`}>
          <MatterHistoryFilters matterId={id} historyQ={historyQRaw} />
          <div className={styles.spacer12} />
          {historyPageItems.length === 0 ? (
            <UIListEmpty className={styles.muted}>Nenhum evento automático registrado.</UIListEmpty>
          ) : (
            <UIListStack className={styles.timeline}>
              {historyPageItems.map((ev) => (
                <UIListRow key={ev.id} className={styles.timelineItem}>
                  <UIListRowMain>
                  <div className={styles.timelineHeader}>
                    <b>{timelineActionLabel(ev.action)}</b>
                    <span>{formatDateBR(ev.createdAt, tenantTimeZone)}</span>
                  </div>
                  <div className={styles.timelineMeta}>
                    {ev.user?.name || 'Sistema'}
                    {ev.user?.email ? ` (${ev.user.email})` : ''}
                  </div>
                  {timelineDetail(ev) ? (
                    <div className={styles.timelineDetail}>{timelineDetail(ev)}</div>
                  ) : null}
                  </UIListRowMain>
                </UIListRow>
              ))}
            </UIListStack>
          )}
          <UIListPager
            className={styles.paginationRow}
            meta={<>Exibindo {historyStartItem}-{historyEndItem} de {totalHistory}</>}
            actions={
              <div className={styles.paginationControls}>
              <MatterHistoryPageSizeSelect currentPageSize={historyPageSize} />
              {currentHistoryPage > 1 ? (
                <Link
                  href={buildHistoryHref({
                    historyPage: Math.max(1, currentHistoryPage - 1),
                  })}
                  className={styles.actionLink}
                >
                  Anterior
                </Link>
              ) : (
                <span className={`${styles.actionLink} ${styles.pageBtnDisabled}`}>Anterior</span>
              )}
              <UIListPagerPage>
                Página {currentHistoryPage} de {totalHistoryPages}
              </UIListPagerPage>
              {currentHistoryPage < totalHistoryPages ? (
                <Link
                  href={buildHistoryHref({
                    historyPage: Math.min(totalHistoryPages, currentHistoryPage + 1),
                  })}
                  className={styles.actionLink}
                >
                  Próxima
                </Link>
              ) : (
                <span className={`${styles.actionLink} ${styles.pageBtnDisabled}`}>Próxima</span>
              )}
              </div>
            }
          />
        </Card>
      ) : null}
    </main>
  );
}

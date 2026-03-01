'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './reports.module.css';
import { formatDateBR, formatStatus } from '@/lib/format';
import { UIButton } from '@/components/ui/Button';
import { UISelect } from '@/components/ui/Select';

type Matter = {
  id: string;
  title: string;
  area: string | null;
  status: string;
  createdAt: string;
};

type DashboardResp = {
  rangeDays: number;
  counts: {
    openMatters: number;
    openTasks: number;
    pendingDeadlines: number;
  };
  upcomingDeadlines: Array<{
    id: string;
    title: string;
    type: string;
    dueDate: string;
    matter: { id: string; title: string };
  }>;
  openTasks: Array<{
    id: string;
    title: string;
    priority: string;
    status?: string;
    dueDate: string | null;
    assignedTo?: { id: string; name: string } | null;
    matter?: { id: string; title: string } | null;
  }>;
};

type ReportsActionsProps = {
  rangeDays: number;
  matters: Matter[];
  dashboard: DashboardResp;
};

function groupBy<T>(items: T[], keyFn: (item: T) => string) {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item) || 'Outros';
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

export default function ReportsActions({ rangeDays, matters, dashboard }: ReportsActionsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (tone: 'success' | 'error', message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ tone, message });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3200);
  };

  const statusGroups = useMemo(
    () => groupBy(matters, (m) => formatStatus(m.status)),
    [matters]
  );
  const areaGroups = useMemo(
    () => groupBy(matters, (m) => (m.area || 'Não informado')),
    [matters]
  );
  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    matters.forEach((matter) => {
      const raw = String(matter.status || '').trim().toUpperCase();
      if (raw) set.add(raw);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [matters]);
  const responsibleOptions = useMemo(() => {
    const map = new Map<string, string>();
    dashboard.openTasks.forEach((task) => {
      if (!task.assignedTo?.id) return;
      map.set(task.assignedTo.id, task.assignedTo.name);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [dashboard.openTasks]);
  const deadlineTypes = useMemo(() => {
    const set = new Set<string>();
    dashboard.upcomingDeadlines.forEach((deadline) => {
      const type = String(deadline.type || '').trim();
      if (type) set.add(type);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [dashboard.upcomingDeadlines]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams?.toString());
    if (value.trim()) next.set(key, value.trim());
    else next.delete(key);
    router.push(`/reports?${next.toString()}`);
    router.refresh();
  };
  const handleRangeChange = (value: string) => updateParam('days', value);

  const auditReportAction = async (type: 'CSV' | 'PRINT') => {
    try {
      await fetch('/api/reports/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          days: Number(searchParams?.get('days') || rangeDays),
          q: searchParams?.get('q') || '',
          status: searchParams?.get('status') || '',
          area: searchParams?.get('area') || '',
          responsible: searchParams?.get('responsible') || '',
          deadlineType: searchParams?.get('deadlineType') || '',
        }),
      });
    } catch {
      // não bloquear ação do usuário por falha de auditoria
    }
  };

  const exportCsv = () => {
    void auditReportAction('CSV');
    const rows: string[][] = [];
    rows.push(['Relatórios LexFlow', `Período: ${rangeDays} dias`]);
    rows.push([]);
    rows.push(['KPIs']);
    rows.push(['Casos em aberto', String(dashboard.counts.openMatters)]);
    rows.push(['Tarefas em aberto', String(dashboard.counts.openTasks)]);
    rows.push(['Prazos pendentes', String(dashboard.counts.pendingDeadlines)]);
    rows.push([]);
    rows.push(['Casos por status']);
    statusGroups.forEach(([label, count]) => rows.push([label, String(count)]));
    rows.push([]);
    rows.push(['Casos por área']);
    areaGroups.forEach(([label, count]) => rows.push([label, String(count)]));
    rows.push([]);
    rows.push([`Prazos próximos (${rangeDays} dias)`]);
    rows.push(['Título', 'Caso', 'Tipo', 'Vencimento']);
    dashboard.upcomingDeadlines.forEach((d) =>
      rows.push([d.title, d.matter.title, d.type, formatDateBR(d.dueDate)])
    );
    rows.push([]);
    rows.push(['Tarefas abertas']);
    rows.push(['Título', 'Caso', 'Prioridade', 'Vencimento']);
    dashboard.openTasks.forEach((t) =>
      rows.push([
        t.title,
        t.matter?.title || 'Sem caso',
        t.priority,
        t.dueDate ? formatDateBR(t.dueDate) : 'Sem prazo',
      ])
    );

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorios-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPdfServer = async () => {
    try {
      const params = new URLSearchParams(searchParams?.toString());
      if (!params.get('days')) params.set('days', String(rangeDays));
      const res = await fetch(`/api/reports/pdf?${params.toString()}`, {
        method: 'GET',
      });
      if (!res.ok) {
        const text = await res.text();
        showToast('error', text || 'Erro ao gerar PDF.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio-${new Date().toISOString().slice(0, 10)}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      showToast('success', 'PDF gerado com sucesso.');
    } catch {
      showToast('error', 'Não foi possível gerar o PDF.');
    }
  };

  const openPrint = () => {
    void auditReportAction('PRINT');
    window.print();
  };

  const currentDays = searchParams?.get('days') || String(rangeDays);
  const q = searchParams?.get('q') || '';
  const status = searchParams?.get('status') || '';
  const area = searchParams?.get('area') || '';
  const responsible = searchParams?.get('responsible') || '';
  const deadlineType = searchParams?.get('deadlineType') || '';
  const compare = (searchParams?.get('compare') || '1') !== '0';

  return (
    <>
      {toast ? (
        <div
          className={`${styles.reportToast} ${
            toast.tone === 'error' ? styles.reportToastError : styles.reportToastSuccess
          }`}
          role="status"
          aria-live="polite"
        >
          <div className={styles.reportToastTitle}>
            {toast.tone === 'error' ? 'Não foi possível concluir' : 'Concluído'}
          </div>
          <div className={styles.reportToastMessage}>{toast.message}</div>
        </div>
      ) : null}
      <div className={`${styles.actions} ${styles.noPrint}`}>
        <div className={styles.actionFiltersMain}>
          <div className={`${styles.toolbarFieldSm} ${styles.toolbarFieldPeriod}`}>
            <div className={styles.rangeGroup}>
              <span className={styles.rangeLabel}>Período</span>
              <UISelect
                className={styles.rangeSelect}
                value={currentDays}
                ariaLabel="Período"
                onChange={handleRangeChange}
                options={[
                  { value: '7', label: 'Últimos 7 dias' },
                  { value: '14', label: 'Últimos 14 dias' },
                  { value: '30', label: 'Últimos 30 dias' },
                  { value: '90', label: 'Últimos 90 dias' },
                ]}
              />
            </div>
          </div>
          <div className={styles.toolbarFieldGrow}>
            <input
              className={styles.filterInput}
              value={q}
              onChange={(event) => updateParam('q', event.target.value)}
              placeholder="Buscar cliente, caso, tarefa..."
            />
          </div>
          <div className={`${styles.toolbarFieldSm} ${styles.toolbarFieldStatus}`}>
            <UISelect
              className={styles.rangeSelect}
              value={status}
              ariaLabel="Status"
              onChange={(value) => updateParam('status', value)}
              options={[
                { value: '', label: 'Status' },
                ...statusOptions.map((raw) => ({ value: raw, label: formatStatus(raw) })),
              ]}
            />
          </div>
          <div className={`${styles.toolbarFieldSm} ${styles.toolbarFieldArea}`}>
            <UISelect
              className={styles.rangeSelect}
              value={area}
              ariaLabel="Área"
              onChange={(value) => updateParam('area', value)}
              options={[
                { value: '', label: 'Área' },
                ...areaGroups.map(([label]) => ({ value: label, label })),
              ]}
            />
          </div>
          <div className={`${styles.toolbarFieldSm} ${styles.toolbarFieldResponsible}`}>
            <UISelect
              className={styles.rangeSelect}
              value={responsible}
              ariaLabel="Responsável"
              onChange={(value) => updateParam('responsible', value)}
              options={[
                { value: '', label: 'Responsável' },
                ...responsibleOptions.map((item) => ({ value: item.id, label: item.name })),
              ]}
            />
          </div>
          <div className={`${styles.toolbarFieldSm} ${styles.toolbarFieldDeadlineType}`}>
            <UISelect
              className={styles.rangeSelect}
              value={deadlineType}
              ariaLabel="Tipo de prazo"
              onChange={(value) => updateParam('deadlineType', value)}
              options={[
                { value: '', label: 'Tipo de prazo' },
                ...deadlineTypes.map((item) => ({ value: item, label: item })),
              ]}
            />
          </div>
        </div>

        <div className={styles.actionFooterBar}>
          <label className={styles.compareToggle}>
            <input
              type="checkbox"
              checked={compare}
              onChange={(event) => updateParam('compare', event.target.checked ? '1' : '0')}
            />
            Comparar com período anterior
          </label>

          <div className={styles.exportGroup}>
            <UIButton type="button" variant="ghost" size="sm" onClick={exportCsv}>
              Exportar CSV
            </UIButton>
            <UIButton type="button" variant="primary" size="sm" onClick={exportPdfServer}>
              Exportar PDF
            </UIButton>
            <UIButton type="button" variant="ghost" size="sm" onClick={openPrint}>
              Imprimir
            </UIButton>
          </div>
        </div>
      </div>
    </>
  );
}

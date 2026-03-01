import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { AuditService } from '../audit/audit.service';
import PDFDocument from 'pdfkit';

type Matter = {
  id: string;
  title: string;
  area: string | null;
  status: string;
  createdAt: Date;
  client?: { name: string | null } | null;
};

type DashboardData = {
  counts: {
    openMatters: number;
    openTasks: number;
    pendingDeadlines: number;
  };
  upcomingDeadlines: Array<{
    title: string;
    dueDate: Date | string;
    matter: { title: string };
  }>;
  openTasks: Array<{
    title: string;
    dueDate: Date | string | null;
    status?: string;
    priority?: string;
    assignedTo?: { id: string; name: string } | null;
    matter?: { title: string } | null;
  }>;
};

type ReportFilters = {
  q?: string;
  status?: string;
  area?: string;
  responsible?: string;
  deadlineType?: string;
};

type ReportData = {
  matters: Matter[];
  dashboard: DashboardData;
  rangeDays: number;
  filters: {
    q: string;
    status: string;
    area: string;
    responsible: string;
    deadlineType: string;
  };
  comparison: {
    current: {
      mattersCreated: number;
      tasksCreated: number;
      deadlinesCreated: number;
    };
    previous: {
      mattersCreated: number;
      tasksCreated: number;
      deadlinesCreated: number;
    };
  };
  goals: {
    deadlineOnTimeTarget: number;
    deadlineOnTimeCurrent: number;
    taskBacklogTarget: number;
    taskBacklogCurrent: number;
  };
  indicators: {
    averageMatterAgeDays: number;
    completionByResponsible: Array<{
      responsibleId: string;
      responsible: string;
      completionRate: number;
      done: number;
      total: number;
    }>;
    backlogByResponsible: Array<{
      responsibleId: string;
      responsible: string;
      backlog: number;
    }>;
  };
  alerts: {
    highRiskDeadlines: number;
    highRiskTasks: number;
    totalHighRisk: number;
  };
  historicalSeries: Array<{
    date: string;
    openMatters: number;
    openTasks: number;
    pendingDeadlines: number;
  }>;
};

function formatDateBR(date: Date) {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function formatStatus(status: string) {
  switch (status) {
    case 'OPEN':
      return 'Aberto';
    case 'CLOSED':
      return 'Encerrado';
    case 'DOING':
      return 'Em andamento';
    case 'DONE':
      return 'Concluído';
    case 'PENDING':
      return 'Pendente';
    default:
      return status;
  }
}

function startOfWeekUTC(date: Date) {
  const day = date.getUTCDay();
  const diff = (day + 6) % 7;
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() - diff,
    ),
  );
}

function startOfDayUTC(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function addDaysUTC(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function endOfDayUTC(date: Date) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

function weeklySeries(matters: Matter[], rangeDays: number) {
  const today = startOfDayUTC(new Date());
  const start = addDaysUTC(today, -(rangeDays - 1));
  const firstWeek = startOfWeekUTC(start);
  const weeks: Date[] = [];
  for (let d = firstWeek; d <= today; d = addDaysUTC(d, 7)) {
    weeks.push(d);
  }

  const map = new Map<string, number>();
  for (const week of weeks) {
    map.set(week.toISOString().slice(0, 10), 0);
  }

  for (const matter of matters) {
    const createdAt = matter.createdAt;
    if (createdAt < start || createdAt > today) continue;
    const key = startOfWeekUTC(createdAt).toISOString().slice(0, 10);
    map.set(key, (map.get(key) || 0) + 1);
  }

  return weeks.map((week) => ({
    label: formatDateBR(week),
    count: map.get(week.toISOString().slice(0, 10)) || 0,
  }));
}

function groupBy(items: Matter[], keyFn: (item: Matter) => string) {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item) || 'Outros';
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

@Injectable()
export class ReportsService {
  private readonly cache = new Map<
    string,
    { expiresAt: number; data: ReportData }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: DashboardService,
    private readonly audit: AuditService,
  ) {}

  private normalizeFilterValue(value?: string) {
    const trimmed = String(value || '').trim();
    return trimmed && trimmed.toLowerCase() !== 'all' ? trimmed : '';
  }

  async logReportAction(
    tenantId: string,
    userId: string,
    action: 'REPORT_EXPORTED_CSV' | 'REPORT_EXPORTED_PDF' | 'REPORT_PRINTED',
    input: {
      days?: number;
      q?: string;
      status?: string;
      area?: string;
      responsible?: string;
      deadlineType?: string;
    },
  ) {
    await this.audit.log(tenantId, action, userId, undefined, {
      days: Number.isFinite(input.days) ? Number(input.days) : null,
      q: this.normalizeFilterValue(input.q),
      status: this.normalizeFilterValue(input.status),
      area: this.normalizeFilterValue(input.area),
      responsible: this.normalizeFilterValue(input.responsible),
      deadlineType: this.normalizeFilterValue(input.deadlineType),
    });
    return { ok: true };
  }

  private includesText(values: Array<string | null | undefined>, q: string) {
    if (!q) return true;
    const needle = q.toLowerCase();
    return values.some((value) =>
      String(value || '')
        .toLowerCase()
        .includes(needle),
    );
  }

  private cacheKey(
    tenantId: string,
    rangeDays: number,
    filters: ReportFilters,
  ) {
    return JSON.stringify({
      tenantId,
      rangeDays,
      q: this.normalizeFilterValue(filters.q),
      status: this.normalizeFilterValue(filters.status),
      area: this.normalizeFilterValue(filters.area),
      responsible: this.normalizeFilterValue(filters.responsible),
      deadlineType: this.normalizeFilterValue(filters.deadlineType),
    });
  }

  async getData(
    tenantId: string,
    days: number,
    filters: ReportFilters = {},
  ): Promise<ReportData> {
    const rangeDays =
      Number.isFinite(days) && days > 0 ? Math.min(days, 90) : 14;
    const normalizedFilters = {
      q: this.normalizeFilterValue(filters.q),
      status: this.normalizeFilterValue(filters.status),
      area: this.normalizeFilterValue(filters.area),
      responsible: this.normalizeFilterValue(filters.responsible),
      deadlineType: this.normalizeFilterValue(filters.deadlineType),
    };
    const cacheKey = this.cacheKey(tenantId, rangeDays, normalizedFilters);
    const nowTs = Date.now();
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > nowTs) {
      return cached.data;
    }

    const now = new Date();
    const todayStart = startOfDayUTC(now);
    const currentStart = addDaysUTC(todayStart, -(rangeDays - 1));
    const previousEnd = addDaysUTC(currentStart, -1);
    const previousStart = addDaysUTC(previousEnd, -(rangeDays - 1));

    const [matters, dashboard] = await Promise.all([
      this.prisma.matter.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        include: {
          client: {
            select: { name: true },
          },
        },
      }),
      this.dashboard.getDashboard(tenantId, rangeDays),
    ]);

    const filteredMatters = matters.filter((matter) => {
      if (
        normalizedFilters.area &&
        (matter.area || 'Não informado') !== normalizedFilters.area
      ) {
        return false;
      }
      if (
        normalizedFilters.status &&
        matter.status.toUpperCase() !== normalizedFilters.status.toUpperCase()
      ) {
        return false;
      }
      return this.includesText(
        [
          matter.title,
          matter.area,
          matter.status,
          matter.client?.name,
          formatStatus(matter.status),
        ],
        normalizedFilters.q,
      );
    });

    const filteredOpenTasks = dashboard.openTasks.filter((task) => {
      if (
        normalizedFilters.responsible &&
        task.assignedTo?.id !== normalizedFilters.responsible
      ) {
        return false;
      }
      if (normalizedFilters.area || normalizedFilters.status) {
        const relatedMatter = task.matter;
        if (
          normalizedFilters.area &&
          (relatedMatter?.area || 'Não informado') !== normalizedFilters.area
        ) {
          return false;
        }
        if (
          normalizedFilters.status &&
          String(relatedMatter?.status || '').toUpperCase() !==
            normalizedFilters.status.toUpperCase()
        ) {
          return false;
        }
      }
      return this.includesText(
        [
          task.title,
          task.status,
          task.priority,
          task.assignedTo?.name,
          task.matter?.title,
          task.matter?.area,
        ],
        normalizedFilters.q,
      );
    });

    const filteredDeadlines = dashboard.upcomingDeadlines.filter((deadline) => {
      if (
        normalizedFilters.deadlineType &&
        String(deadline.type || '').toUpperCase() !==
          normalizedFilters.deadlineType.toUpperCase()
      ) {
        return false;
      }
      if (normalizedFilters.area || normalizedFilters.status) {
        const relatedMatter = deadline.matter;
        if (
          normalizedFilters.area &&
          (relatedMatter?.area || 'Não informado') !== normalizedFilters.area
        ) {
          return false;
        }
        if (
          normalizedFilters.status &&
          String(relatedMatter?.status || '').toUpperCase() !==
            normalizedFilters.status.toUpperCase()
        ) {
          return false;
        }
      }
      return this.includesText(
        [
          deadline.title,
          deadline.type,
          deadline.matter?.title,
          deadline.matter?.area,
        ],
        normalizedFilters.q,
      );
    });

    const [
      currentMattersCreated,
      previousMattersCreated,
      currentTasksCreated,
      previousTasksCreated,
      currentDeadlinesCreated,
      previousDeadlinesCreated,
    ] = await this.prisma.$transaction([
      this.prisma.matter.count({
        where: {
          tenantId,
          createdAt: { gte: currentStart, lte: now },
        },
      }),
      this.prisma.matter.count({
        where: {
          tenantId,
          createdAt: { gte: previousStart, lte: previousEnd },
        },
      }),
      this.prisma.task.count({
        where: {
          tenantId,
          createdAt: { gte: currentStart, lte: now },
        },
      }),
      this.prisma.task.count({
        where: {
          tenantId,
          createdAt: { gte: previousStart, lte: previousEnd },
        },
      }),
      this.prisma.deadline.count({
        where: {
          tenantId,
          createdAt: { gte: currentStart, lte: now },
        },
      }),
      this.prisma.deadline.count({
        where: {
          tenantId,
          createdAt: { gte: previousStart, lte: previousEnd },
        },
      }),
    ]);

    const historicalLogs = await this.prisma.auditLog.findMany({
      where: {
        tenantId,
        action: 'REPORT_SNAPSHOT_DAILY',
        createdAt: { gte: addDaysUTC(todayStart, -90) },
      },
      orderBy: { createdAt: 'asc' },
      take: 120,
    });

    const todayEnd = endOfDayUTC(now);
    const hasTodaySnapshot = historicalLogs.some(
      (log) => log.createdAt >= todayStart && log.createdAt <= todayEnd,
    );
    if (!hasTodaySnapshot) {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          action: 'REPORT_SNAPSHOT_DAILY',
          metaJson: JSON.stringify({
            date: todayStart.toISOString(),
            counts: dashboard.counts,
            rangeDays,
          }),
        },
      });
      historicalLogs.push({
        id: 'current',
        tenantId,
        matterId: null,
        userId: null,
        action: 'REPORT_SNAPSHOT_DAILY',
        metaJson: JSON.stringify({
          date: todayStart.toISOString(),
          counts: dashboard.counts,
          rangeDays,
        }),
        prevHash: null,
        hash: null,
        createdAt: now,
      });
    }

    const historicalSeries = historicalLogs
      .map((log) => {
        if (!log.metaJson) return null;
        try {
          const meta = JSON.parse(log.metaJson) as {
            date?: string;
            counts?: {
              openMatters?: number;
              openTasks?: number;
              pendingDeadlines?: number;
            };
          };
          if (!meta?.date || !meta?.counts) return null;
          return {
            date: meta.date,
            openMatters: Number(meta.counts.openMatters || 0),
            openTasks: Number(meta.counts.openTasks || 0),
            pendingDeadlines: Number(meta.counts.pendingDeadlines || 0),
          };
        } catch {
          return null;
        }
      })
      .filter(
        (
          row,
        ): row is {
          date: string;
          openMatters: number;
          openTasks: number;
          pendingDeadlines: number;
        } => Boolean(row),
      )
      .slice(-14);

    const openMatters = filteredMatters.filter(
      (matter) => String(matter.status).toUpperCase() === 'OPEN',
    );
    const averageMatterAgeDays = openMatters.length
      ? Math.round(
          openMatters.reduce((sum, matter) => {
            const diff = now.getTime() - new Date(matter.createdAt).getTime();
            return sum + Math.max(0, diff / (1000 * 60 * 60 * 24));
          }, 0) / openMatters.length,
        )
      : 0;

    const recentTasks = await this.prisma.task.findMany({
      where: {
        tenantId,
        createdAt: { gte: currentStart, lte: now },
      },
      select: {
        status: true,
        dueDate: true,
        assignedTo: { select: { id: true, name: true } },
      },
    });

    const completionByResponsibleMap = new Map<
      string,
      {
        responsibleId: string;
        responsible: string;
        done: number;
        total: number;
      }
    >();
    for (const task of recentTasks) {
      const responsibleId = task.assignedTo?.id || 'UNASSIGNED';
      const responsible = task.assignedTo?.name || 'Não atribuído';
      const entry = completionByResponsibleMap.get(responsibleId) || {
        responsibleId,
        responsible,
        done: 0,
        total: 0,
      };
      entry.total += 1;
      if (String(task.status).toUpperCase() === 'DONE') entry.done += 1;
      completionByResponsibleMap.set(responsibleId, entry);
    }

    const completionByResponsible = Array.from(
      completionByResponsibleMap.values(),
    )
      .map((item) => ({
        responsibleId: item.responsibleId,
        responsible: item.responsible,
        completionRate:
          item.total > 0 ? Math.round((item.done / item.total) * 100) : 0,
        done: item.done,
        total: item.total,
      }))
      .sort((a, b) => b.completionRate - a.completionRate)
      .slice(0, 8);

    const backlogByResponsible = Array.from(
      filteredOpenTasks
        .reduce((acc, task) => {
          const key = task.assignedTo?.id || 'UNASSIGNED';
          const prev = acc.get(key) || {
            responsibleId: key,
            responsible: task.assignedTo?.name || 'Não atribuído',
            backlog: 0,
          };
          prev.backlog += 1;
          acc.set(key, prev);
          return acc;
        }, new Map<string, { responsibleId: string; responsible: string; backlog: number }>())
        .values(),
    )
      .sort((a, b) => b.backlog - a.backlog)
      .slice(0, 8);

    const dueDeadlinesInPeriod = await this.prisma.deadline.findMany({
      where: {
        tenantId,
        dueDate: { gte: currentStart, lte: now },
      },
      select: { isDone: true },
    });
    const deadlineOnTimeCurrent = dueDeadlinesInPeriod.length
      ? Math.round(
          (dueDeadlinesInPeriod.filter((item) => item.isDone).length /
            dueDeadlinesInPeriod.length) *
            100,
        )
      : 100;

    const highRiskDeadlines = filteredDeadlines.filter((deadline) => {
      const diffDays = Math.ceil(
        (new Date(deadline.dueDate).getTime() - todayStart.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      return diffDays <= 2;
    }).length;
    const highRiskTasks = filteredOpenTasks.filter((task) => {
      if (!task.dueDate) return false;
      const diffDays = Math.ceil(
        (new Date(task.dueDate).getTime() - todayStart.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      return (
        diffDays <= 2 || String(task.priority || '').toUpperCase() === 'HIGH'
      );
    }).length;

    const filteredDashboard = {
      ...dashboard,
      counts: {
        openMatters: openMatters.length,
        openTasks: filteredOpenTasks.length,
        pendingDeadlines: filteredDeadlines.length,
      },
      upcomingDeadlines: filteredDeadlines,
      openTasks: filteredOpenTasks,
    };

    const payload: ReportData = {
      matters,
      dashboard: filteredDashboard,
      rangeDays,
      filters: normalizedFilters,
      comparison: {
        current: {
          mattersCreated: currentMattersCreated,
          tasksCreated: currentTasksCreated,
          deadlinesCreated: currentDeadlinesCreated,
        },
        previous: {
          mattersCreated: previousMattersCreated,
          tasksCreated: previousTasksCreated,
          deadlinesCreated: previousDeadlinesCreated,
        },
      },
      goals: {
        deadlineOnTimeTarget: 95,
        deadlineOnTimeCurrent,
        taskBacklogTarget: 8,
        taskBacklogCurrent: filteredOpenTasks.length,
      },
      indicators: {
        averageMatterAgeDays,
        completionByResponsible,
        backlogByResponsible,
      },
      alerts: {
        highRiskDeadlines,
        highRiskTasks,
        totalHighRisk: highRiskDeadlines + highRiskTasks,
      },
      historicalSeries,
    };
    this.cache.set(cacheKey, {
      expiresAt: nowTs + 60_000,
      data: payload,
    });
    return payload;
  }

  buildPdf(report: ReportData, generatedByEmail?: string) {
    const {
      matters,
      dashboard,
      rangeDays,
      goals,
      indicators,
      alerts,
      historicalSeries,
    } = report;
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const now = new Date();
    const generatedAt = formatDateBR(now);
    const pageWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const left = doc.page.margins.left;
    const right = left + pageWidth;

    const palette = {
      bgSoft: '#F6F8FC',
      bgCard: '#EFF3FA',
      bgCardAlt: '#F4F7FD',
      textPrimary: '#0F172A',
      textSecondary: '#475569',
      textMuted: '#64748B',
      border: '#D8E1F0',
      accent: '#2563EB',
      success: '#059669',
      warning: '#D97706',
      danger: '#DC2626',
    } as const;

    const ensureSpace = (height: number) => {
      if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
      }
    };

    doc.info.Title = 'Relatório LexFlow';

    const generatedBy = String(generatedByEmail || '').trim();
    const periodMeta = `LexFlow · período de ${rangeDays} dias`;
    const generatedMeta = `Relatório gerado em ${generatedAt}`;
    const generatedByMeta = generatedBy ? `Gerado por: ${generatedBy}` : '';

    const drawHeader = () => {
      const h = generatedByMeta ? 92 : 78;
      const y = doc.y;
      doc
        .save()
        .roundedRect(left, y, pageWidth, h, 8)
        .fillColor('#EAF0FF')
        .fill();
      doc.roundedRect(left, y, 8, h, 8).fillColor(palette.accent).fill();
      doc.restore();

      doc
        .fillColor(palette.textPrimary)
        .font('Helvetica-Bold')
        .fontSize(20)
        .text('Relatório executivo', left + 20, y + 14, {
          width: pageWidth - 30,
        });
      doc
        .fillColor(palette.textSecondary)
        .font('Helvetica')
        .fontSize(10)
        .text(periodMeta, left + 20, y + 44, { width: pageWidth - 30 });
      doc
        .fillColor(palette.textSecondary)
        .font('Helvetica')
        .fontSize(10)
        .text(generatedMeta, left + 20, y + 58, { width: pageWidth - 30 });
      if (generatedByMeta) {
        doc
          .fillColor(palette.textSecondary)
          .font('Helvetica')
          .fontSize(10)
          .text(generatedByMeta, left + 20, y + 72, { width: pageWidth - 30 });
      }
      doc.y = y + h + 16;
    };

    const sectionTitle = (
      title: string,
      subtitle?: string,
      minBodyHeight = 0,
    ) => {
      ensureSpace((subtitle ? 38 : 26) + Math.max(0, minBodyHeight));
      doc.x = left;
      doc
        .fillColor(palette.textPrimary)
        .font('Helvetica-Bold')
        .fontSize(12)
        .text(title, left, doc.y, { width: pageWidth, align: 'left' });
      if (subtitle) {
        doc.x = left;
        doc
          .fillColor(palette.textSecondary)
          .font('Helvetica')
          .fontSize(9)
          .text(subtitle, left, doc.y, { width: pageWidth, align: 'left' });
      }
      doc.moveDown(0.4);
    };

    const drawCard = (
      x: number,
      y: number,
      w: number,
      h: number,
      title: string,
      value: string,
      subtitle: string,
      accent: string,
    ) => {
      doc
        .save()
        .roundedRect(x, y, w, h, 8)
        .fillColor(palette.bgCard)
        .fill()
        .lineWidth(1)
        .strokeColor(palette.border)
        .roundedRect(x, y, w, h, 8)
        .stroke()
        .roundedRect(x, y, 5, h, 8)
        .fillColor(accent)
        .fill();
      doc.restore();

      doc
        .fillColor(palette.textMuted)
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(title.toUpperCase(), x + 14, y + 10, { width: w - 20 });
      doc
        .fillColor(palette.textPrimary)
        .font('Helvetica-Bold')
        .fontSize(20)
        .text(value, x + 14, y + 24, { width: w - 20 });
      doc
        .fillColor(palette.textSecondary)
        .font('Helvetica')
        .fontSize(9)
        .text(subtitle, x + 14, y + 50, { width: w - 20 });
    };

    const drawMetricRows = (
      title: string,
      items: Array<{
        label: string;
        value: string;
        tone?: 'normal' | 'success' | 'warning' | 'danger';
      }>,
    ) => {
      const rowH = 24;
      const blockH = items.length * rowH + 14;
      const requiredHeight = 46 + blockH + 12;
      ensureSpace(requiredHeight);
      sectionTitle(title);
      const blockY = doc.y;
      doc
        .roundedRect(left, blockY, pageWidth, blockH, 8)
        .fillColor(palette.bgSoft)
        .fill()
        .lineWidth(1)
        .strokeColor(palette.border)
        .roundedRect(left, blockY, pageWidth, blockH, 8)
        .stroke();

      let rowY = blockY + 7;
      items.forEach((item, index) => {
        if (index % 2 === 1) {
          doc
            .rect(left + 1, rowY - 1, pageWidth - 2, rowH)
            .fillColor(palette.bgCardAlt)
            .fill();
        }
        doc
          .fillColor(palette.textPrimary)
          .font('Helvetica')
          .fontSize(10)
          .text(item.label, left + 12, rowY + 6, { width: pageWidth - 160 });
        const toneColor =
          item.tone === 'success'
            ? palette.success
            : item.tone === 'warning'
              ? palette.warning
              : item.tone === 'danger'
                ? palette.danger
                : palette.textPrimary;
        doc
          .fillColor(toneColor)
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(item.value, right - 130, rowY + 6, {
            width: 118,
            align: 'right',
          });
        rowY += rowH;
      });
      doc.y = blockY + blockH + 12;
    };

    const drawTwoColumnBlock = (
      title: string,
      rows: Array<{ label: string; value: string }>,
      emptyMessage: string,
    ) => {
      const safeRows =
        rows.length > 0 ? rows : [{ label: emptyMessage, value: '-' }];
      const valueColW = 140;
      const labelColW = pageWidth - valueColW - 22;

      const measuredRows = safeRows.map((row) => {
        const labelH = doc.heightOfString(row.label, {
          width: labelColW,
          align: 'left',
        });
        const valueH = doc.heightOfString(row.value, {
          width: valueColW - 8,
          align: 'right',
        });
        const rowH = Math.max(20, Math.max(labelH, valueH) + 8);
        return { ...row, rowH };
      });

      const blockH = measuredRows.reduce((sum, row) => sum + row.rowH, 0) + 14;
      sectionTitle(title, undefined, blockH + 8);
      const blockY = doc.y;

      doc
        .roundedRect(left, blockY, pageWidth, blockH, 8)
        .fillColor(palette.bgSoft)
        .fill()
        .lineWidth(1)
        .strokeColor(palette.border)
        .roundedRect(left, blockY, pageWidth, blockH, 8)
        .stroke();

      let rowY = blockY + 7;
      measuredRows.forEach((row, index) => {
        if (index % 2 === 0) {
          doc
            .roundedRect(left + 1, rowY - 1, pageWidth - 2, row.rowH, 4)
            .fillColor(palette.bgCardAlt)
            .fill();
        }
        doc
          .fillColor(palette.textPrimary)
          .font('Helvetica')
          .fontSize(10)
          .text(row.label, left + 8, rowY + 3, {
            width: labelColW,
            align: 'left',
          });
        doc
          .fillColor(palette.textSecondary)
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(row.value, right - valueColW, rowY + 3, {
            width: valueColW - 8,
            align: 'right',
          });
        rowY += row.rowH;
      });

      doc.y = blockY + blockH + 12;
    };

    const dueLabel = (dateValue: Date | string | null | undefined) => {
      if (!dateValue) return 'Sem prazo';
      const due = new Date(dateValue);
      const today = startOfDayUTC(new Date());
      const prefix = due.getTime() < today.getTime() ? 'Venceu' : 'Vence';
      return `${prefix} ${formatDateBR(due)}`;
    };

    drawHeader();

    sectionTitle(
      'KPIs principais',
      'Visão consolidada dos indicadores do período',
    );
    ensureSpace(170);
    const cardGap = 10;
    const cardW = (pageWidth - cardGap) / 2;
    const cardH = 70;
    const kpiY = doc.y;
    const productivity = matters.length
      ? Math.round(
          (matters.filter((m) => String(m.status).toUpperCase() === 'CLOSED')
            .length /
            matters.length) *
            100,
        )
      : 0;
    drawCard(
      left,
      kpiY,
      cardW,
      cardH,
      'Casos em aberto',
      String(dashboard.counts.openMatters),
      'Total monitorado no período',
      palette.accent,
    );
    drawCard(
      left + cardW + cardGap,
      kpiY,
      cardW,
      cardH,
      'Tarefas em aberto',
      String(dashboard.counts.openTasks),
      'Backlog operacional atual',
      '#0EA5E9',
    );
    drawCard(
      left,
      kpiY + cardH + cardGap,
      cardW,
      cardH,
      'Prazos pendentes',
      String(dashboard.counts.pendingDeadlines),
      'Vencimentos em acompanhamento',
      palette.warning,
    );
    drawCard(
      left + cardW + cardGap,
      kpiY + cardH + cardGap,
      cardW,
      cardH,
      'Produtividade',
      `${productivity}%`,
      'Casos encerrados sobre o total',
      palette.success,
    );
    doc.y = kpiY + cardH * 2 + cardGap + 16;

    const statusGroups = groupBy(matters, (m) => m.status);
    const areaGroups = groupBy(matters, (m) => m.area || 'Não informado');
    const weekly = weeklySeries(matters, rangeDays);

    drawMetricRows('Metas e SLA', [
      {
        label: 'Prazos cumpridos',
        value: `${goals.deadlineOnTimeCurrent}% (meta ${goals.deadlineOnTimeTarget}%)`,
        tone:
          goals.deadlineOnTimeCurrent >= goals.deadlineOnTimeTarget
            ? 'success'
            : 'warning',
      },
      {
        label: 'Backlog de tarefas',
        value: `${goals.taskBacklogCurrent} (meta <= ${goals.taskBacklogTarget})`,
        tone:
          goals.taskBacklogCurrent <= goals.taskBacklogTarget
            ? 'success'
            : 'warning',
      },
      {
        label: 'Idade média dos casos',
        value: `${indicators.averageMatterAgeDays} dia(s)`,
      },
    ]);

    drawMetricRows('Alertas inteligentes', [
      {
        label: 'Prazos de alto risco (<=2 dias)',
        value: String(alerts.highRiskDeadlines),
        tone: alerts.highRiskDeadlines > 0 ? 'warning' : 'success',
      },
      {
        label: 'Tarefas críticas',
        value: String(alerts.highRiskTasks),
        tone: alerts.highRiskTasks > 0 ? 'warning' : 'success',
      },
      {
        label: 'Risco total',
        value: String(alerts.totalHighRisk),
        tone: alerts.totalHighRisk > 0 ? 'danger' : 'success',
      },
    ]);

    drawMetricRows(
      'Casos por status',
      statusGroups.length
        ? statusGroups.map(([label, count]) => ({
            label: formatStatus(label),
            value: String(count),
          }))
        : [{ label: 'Sem dados', value: '0' }],
    );

    drawMetricRows(
      'Casos por área',
      areaGroups.length
        ? areaGroups.map(([label, count]) => ({
            label,
            value: String(count),
          }))
        : [{ label: 'Sem dados', value: '0' }],
    );

    sectionTitle('Casos criados por semana', undefined, 160);

    const chartX = doc.page.margins.left;
    const chartY = doc.y;
    const chartW = pageWidth;
    const chartH = 120;
    const maxWeekly = Math.max(1, ...weekly.map((w) => w.count));

    doc
      .roundedRect(chartX, chartY, chartW, chartH, 8)
      .fillColor(palette.bgSoft)
      .fill()
      .lineWidth(1)
      .strokeColor(palette.border)
      .roundedRect(chartX, chartY, chartW, chartH, 8)
      .stroke();

    const points = weekly.map((item, index) => {
      const x =
        chartX + 14 + (index / Math.max(1, weekly.length - 1)) * (chartW - 28);
      const y = chartY + chartH - 14 - (item.count / maxWeekly) * (chartH - 28);
      return { x, y };
    });

    if (points.length > 0) {
      doc.moveTo(points[0].x, points[0].y);
      points.slice(1).forEach((pt) => doc.lineTo(pt.x, pt.y));
      doc.strokeColor(palette.accent).lineWidth(2).stroke();
      points.forEach((pt) => {
        doc.circle(pt.x, pt.y, 2.5).fill(palette.accent);
      });
    }

    doc.y = chartY + chartH + 10;
    doc.font('Helvetica').fontSize(9).fillColor(palette.textSecondary);
    weekly.forEach((w) =>
      doc.text(`${w.label}: ${w.count}`, { continued: false }),
    );
    doc.moveDown(0.6);

    const historyRows = [...historicalSeries]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
      .map((item) => ({
        label: formatDateBR(new Date(item.date)),
        value: String(item.openTasks),
      }));
    historyRows.unshift({
      label: 'Agora (tempo real)',
      value: String(dashboard.counts.openTasks),
    });
    drawMetricRows(
      'Histórico (snapshot diário + agora)',
      historyRows.map((item, index) => ({
        label: item.label,
        value: item.value,
        tone: index === 0 ? 'success' : 'normal',
      })),
    );

    const sortedDeadlines = [...dashboard.upcomingDeadlines].sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    );
    drawTwoColumnBlock(
      `Prazos próximos (${rangeDays} dias)`,
      sortedDeadlines.slice(0, 10).map((d) => ({
        label: `${d.title} · ${d.matter.title}`,
        value: dueLabel(d.dueDate),
      })),
      'Nenhum prazo pendente.',
    );

    const sortedTasks = [...dashboard.openTasks].sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
    drawTwoColumnBlock(
      'Tarefas abertas',
      sortedTasks.slice(0, 10).map((t) => ({
        label: `${t.title} · ${t.matter?.title || 'Sem caso'} · ${
          t.assignedTo?.name || 'Não atribuído'
        }`,
        value: dueLabel(t.dueDate),
      })),
      'Nenhuma tarefa em aberto.',
    );

    drawMetricRows(
      'Indicadores por responsável',
      indicators.completionByResponsible.length
        ? indicators.completionByResponsible.map((item) => ({
            label: item.responsible,
            value: `${item.completionRate}% (${item.done}/${item.total})`,
          }))
        : [{ label: 'Sem dados no período', value: '-' }],
    );

    drawMetricRows(
      'Backlog por responsável',
      indicators.backlogByResponsible.length
        ? indicators.backlogByResponsible.map((item) => ({
            label: item.responsible,
            value: String(item.backlog),
          }))
        : [{ label: 'Sem backlog', value: '-' }],
    );

    doc.moveDown(1.2);
    doc.font('Helvetica').fontSize(9).fillColor(palette.textMuted);
    doc.text(`LexFlow · ${generatedMeta}`, { align: 'center' });
    if (generatedByMeta) {
      doc.text(generatedByMeta, { align: 'center' });
    }

    return doc;
  }
}

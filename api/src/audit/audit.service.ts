import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getRequestContext } from '../common/request-context';
import { createHash } from 'node:crypto';
import PDFDocument = require('pdfkit');
import {
  formatAuditActionLabel,
  formatAuditMetaEntries,
} from './audit-i18n.util';

type AuditViewerContext = {
  isPlatformAdminViewer?: boolean;
};

type AuditListParams = {
  limit?: number;
  page?: number;
  q?: string;
  action?: string;
  routine?: string;
  userId?: string;
  from?: string;
  to?: string;
  systemOnly?: boolean;
};

type AuditCsvRow = {
  createdAt: Date;
  action: string;
  detail?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  personName?: string | null;
  matterTitle?: string | null;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly adminOnlyActions = [
    'PLATFORM_ADMIN_PROMOTED',
    'PLATFORM_ADMIN_DEMOTED',
    'TENANT_CREATED',
    'TENANT_RENAMED',
    'TENANT_STATUS_UPDATED',
    'TENANT_SWITCHED',
  ] as const;

  private visibilityWhere(ctx?: AuditViewerContext) {
    if (ctx?.isPlatformAdminViewer) return {};
    return {
      action: { notIn: [...this.adminOnlyActions] },
      OR: [
        { user: { is: null } },
        { user: { is: { isPlatformAdmin: false } } },
      ],
    };
  }

  private buildDateWhere(from?: string, to?: string) {
    const createdAt: { gte?: Date; lte?: Date } = {};
    if (from) {
      const fromDate = new Date(`${from}T00:00:00`);
      if (!Number.isNaN(fromDate.getTime())) createdAt.gte = fromDate;
    }
    if (to) {
      const toDate = new Date(`${to}T23:59:59.999`);
      if (!Number.isNaN(toDate.getTime())) createdAt.lte = toDate;
    }
    return Object.keys(createdAt).length ? createdAt : undefined;
  }

  private pagination(input?: AuditListParams) {
    const pageSize = Number.isFinite(input?.limit)
      ? Math.min(Math.max(1, Number(input?.limit || 20)), 100)
      : 20;
    const page = Number.isFinite(input?.page)
      ? Math.max(1, Number(input?.page || 1))
      : 1;
    const skip = (page - 1) * pageSize;
    return { pageSize, page, skip };
  }

  private routineActionWhere(routine?: string) {
    const value = String(routine || '')
      .trim()
      .toLowerCase();
    if (!value || value === 'todas') return undefined;

    const startsWithMap: Record<string, string[]> = {
      casos: ['MATTER_', 'DOCUMENT_', 'TASK_', 'DEADLINE_'],
      pessoas: ['CLIENT_'],
      atendimento: ['APPOINTMENT_'],
      agenda: ['AGENDA_VIEW_'],
      financeiro: ['FINANCE_'],
      relatorios: ['REPORT_'],
      relatórios: ['REPORT_'],
      equipe: ['TENANT_MEMBER_', 'TENANT_INVITE_', 'TEAM_ACCESS_GROUP_'],
      notificacoes: ['NOTIFICATION_'],
      notificações: ['NOTIFICATION_'],
      auditoria: ['AUDIT_'],
      escritorios: ['TENANT_', 'PLATFORM_ADMIN_'],
      escritórios: ['TENANT_', 'PLATFORM_ADMIN_'],
    };

    const prefixes = startsWithMap[value];
    if (!prefixes) return undefined;
    if (!prefixes.length) return { action: { in: ['__NO_AUDIT_ACTION__'] } };
    return {
      OR: prefixes.map((prefix) => ({
        action: { startsWith: prefix as never },
      })),
    };
  }

  private buildTenantWhere(
    tenantId: string,
    params?: AuditListParams,
    ctx?: AuditViewerContext,
  ) {
    const q = String(params?.q || '').trim();
    return {
      AND: [
        { tenantId },
        this.visibilityWhere(ctx),
        params?.action ? { action: String(params.action).trim() } : {},
        this.routineActionWhere(params?.routine) || {},
        params?.userId ? { userId: String(params.userId).trim() } : {},
        this.buildDateWhere(params?.from, params?.to)
          ? { createdAt: this.buildDateWhere(params?.from, params?.to) }
          : {},
        q
          ? {
              OR: [
                { action: { contains: q, mode: 'insensitive' as const } },
                { metaJson: { contains: q, mode: 'insensitive' as const } },
                {
                  user: {
                    is: { name: { contains: q, mode: 'insensitive' as const } },
                  },
                },
                {
                  user: {
                    is: {
                      email: { contains: q, mode: 'insensitive' as const },
                    },
                  },
                },
                {
                  matter: {
                    is: {
                      title: { contains: q, mode: 'insensitive' as const },
                    },
                  },
                },
              ],
            }
          : {},
      ],
    };
  }

  private buildMatterWhere(
    tenantId: string,
    matterId: string,
    params?: AuditListParams,
    ctx?: AuditViewerContext,
  ) {
    const q = String(params?.q || '').trim();
    return {
      AND: [
        { tenantId, matterId },
        this.visibilityWhere(ctx),
        params?.systemOnly
          ? { NOT: { action: { startsWith: 'MATTER_UPDATE_' as const } } }
          : {},
        params?.action ? { action: String(params.action).trim() } : {},
        this.routineActionWhere(params?.routine) || {},
        params?.userId ? { userId: String(params.userId).trim() } : {},
        this.buildDateWhere(params?.from, params?.to)
          ? { createdAt: this.buildDateWhere(params?.from, params?.to) }
          : {},
        q
          ? {
              OR: [
                { action: { contains: q, mode: 'insensitive' as const } },
                { metaJson: { contains: q, mode: 'insensitive' as const } },
                {
                  user: {
                    is: { name: { contains: q, mode: 'insensitive' as const } },
                  },
                },
                {
                  user: {
                    is: {
                      email: { contains: q, mode: 'insensitive' as const },
                    },
                  },
                },
              ],
            }
          : {},
      ],
    };
  }

  private parseMeta(metaJson?: string | null) {
    if (!metaJson) return '';
    try {
      const parsed = JSON.parse(metaJson) as Record<string, unknown>;
      const copy = { ...parsed } as Record<string, unknown>;
      delete copy._request;
      const entries = Object.entries(copy);
      if (entries.length === 0) return '';
      return formatAuditMetaEntries(copy, entries.length).replaceAll(
        ' · ',
        ' | ',
      );
    } catch {
      return metaJson;
    }
  }

  private csvEscape(input: string | number | boolean | null | undefined) {
    const value = input == null ? '' : String(input);
    if (value.includes('"') || value.includes(',') || value.includes('\n')) {
      return `"${value.replaceAll('"', '""')}"`;
    }
    return value;
  }

  private buildCsv(rows: AuditCsvRow[]) {
    const header = [
      'data',
      'acao',
      'detalhe',
      'usuario_nome',
      'usuario_email',
      'pessoa',
      'caso',
    ];
    const lines = [header.join(',')];
    for (const row of rows) {
      lines.push(
        [
          this.csvEscape(row.createdAt.toISOString()),
          this.csvEscape(formatAuditActionLabel(row.action)),
          this.csvEscape(row.detail || ''),
          this.csvEscape(row.userName || ''),
          this.csvEscape(row.userEmail || ''),
          this.csvEscape(row.personName || ''),
          this.csvEscape(row.matterTitle || ''),
        ].join(','),
      );
    }
    return lines.join('\n');
  }

  private extractClientId(metaJson?: string | null): string | null {
    if (!metaJson) return null;
    try {
      const parsed = JSON.parse(metaJson) as Record<string, unknown>;
      const clientId = parsed?.clientId;
      if (typeof clientId !== 'string') return null;
      const value = clientId.trim();
      return value || null;
    } catch {
      return null;
    }
  }

  private async buildPersonNameMap(
    tenantId: string,
    rows: Array<{
      metaJson?: string | null;
      matter?: { client?: { name?: string | null } | null } | null;
    }>,
  ) {
    const clientIds = Array.from(
      new Set(
        rows
          .map((row) => this.extractClientId(row.metaJson))
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const map = new Map<string, string>();
    if (clientIds.length) {
      const clients = await this.prisma.client.findMany({
        where: { tenantId, id: { in: clientIds } },
        select: { id: true, name: true },
      });
      clients.forEach((client) => map.set(client.id, client.name));
    }
    return map;
  }

  private routineLabel(value?: string) {
    const routine = String(value || '')
      .trim()
      .toLowerCase();
    if (!routine || routine === 'todas') return 'Todas';
    const map: Record<string, string> = {
      casos: 'Casos',
      pessoas: 'Pessoas',
      atendimento: 'Atendimento',
      agenda: 'Agenda',
      financeiro: 'Financeiro',
      relatorios: 'Relatórios',
      relatórios: 'Relatórios',
      equipe: 'Equipe',
      auditoria: 'Auditoria',
      notificacoes: 'Notificações',
      notificações: 'Notificações',
      escritorios: 'Escritórios',
      escritórios: 'Escritórios',
    };
    return map[routine] || routine;
  }

  private async getTenantTimezone(tenantId: string) {
    const row = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    });
    return String(row?.timezone || 'America/Manaus');
  }

  private buildPdf(
    rows: AuditCsvRow[],
    title: string,
    params?: AuditListParams,
    extras?: {
      matterTitle?: string | null;
      exportedByEmail?: string | null;
      tenantTimeZone?: string | null;
    },
  ) {
    return new Promise<Buffer>((resolve) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        margin: 36,
        size: 'A4',
        bufferPages: true,
      });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 36;
      const contentWidth = pageWidth - margin * 2;
      const headerRowHeight = 24;
      const minRowHeight = 24;
      const titleColor = '#111827';
      const muted = '#6B7280';
      const border = '#E5E7EB';

      const tenantTimeZone = String(extras?.tenantTimeZone || 'America/Manaus');
      const formatDateTime = (value: Date) =>
        value.toLocaleString('pt-BR', { timeZone: tenantTimeZone });

      const ensureSpace = (space: number) => {
        if (doc.y + space > pageHeight - margin - 20) doc.addPage();
      };

      const drawTableHeader = () => {
        ensureSpace(headerRowHeight + 8);
        const y = doc.y;
        const createdAtWidth = 75;
        const actionWidth = 95;
        const userWidth = 70;
        const personWidth = 70;
        const matterWidth = 55;
        const cols = [
          { key: 'createdAt', label: 'Data/Hora', width: createdAtWidth },
          { key: 'action', label: 'Ação', width: actionWidth },
          { key: 'user', label: 'Usuário', width: userWidth },
          { key: 'person', label: 'Pessoa', width: personWidth },
          { key: 'matter', label: 'Caso', width: matterWidth },
          {
            key: 'detail',
            label: 'Detalhe',
            width:
              contentWidth -
              (createdAtWidth +
                actionWidth +
                userWidth +
                personWidth +
                matterWidth),
          },
        ] as const;
        doc
          .roundedRect(margin, y, contentWidth, headerRowHeight, 4)
          .fillAndStroke('#F3F4F6', border);
        let x = margin;
        for (const col of cols) {
          doc
            .font('Helvetica-Bold')
            .fontSize(8)
            .fillColor('#374151')
            .text(col.label, x + 6, y + 6, {
              width: col.width - 12,
              ellipsis: true,
            });
          x += col.width;
        }
        doc.y = y + headerRowHeight;
        return cols;
      };

      const getCellHeight = (text: string, width: number) => {
        doc.font('Helvetica').fontSize(8.5);
        return Math.max(
          11,
          Math.ceil(
            doc.heightOfString(text, {
              width: width - 12,
              align: 'left',
            }),
          ),
        );
      };

      const drawCellText = (
        text: string,
        x: number,
        y: number,
        width: number,
        rowHeight: number,
      ) => {
        const previousY = doc.y;
        doc.save();
        doc.rect(x + 1, y + 1, width - 2, rowHeight - 2).clip();
        doc
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor('#111827')
          .text(text, x + 6, y + 6, {
            width: width - 12,
            align: 'left',
            lineBreak: true,
          });
        doc.restore();
        doc.y = previousY;
      };

      doc.font('Helvetica-Bold').fontSize(19).fillColor(titleColor).text(title);
      doc.moveDown(0.4);
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#374151')
        .text(`Gerado em: ${formatDateTime(new Date())}`)
        .text(`Total de eventos: ${rows.length}`);
      if (extras?.exportedByEmail) {
        doc.text(`Exportado por: ${extras.exportedByEmail}`);
      }
      doc.moveDown(0.45);
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor(titleColor)
        .text('Filtros aplicados');
      doc.moveDown(0.25);
      const actionLabel = params?.action
        ? formatAuditActionLabel(String(params.action))
        : 'Todas';
      const periodLabel =
        params?.from || params?.to
          ? `${params?.from || '-'} até ${params?.to || '-'}`
          : 'Sem período';
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#374151')
        .text(`Rotina: ${this.routineLabel(params?.routine)}`)
        .text(`Ação: ${actionLabel}`)
        .text(`Usuário: ${String(params?.userId || 'Todos')}`)
        .text(`Período: ${periodLabel}`)
        .text(`Busca: ${String(params?.q || '-')}`);
      if (extras?.matterTitle) {
        doc.text(`Caso: ${extras.matterTitle}`);
      }
      doc.moveDown(0.5);
      doc
        .moveTo(margin, doc.y)
        .lineTo(margin + contentWidth, doc.y)
        .strokeColor(border)
        .stroke();
      doc.moveDown(0.6);

      const actionsCount = rows.reduce<Record<string, number>>((acc, row) => {
        const key = formatAuditActionLabel(row.action);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      const topActions = Object.entries(actionsCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      if (topActions.length > 0) {
        doc
          .font('Helvetica-Bold')
          .fontSize(12)
          .fillColor(titleColor)
          .text('Resumo de ações');
        doc.moveDown(0.3);
        for (const [label, count] of topActions) {
          doc
            .font('Helvetica')
            .fontSize(9)
            .fillColor(muted)
            .text(`${label}: ${count}`);
        }
        doc.moveDown(0.6);
      }

      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor(titleColor)
        .text('Eventos');
      doc.moveDown(0.3);

      const cols = drawTableHeader();
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const values: Record<string, string> = {
          createdAt: formatDateTime(row.createdAt),
          action: formatAuditActionLabel(row.action),
          user: String(row.userName || row.userEmail || '-'),
          person: String(row.personName || '-'),
          matter: String(row.matterTitle || '-'),
          detail: String(row.detail || '-'),
        };

        const rowHeight = Math.max(
          minRowHeight,
          ...cols.map((col) => getCellHeight(values[col.key], col.width) + 12),
        );

        if (doc.y + rowHeight > pageHeight - margin - 20) {
          doc.addPage();
          drawTableHeader();
        }
        const y = doc.y;
        const bg = index % 2 === 0 ? '#FFFFFF' : '#FAFAFA';
        doc.rect(margin, y, contentWidth, rowHeight).fillAndStroke(bg, border);

        let x = margin;
        for (const col of cols) {
          drawCellText(values[col.key], x, y, col.width, rowHeight);
          x += col.width;
        }
        doc.y = y + rowHeight;
      }

      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i += 1) {
        doc.switchToPage(i);
        const label = `Página ${i + 1} de ${range.count}`;
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor(muted)
          .text(label, margin, pageHeight - margin - 10, {
            width: contentWidth,
            align: 'right',
            lineBreak: false,
          });
      }
      doc.end();
    });
  }

  private computeAuditHash(input: {
    tenantId: string;
    action: string;
    userId?: string;
    matterId?: string;
    metaJson?: string;
    prevHash?: string;
    createdAt: Date;
  }) {
    const source = [
      input.tenantId,
      input.action,
      input.userId || '',
      input.matterId || '',
      input.createdAt.toISOString(),
      input.metaJson || '',
      input.prevHash || '',
    ].join('|');
    return createHash('sha256').update(source).digest('hex');
  }

  async log(
    tenantId: string,
    action: string,
    userId?: string,
    matterId?: string,
    meta?: unknown,
  ) {
    const context = getRequestContext();
    const safeMeta: Record<string, unknown> =
      meta && typeof meta === 'object' && !Array.isArray(meta)
        ? (meta as Record<string, unknown>)
        : meta !== undefined
          ? { value: meta }
          : {};
    const enrichedMeta: Record<string, unknown> = context
      ? {
          ...safeMeta,
          _request: {
            requestId: context.requestId,
            ip: context.ip,
            userAgent: context.userAgent,
          },
        }
      : safeMeta;
    const hasMeta = Object.keys(enrichedMeta).length > 0;
    const metaJson = hasMeta ? JSON.stringify(enrichedMeta) : undefined;
    const createdAt = new Date();
    const previous = this.prisma.auditLog.findFirst
      ? await this.prisma.auditLog.findFirst({
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
          select: { hash: true },
        })
      : null;
    const prevHash = previous?.hash || null;
    const hash = this.computeAuditHash({
      tenantId,
      action,
      userId,
      matterId,
      metaJson,
      prevHash: prevHash || undefined,
      createdAt,
    });

    return this.prisma.auditLog.create({
      data: {
        tenantId,
        action,
        userId,
        matterId,
        metaJson,
        prevHash,
        hash,
        createdAt,
      },
    });
  }

  async listTenant(
    tenantId: string,
    params?: AuditListParams,
    ctx?: AuditViewerContext,
  ) {
    const { pageSize, page, skip } = this.pagination(params);
    const where = this.buildTenantWhere(tenantId, params, ctx);

    const [value, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          user: { select: { id: true, name: true, email: true } },
          matter: true,
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      value,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async listMatter(
    tenantId: string,
    matterId: string,
    params?: AuditListParams,
    ctx?: AuditViewerContext,
  ) {
    const { pageSize, page, skip } = this.pagination(params);
    const where = this.buildMatterWhere(tenantId, matterId, params, ctx);

    const [value, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          user: { select: { id: true, name: true, email: true } },
          matter: true,
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      value,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async exportTenantCsv(
    tenantId: string,
    params?: AuditListParams,
    ctx?: AuditViewerContext,
  ) {
    const where = this.buildTenantWhere(tenantId, params, ctx);
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        matter: { select: { title: true, client: { select: { name: true } } } },
      },
      take: 5000,
    });
    const personNameMap = await this.buildPersonNameMap(tenantId, rows);

    return this.buildCsv(
      rows.map((row) => ({
        createdAt: row.createdAt,
        action: row.action,
        detail: this.parseMeta(row.metaJson),
        userName: row.user?.name,
        userEmail: row.user?.email,
        personName:
          row.matter?.client?.name ||
          personNameMap.get(this.extractClientId(row.metaJson) || '') ||
          null,
        matterTitle: row.matter?.title,
      })),
    );
  }

  async exportMatterCsv(
    tenantId: string,
    matterId: string,
    params?: AuditListParams,
    ctx?: AuditViewerContext,
  ) {
    const where = this.buildMatterWhere(tenantId, matterId, params, ctx);
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        matter: { select: { title: true, client: { select: { name: true } } } },
      },
      take: 5000,
    });
    const personNameMap = await this.buildPersonNameMap(tenantId, rows);

    return this.buildCsv(
      rows.map((row) => ({
        createdAt: row.createdAt,
        action: row.action,
        detail: this.parseMeta(row.metaJson),
        userName: row.user?.name,
        userEmail: row.user?.email,
        personName:
          row.matter?.client?.name ||
          personNameMap.get(this.extractClientId(row.metaJson) || '') ||
          null,
        matterTitle: row.matter?.title,
      })),
    );
  }

  async exportTenantPdf(
    tenantId: string,
    params?: AuditListParams,
    ctx?: AuditViewerContext,
    extras?: { exportedByEmail?: string | null },
  ) {
    const tenantTimeZone = await this.getTenantTimezone(tenantId);
    const where = this.buildTenantWhere(tenantId, params, ctx);
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        matter: { select: { title: true, client: { select: { name: true } } } },
      },
      take: 2000,
    });
    const personNameMap = await this.buildPersonNameMap(tenantId, rows);

    return this.buildPdf(
      rows.map((row) => ({
        createdAt: row.createdAt,
        action: row.action,
        detail: this.parseMeta(row.metaJson),
        userName: row.user?.name,
        userEmail: row.user?.email,
        personName:
          row.matter?.client?.name ||
          personNameMap.get(this.extractClientId(row.metaJson) || '') ||
          null,
        matterTitle: row.matter?.title,
      })),
      'Auditoria do escritório',
      params,
      {
        exportedByEmail: extras?.exportedByEmail || null,
        tenantTimeZone,
      },
    );
  }

  async exportMatterPdf(
    tenantId: string,
    matterId: string,
    params?: AuditListParams,
    ctx?: AuditViewerContext,
    extras?: { exportedByEmail?: string | null },
  ) {
    const tenantTimeZone = await this.getTenantTimezone(tenantId);
    const where = this.buildMatterWhere(tenantId, matterId, params, ctx);
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        matter: { select: { title: true, client: { select: { name: true } } } },
      },
      take: 2000,
    });
    const personNameMap = await this.buildPersonNameMap(tenantId, rows);

    return this.buildPdf(
      rows.map((row) => ({
        createdAt: row.createdAt,
        action: row.action,
        detail: this.parseMeta(row.metaJson),
        userName: row.user?.name,
        userEmail: row.user?.email,
        personName:
          row.matter?.client?.name ||
          personNameMap.get(this.extractClientId(row.metaJson) || '') ||
          null,
        matterTitle: row.matter?.title,
      })),
      `Auditoria do caso ${matterId}`,
      params,
      {
        matterTitle:
          rows.find((row) => row.matter?.title)?.matter?.title || null,
        exportedByEmail: extras?.exportedByEmail || null,
        tenantTimeZone,
      },
    );
  }
}

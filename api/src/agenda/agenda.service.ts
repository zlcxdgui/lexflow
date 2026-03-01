import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export type AgendaFilters = {
  taskStatus?: string;
  taskPriority?: string;
  deadlineStatus?: string;
  deadlineType?: string;
  assignee?: string;
  q?: string;
};

function sanitizeFilters(input: AgendaFilters): AgendaFilters {
  const taskStatus = String(input?.taskStatus || 'ALL').toUpperCase();
  const taskPriority = String(input?.taskPriority || 'ALL').toUpperCase();
  const deadlineStatus = String(input?.deadlineStatus || 'ALL').toUpperCase();
  const deadlineType = String(input?.deadlineType || 'ALL').toUpperCase();
  const assignee = String(input?.assignee || '').trim();
  const q = String(input?.q || '').trim();

  return {
    taskStatus: ['ALL', 'OPEN', 'DOING', 'DONE', 'CANCELED'].includes(
      taskStatus,
    )
      ? taskStatus
      : 'ALL',
    taskPriority: ['ALL', 'LOW', 'MEDIUM', 'HIGH'].includes(taskPriority)
      ? taskPriority
      : 'ALL',
    deadlineStatus: ['ALL', 'PENDING', 'DONE', 'OVERDUE', 'TODAY'].includes(
      deadlineStatus,
    )
      ? deadlineStatus
      : 'ALL',
    deadlineType: ['ALL', 'GENERIC', 'PROCESSUAL'].includes(deadlineType)
      ? deadlineType
      : 'ALL',
    assignee,
    q,
  };
}

function parseFilters(raw: string): AgendaFilters {
  try {
    const data = JSON.parse(raw) as AgendaFilters;
    return sanitizeFilters(data || {});
  } catch {
    return sanitizeFilters({});
  }
}

const agendaViewSelect = {
  id: true,
  name: true,
  isDefault: true,
  filtersJson: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AgendaViewSelect;

type AgendaViewRow = Prisma.AgendaViewGetPayload<{
  select: typeof agendaViewSelect;
}>;

type AgendaViewOutput = {
  id: string;
  name: string;
  isDefault: boolean;
  filters: AgendaFilters;
  createdAt: Date;
  updatedAt: Date;
};

function mapAgendaView(row: AgendaViewRow): AgendaViewOutput {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.isDefault,
    filters: parseFilters(row.filtersJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class AgendaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private readonly maxViewsPerUser = 30;

  private async ensureViewNameAvailable(
    tenantId: string,
    userId: string,
    name: string,
    ignoreId?: string,
  ) {
    const existing = await this.prisma.agendaView.findFirst({
      where: {
        tenantId,
        userId,
        ...(ignoreId ? { NOT: { id: ignoreId } } : {}),
        name: { equals: name, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('Já existe uma visão com este nome');
    }
  }

  async listViews(tenantId: string, userId: string) {
    const rows = await this.prisma.agendaView.findMany({
      where: { tenantId, userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: agendaViewSelect,
    });

    return rows.map(mapAgendaView);
  }

  async createView(
    tenantId: string,
    userId: string,
    payload: { name: string; filters: AgendaFilters; setDefault?: boolean },
  ) {
    const name = String(payload?.name || '').trim();
    if (!name) throw new BadRequestException('Nome da visão é obrigatório');
    if (name.length > 60)
      throw new BadRequestException('Nome da visão muito longo');
    const filters = sanitizeFilters(payload?.filters || {});
    const total = await this.prisma.agendaView.count({
      where: { tenantId, userId },
    });
    if (total >= this.maxViewsPerUser) {
      throw new BadRequestException(
        `Limite de ${this.maxViewsPerUser} visões por usuário atingido`,
      );
    }
    await this.ensureViewNameAvailable(tenantId, userId, name);
    const setDefault = Boolean(payload?.setDefault) || total === 0;

    const created = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        if (setDefault) {
          await tx.agendaView.updateMany({
            where: { tenantId, userId, isDefault: true },
            data: { isDefault: false },
          });
        }
        const createdRow = await tx.agendaView.create({
          data: {
            tenantId,
            userId,
            name,
            isDefault: setDefault,
            filtersJson: JSON.stringify(filters),
          },
          select: agendaViewSelect,
        });

        return mapAgendaView(createdRow);
      },
    );

    await this.audit.log(tenantId, 'AGENDA_VIEW_CREATED', userId, undefined, {
      viewId: created.id,
      name: created.name,
      isDefault: created.isDefault,
      filters: created.filters,
    });
    return created;
  }

  async updateView(
    tenantId: string,
    userId: string,
    viewId: string,
    payload: { name?: string; filters?: AgendaFilters; setDefault?: boolean },
  ) {
    const current = await this.prisma.agendaView.findFirst({
      where: { id: viewId, tenantId, userId },
      select: { id: true, name: true, filtersJson: true },
    });
    if (!current) throw new NotFoundException('Visão não encontrada');

    const nextName =
      payload?.name !== undefined
        ? String(payload.name || '').trim()
        : current.name;
    if (!nextName) throw new BadRequestException('Nome da visão é obrigatório');
    if (nextName.length > 60)
      throw new BadRequestException('Nome da visão muito longo');
    if (nextName.toLowerCase() !== current.name.toLowerCase()) {
      await this.ensureViewNameAvailable(tenantId, userId, nextName, viewId);
    }

    const currentFilters = parseFilters(current.filtersJson);
    const nextFilters =
      payload?.filters !== undefined
        ? sanitizeFilters(payload.filters)
        : currentFilters;
    const setDefault = payload?.setDefault === true;

    const updated = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        if (setDefault) {
          await tx.agendaView.updateMany({
            where: { tenantId, userId, isDefault: true, NOT: { id: viewId } },
            data: { isDefault: false },
          });
        }

        const updatedRow = await tx.agendaView.update({
          where: { id: viewId },
          data: {
            name: nextName,
            filtersJson: JSON.stringify(nextFilters),
            ...(payload?.setDefault !== undefined
              ? { isDefault: setDefault }
              : {}),
          },
          select: agendaViewSelect,
        });

        return mapAgendaView(updatedRow);
      },
    );

    await this.audit.log(tenantId, 'AGENDA_VIEW_UPDATED', userId, undefined, {
      viewId: updated.id,
      previousName: current.name,
      nextName: updated.name,
      isDefault: updated.isDefault,
      filters: updated.filters,
    });
    return updated;
  }

  async deleteView(tenantId: string, userId: string, viewId: string) {
    const current = await this.prisma.agendaView.findFirst({
      where: { id: viewId, tenantId, userId },
      select: { id: true, name: true, isDefault: true },
    });
    if (!current) throw new NotFoundException('Visão não encontrada');

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.agendaView.delete({ where: { id: viewId } });
      if (current.isDefault) {
        const replacement = await tx.agendaView.findFirst({
          where: { tenantId, userId },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        if (replacement?.id) {
          await tx.agendaView.update({
            where: { id: replacement.id },
            data: { isDefault: true },
          });
        }
      }
    });

    await this.audit.log(tenantId, 'AGENDA_VIEW_DELETED', userId, undefined, {
      viewId: current.id,
      name: current.name,
      wasDefault: current.isDefault,
    });
    return { ok: true };
  }
}

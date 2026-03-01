import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeadlineDto } from './dto/create-deadline.dto';
import { UpdateDeadlineDto } from './dto/update-deadline.dto';
import { AuditService } from '../audit/audit.service';

function parseDateRequired(input: string): Date {
  const d = new Date(input);
  if (Number.isNaN(d.getTime()))
    throw new BadRequestException('dueDate inválido (use ISO ou YYYY-MM-DD)');
  return d;
}

function parseDateOptional(input?: string): Date | undefined {
  if (input === undefined) return undefined;
  return parseDateRequired(input);
}

function endOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

function startOfDay(d: Date) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}

@Injectable()
export class DeadlinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private auditDeadlineSnapshot(deadline: {
    id: string;
    matterId?: string | null;
    title?: string | null;
    type?: string | null;
    dueDate?: Date | string | null;
    notes?: string | null;
    isDone?: boolean | null;
  }) {
    return {
      deadlineId: deadline.id,
      matterId: deadline.matterId ?? null,
      title: deadline.title ?? null,
      type: deadline.type ?? null,
      dueDate:
        deadline.dueDate instanceof Date
          ? deadline.dueDate.toISOString()
          : (deadline.dueDate ?? null),
      notes: deadline.notes ?? null,
      isDone: deadline.isDone ?? null,
    };
  }

  async listAgenda(
    tenantId: string,
    filters?: {
      type?: string;
      isDone?: string;
      dueFrom?: string;
      dueTo?: string;
      viewerUserId?: string;
      hideData?: boolean;
    },
  ) {
    const type = (filters?.type || '').trim().toUpperCase();
    const isDoneRaw = (filters?.isDone || '').trim().toLowerCase();
    const dueFrom = parseDateOptional(filters?.dueFrom);
    const dueToRaw = parseDateOptional(filters?.dueTo);
    const dueTo = dueToRaw ? endOfUtcDay(dueToRaw) : undefined;
    const viewerUserId = (filters?.viewerUserId || '').trim();
    const hideData = Boolean(filters?.hideData);

    if (hideData) {
      return [];
    }

    const where: Prisma.DeadlineWhereInput = { tenantId };

    if (type && type !== 'ALL') where.type = type;
    if (isDoneRaw === 'true') where.isDone = true;
    if (isDoneRaw === 'false') where.isDone = false;
    if (dueFrom || dueTo) {
      where.dueDate = {
        ...(dueFrom ? { gte: dueFrom } : {}),
        ...(dueTo ? { lte: dueTo } : {}),
      };
    }
    if (viewerUserId) {
      where.OR = [
        { matter: { members: { some: { userId: viewerUserId } } } },
        { matter: { tasks: { some: { assignedToUserId: viewerUserId } } } },
      ];
    }

    return this.prisma.deadline.findMany({
      where,
      orderBy: { dueDate: 'asc' },
      include: {
        matter: true,
      },
    });
  }

  async listByMatter(tenantId: string, matterId: string) {
    const matter = await this.prisma.matter.findFirst({
      where: { tenantId, id: matterId },
    });
    if (!matter) throw new NotFoundException('Caso não encontrado');

    return this.prisma.deadline.findMany({
      where: { tenantId, matterId },
      orderBy: [{ isDone: 'asc' }, { dueDate: 'asc' }],
    });
  }

  async createForMatter(
    tenantId: string,
    matterId: string,
    actorId: string,
    dto: CreateDeadlineDto,
  ) {
    const matter = await this.prisma.matter.findFirst({
      where: { tenantId, id: matterId },
    });
    if (!matter) throw new NotFoundException('Caso não encontrado');

    const due = parseDateRequired(dto.dueDate);

    const today = startOfDay(new Date());
    const dueDay = startOfDay(due);
    if (!dto.allowPast && dueDay < today) {
      throw new BadRequestException(
        'dueDate no passado (use allowPast=true para permitir)',
      );
    }

    const created = await this.prisma.deadline.create({
      data: {
        tenantId,
        matterId,
        title: dto.title.trim(),
        type: dto.type?.trim() || 'GENERIC',
        dueDate: due,
        notes: dto.notes,
      },
    });
    await this.audit.log(tenantId, 'DEADLINE_CREATED', actorId, matterId, {
      ...this.auditDeadlineSnapshot(created),
    });
    return created;
  }

  async get(tenantId: string, id: string) {
    const d = await this.prisma.deadline.findFirst({ where: { tenantId, id } });
    if (!d) throw new NotFoundException('Prazo não encontrado');
    return d;
  }

  async update(
    tenantId: string,
    actorId: string,
    id: string,
    dto: UpdateDeadlineDto,
  ) {
    const current = await this.get(tenantId, id);

    const due = parseDateOptional(dto.dueDate);

    if (due !== undefined) {
      const today = startOfDay(new Date());
      const dueDay = startOfDay(due);
      if (!dto.allowPast && dueDay < today) {
        throw new BadRequestException(
          'dueDate no passado (use allowPast=true para permitir)',
        );
      }
    }

    const updated = await this.prisma.deadline.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        type: dto.type?.trim(),
        dueDate: due, // Date | undefined (nunca null)
        notes: dto.notes === undefined ? undefined : dto.notes,
        isDone: dto.isDone,
      },
    });
    await this.audit.log(
      tenantId,
      'DEADLINE_UPDATED',
      actorId,
      updated.matterId,
      {
        before: this.auditDeadlineSnapshot(current),
        after: this.auditDeadlineSnapshot(updated),
        fields: {
          title: dto.title !== undefined,
          type: dto.type !== undefined,
          dueDate: dto.dueDate !== undefined,
          notes: dto.notes !== undefined,
          isDone: dto.isDone !== undefined,
        },
      },
    );
    return updated;
  }

  async remove(tenantId: string, actorId: string, id: string) {
    const current = await this.get(tenantId, id);
    await this.prisma.deadline.delete({ where: { id } });
    await this.audit.log(
      tenantId,
      'DEADLINE_DELETED',
      actorId,
      current.matterId,
      {
        ...this.auditDeadlineSnapshot(current),
      },
    );
    return { ok: true };
  }

  async upcoming(tenantId: string, days: number) {
    const d = Number.isFinite(days) && days > 0 ? Math.min(days, 60) : 7;

    const now = new Date();
    const from = startOfDay(now);
    const to = new Date(from.getTime() + d * 24 * 60 * 60 * 1000);

    return this.prisma.deadline.findMany({
      where: {
        tenantId,
        isDone: false,
        dueDate: {
          gte: from,
          lt: to,
        },
      },
      orderBy: { dueDate: 'asc' },
      include: {
        matter: true,
      },
    });
  }
}

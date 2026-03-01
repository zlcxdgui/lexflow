import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { AuditService } from '../audit/audit.service';

function parseDueDate(input?: string | null): Date | null | undefined {
  if (input === undefined) return undefined;
  if (input === null) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime()))
    throw new BadRequestException('dueDate inválido (use ISO ou YYYY-MM-DD)');
  return d;
}

function parseOptionalDate(input?: string): Date | undefined {
  if (!input) return undefined;
  const d = new Date(input);
  if (Number.isNaN(d.getTime()))
    throw new BadRequestException('Data inválida (use ISO ou YYYY-MM-DD)');
  return d;
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

function isAppointmentTitle(value?: string | null): boolean {
  return String(value || '')
    .trim()
    .toLowerCase()
    .startsWith('atendimento');
}

function ensureAppointmentTitle(value?: string | null): string {
  const base = String(value || '').trim();
  if (!base) return 'Atendimento';
  if (isAppointmentTitle(base)) return base;
  return `Atendimento: ${base}`;
}

const userSafeSelect = {
  id: true,
  name: true,
  email: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private auditTaskSnapshot(task: {
    id: string;
    matterId?: string | null;
    title?: string | null;
    description?: string | null;
    status?: string | null;
    priority?: string | null;
    dueDate?: Date | string | null;
    createdByUserId?: string | null;
    assignedToUserId?: string | null;
  }) {
    return {
      taskId: task.id,
      matterId: task.matterId ?? null,
      title: task.title ?? null,
      description: task.description ?? null,
      status: task.status ?? null,
      priority: task.priority ?? null,
      dueDate:
        task.dueDate instanceof Date
          ? task.dueDate.toISOString()
          : (task.dueDate ?? null),
      createdByUserId: task.createdByUserId ?? null,
      assignedToUserId: task.assignedToUserId ?? null,
    };
  }

  private async validateAssignee(tenantId: string, assignedToUserId?: string) {
    if (!assignedToUserId) return;
    const tm = await this.prisma.tenantMember.findFirst({
      where: { tenantId, userId: assignedToUserId, isActive: true },
      include: { user: { select: { isPlatformAdmin: true } } },
    });
    if (!tm)
      throw new BadRequestException(
        'assignedToUserId não pertence ao escritório',
      );
    if (tm.user?.isPlatformAdmin) {
      throw new BadRequestException(
        'Não é permitido atribuir tarefa para admin de plataforma',
      );
    }
  }

  private async createAssignmentNotification(input: {
    tenantId: string;
    recipientUserId: string;
    taskId: string;
    taskTitle: string;
    matterId?: string | null;
    matterTitle?: string | null;
  }) {
    const href = input.matterId
      ? `/matters/${input.matterId}?tab=tasks`
      : '/agenda?taskStatus=OPEN';
    const title = `Nova tarefa atribuída: ${input.taskTitle}`;
    const since = new Date(Date.now() - 30 * 60 * 1000);

    const existing = await this.prisma.notification.findFirst({
      where: {
        tenantId: input.tenantId,
        recipientUserId: input.recipientUserId,
        kind: 'TASK_ASSIGNED',
        href,
        title,
        isRead: false,
        createdAt: { gte: since },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return;

    await this.prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        recipientUserId: input.recipientUserId,
        kind: 'TASK_ASSIGNED',
        title,
        subtitle: input.matterTitle
          ? `Caso: ${input.matterTitle}`
          : 'Tarefa na agenda sem caso vinculado',
        href,
        dataJson: JSON.stringify({
          taskId: input.taskId,
          matterId: input.matterId || null,
        }),
      },
    });
  }

  private async createInternal(
    tenantId: string,
    createdByUserId: string,
    dto: CreateTaskDto,
    forcedMatterId?: string,
  ) {
    const matterId = forcedMatterId ?? dto.matterId;
    let matterTitle: string | null = null;

    if (matterId) {
      const matter = await this.prisma.matter.findFirst({
        where: { tenantId, id: matterId },
        select: { id: true, title: true },
      });
      if (!matter) throw new NotFoundException('Caso não encontrado');
      matterTitle = matter.title;
    }

    await this.validateAssignee(tenantId, dto.assignedToUserId);

    const created = await this.prisma.task.create({
      data: {
        tenantId,
        matterId: matterId || null,
        title: dto.title.trim(),
        description: dto.description,
        priority: dto.priority?.trim() || 'MEDIUM',
        dueDate: parseDueDate(dto.dueDate),
        createdByUserId,
        assignedToUserId: dto.assignedToUserId,
      },
      include: {
        assignedTo: { select: userSafeSelect },
        createdBy: { select: userSafeSelect },
        matter: { select: { id: true, title: true } },
      },
    });

    if (created.assignedToUserId) {
      await this.createAssignmentNotification({
        tenantId,
        recipientUserId: created.assignedToUserId,
        taskId: created.id,
        taskTitle: created.title,
        matterId: created.matterId,
        matterTitle: created.matter?.title || matterTitle,
      });
    }

    return created;
  }

  async listAgenda(
    tenantId: string,
    filters?: {
      status?: string;
      assignedToUserId?: string;
      dueFrom?: string;
      dueTo?: string;
      viewerUserId?: string;
      hideData?: boolean;
    },
  ) {
    const status = (filters?.status || '').trim().toUpperCase();
    const assignedToUserId = (filters?.assignedToUserId || '').trim();
    const dueFrom = parseOptionalDate(filters?.dueFrom);
    const dueToRaw = parseOptionalDate(filters?.dueTo);
    const dueTo = dueToRaw ? endOfUtcDay(dueToRaw) : undefined;
    const viewerUserId = (filters?.viewerUserId || '').trim();
    const hideData = Boolean(filters?.hideData);

    if (hideData) {
      return [];
    }

    const where: {
      tenantId: string;
      status?: string;
      assignedToUserId?: string;
      dueDate?: { gte?: Date; lte?: Date };
    } = {
      tenantId,
    };

    if (status && status !== 'ALL') where.status = status;
    if (viewerUserId) {
      where.assignedToUserId = viewerUserId;
    } else if (assignedToUserId) {
      where.assignedToUserId = assignedToUserId;
    }
    if (dueFrom || dueTo) {
      where.dueDate = {
        ...(dueFrom ? { gte: dueFrom } : {}),
        ...(dueTo ? { lte: dueTo } : {}),
      };
    }

    return this.prisma.task.findMany({
      where,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      include: {
        matter: true,
        assignedTo: { select: userSafeSelect },
        createdBy: { select: userSafeSelect },
      },
    });
  }

  async listByMatter(tenantId: string, matterId: string) {
    return this.prisma.task.findMany({
      where: { tenantId, matterId },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
      include: {
        assignedTo: { select: userSafeSelect },
        createdBy: { select: userSafeSelect },
      },
    });
  }

  async listAppointments(
    tenantId: string,
    filters?: {
      status?: string;
      assignedToUserId?: string;
      dueFrom?: string;
      dueTo?: string;
    },
  ) {
    const status = (filters?.status || '').trim().toUpperCase();
    const assignedToUserId = (filters?.assignedToUserId || '').trim();
    const dueFrom = parseOptionalDate(filters?.dueFrom);
    const dueToRaw = parseOptionalDate(filters?.dueTo);
    const dueTo = dueToRaw ? endOfUtcDay(dueToRaw) : undefined;

    const where: Prisma.TaskWhereInput = {
      tenantId,
      title: { startsWith: 'Atendimento', mode: 'insensitive' },
    };

    if (status && status !== 'ALL') where.status = status;
    if (assignedToUserId) where.assignedToUserId = assignedToUserId;
    if (dueFrom || dueTo) {
      where.dueDate = {
        ...(dueFrom ? { gte: dueFrom } : {}),
        ...(dueTo ? { lte: dueTo } : {}),
      };
    }

    return this.prisma.task.findMany({
      where,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      include: {
        matter: true,
        assignedTo: { select: userSafeSelect },
        createdBy: { select: userSafeSelect },
      },
    });
  }

  async createForMatter(
    tenantId: string,
    matterId: string,
    createdByUserId: string,
    dto: CreateTaskDto,
  ) {
    const created = await this.createInternal(
      tenantId,
      createdByUserId,
      dto,
      matterId,
    );
    await this.audit.log(
      tenantId,
      'TASK_CREATED',
      createdByUserId,
      created.matterId || undefined,
      {
        ...this.auditTaskSnapshot(created),
      },
    );
    return created;
  }

  async create(tenantId: string, createdByUserId: string, dto: CreateTaskDto) {
    const created = await this.createInternal(tenantId, createdByUserId, dto);
    await this.audit.log(
      tenantId,
      'TASK_CREATED',
      createdByUserId,
      created.matterId || undefined,
      {
        ...this.auditTaskSnapshot(created),
      },
    );
    return created;
  }

  async createAppointment(
    tenantId: string,
    createdByUserId: string,
    dto: CreateTaskDto,
  ) {
    const nextDto: CreateTaskDto = {
      ...dto,
      title: ensureAppointmentTitle(dto.title),
    };
    const created = await this.createInternal(
      tenantId,
      createdByUserId,
      nextDto,
    );
    await this.audit.log(
      tenantId,
      'APPOINTMENT_CREATED',
      createdByUserId,
      created.matterId || undefined,
      {
        ...this.auditTaskSnapshot(created),
      },
    );
    return created;
  }

  async get(tenantId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { tenantId, id },
      include: {
        assignedTo: { select: userSafeSelect },
        createdBy: { select: userSafeSelect },
        matter: true,
      },
    });
    if (!task) throw new NotFoundException('Tarefa não encontrada');
    return task;
  }

  async update(
    tenantId: string,
    actorId: string,
    id: string,
    dto: UpdateTaskDto,
  ) {
    const current = await this.get(tenantId, id);

    await this.validateAssignee(tenantId, dto.assignedToUserId || undefined);

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        description: dto.description,
        status: dto.status?.trim(),
        priority: dto.priority?.trim(),
        dueDate: parseDueDate(dto.dueDate),
        assignedToUserId:
          dto.assignedToUserId === undefined ? undefined : dto.assignedToUserId,
      },
      include: {
        assignedTo: { select: userSafeSelect },
        createdBy: { select: userSafeSelect },
        matter: { select: { id: true, title: true } },
      },
    });

    const assignmentChanged =
      dto.assignedToUserId !== undefined &&
      dto.assignedToUserId !== current.assignedToUserId &&
      Boolean(dto.assignedToUserId);
    if (assignmentChanged) {
      await this.createAssignmentNotification({
        tenantId,
        recipientUserId: String(dto.assignedToUserId),
        taskId: updated.id,
        taskTitle: updated.title,
        matterId: updated.matterId || null,
        matterTitle: updated.matter?.title,
      });
    }

    const isTaskClosed =
      updated.status?.toUpperCase() === 'DONE' ||
      updated.status?.toUpperCase() === 'CANCELED';
    if (isTaskClosed) {
      await this.prisma.notification.updateMany({
        where: {
          tenantId,
          kind: 'TASK_ASSIGNED',
          isRead: false,
          dataJson: { contains: `"taskId":"${updated.id}"` },
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
    }

    await this.audit.log(
      tenantId,
      'TASK_UPDATED',
      actorId,
      updated.matterId || undefined,
      {
        before: this.auditTaskSnapshot(current),
        after: this.auditTaskSnapshot(updated),
        fields: {
          title: dto.title !== undefined,
          description: dto.description !== undefined,
          status: dto.status !== undefined,
          priority: dto.priority !== undefined,
          dueDate: dto.dueDate !== undefined,
          assignedToUserId: dto.assignedToUserId !== undefined,
        },
      },
    );

    return updated;
  }

  async remove(tenantId: string, actorId: string, id: string) {
    const current = await this.get(tenantId, id);
    await this.prisma.task.delete({ where: { id } });
    await this.audit.log(
      tenantId,
      'TASK_DELETED',
      actorId,
      current.matterId || undefined,
      {
        ...this.auditTaskSnapshot(current),
      },
    );
    return { ok: true };
  }

  private async getAppointment(tenantId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: {
        tenantId,
        id,
        title: { startsWith: 'Atendimento', mode: 'insensitive' },
      },
      include: {
        assignedTo: { select: userSafeSelect },
        createdBy: { select: userSafeSelect },
        matter: true,
      },
    });
    if (!task) throw new NotFoundException('Atendimento não encontrado');
    return task;
  }

  async updateAppointment(
    tenantId: string,
    actorId: string,
    id: string,
    dto: UpdateTaskDto,
  ) {
    const current = await this.getAppointment(tenantId, id);

    await this.validateAssignee(tenantId, dto.assignedToUserId || undefined);

    const nextTitle =
      dto.title === undefined ? undefined : ensureAppointmentTitle(dto.title);

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        title: nextTitle,
        description: dto.description,
        status: dto.status?.trim(),
        priority: dto.priority?.trim(),
        dueDate: parseDueDate(dto.dueDate),
        assignedToUserId:
          dto.assignedToUserId === undefined ? undefined : dto.assignedToUserId,
      },
      include: {
        assignedTo: { select: userSafeSelect },
        createdBy: { select: userSafeSelect },
        matter: { select: { id: true, title: true } },
      },
    });

    const assignmentChanged =
      dto.assignedToUserId !== undefined &&
      dto.assignedToUserId !== current.assignedToUserId &&
      Boolean(dto.assignedToUserId);
    if (assignmentChanged) {
      await this.createAssignmentNotification({
        tenantId,
        recipientUserId: String(dto.assignedToUserId),
        taskId: updated.id,
        taskTitle: updated.title,
        matterId: updated.matterId || null,
        matterTitle: updated.matter?.title,
      });
    }

    await this.audit.log(
      tenantId,
      'APPOINTMENT_UPDATED',
      actorId,
      updated.matterId || undefined,
      {
        before: this.auditTaskSnapshot(current),
        after: this.auditTaskSnapshot(updated),
        fields: {
          title: dto.title !== undefined,
          description: dto.description !== undefined,
          status: dto.status !== undefined,
          priority: dto.priority !== undefined,
          dueDate: dto.dueDate !== undefined,
          assignedToUserId: dto.assignedToUserId !== undefined,
        },
      },
    );

    return updated;
  }

  async removeAppointment(tenantId: string, actorId: string, id: string) {
    const current = await this.getAppointment(tenantId, id);
    await this.prisma.task.delete({ where: { id } });
    await this.audit.log(
      tenantId,
      'APPOINTMENT_DELETED',
      actorId,
      current.matterId || undefined,
      {
        ...this.auditTaskSnapshot(current),
      },
    );
    return { ok: true };
  }
}

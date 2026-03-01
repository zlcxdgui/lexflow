import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMatterDto } from './dto/create-matter.dto';
import { UpdateMatterDto } from './dto/update-matter.dto';
import { CreateMatterUpdateDto } from './dto/create-matter-update.dto';
import { UpdateMatterUpdateDto } from './dto/update-matter-update.dto';
import { AuditService } from '../audit/audit.service';
import { nextTenantCode } from '../common/tenant-code';
import { BillingService } from '../billing/billing.service';

@Injectable()
export class MattersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly billing: BillingService,
  ) {}

  private parseUpdateDate(input?: string | null) {
    if (input === undefined) return undefined;
    if (input === null) return null;
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException(
        'eventDate inválido (use ISO ou YYYY-MM-DD)',
      );
    }
    return d.toISOString();
  }

  private normalizeUpdateType(value?: string | null) {
    const v = String(value || 'GERAL')
      .trim()
      .toUpperCase();
    return v || 'GERAL';
  }

  private normalizeUpdatePayload(input: {
    updateId?: string | null;
    title?: string | null;
    description?: string | null;
    type?: string | null;
    eventDate?: string | null;
  }) {
    const title = String(input.title || '').trim();
    const description = String(input.description || '').trim();
    if (!title) {
      throw new BadRequestException('Título do andamento é obrigatório');
    }
    if (!description) {
      throw new BadRequestException('Descrição do andamento é obrigatória');
    }

    return {
      updateId: String(input.updateId || randomUUID()),
      title,
      description,
      type: this.normalizeUpdateType(input.type),
      eventDate: this.parseUpdateDate(input.eventDate),
    };
  }

  private async getUpdateHistory(
    tenantId: string,
    matterId: string,
    updateId?: string,
  ) {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        tenantId,
        matterId,
        action: {
          in: [
            'MATTER_UPDATE_ADDED',
            'MATTER_UPDATE_UPDATED',
            'MATTER_UPDATE_DELETED',
          ],
        },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    const state = new Map<
      string,
      {
        id: string;
        title: string;
        description: string;
        type: string;
        eventDate: string | null;
        createdAt: Date;
        updatedAt: Date;
        user?: { id: string; name: string; email: string } | null;
        deleted: boolean;
      }
    >();

    for (const row of rows) {
      if (!row.metaJson) continue;

      let meta: {
        updateId?: string;
        title?: string;
        description?: string;
        type?: string;
        eventDate?: string | null;
      } = {};
      try {
        meta = JSON.parse(row.metaJson) as {
          updateId?: string;
          title?: string;
          description?: string;
          type?: string;
          eventDate?: string | null;
        };
      } catch {
        continue;
      }

      const metaUpdateId = String(meta.updateId || '').trim();
      const id =
        metaUpdateId || (row.action === 'MATTER_UPDATE_ADDED' ? row.id : '');
      if (!id) continue;
      if (updateId && id !== updateId) continue;

      const current = state.get(id);

      if (row.action === 'MATTER_UPDATE_ADDED') {
        state.set(id, {
          id,
          title: String(meta.title || '').trim(),
          description: String(meta.description || '').trim(),
          type: this.normalizeUpdateType(meta.type),
          eventDate: meta.eventDate || null,
          createdAt: row.createdAt,
          updatedAt: row.createdAt,
          user: row.user,
          deleted: false,
        });
        continue;
      }

      if (!current) continue;

      if (row.action === 'MATTER_UPDATE_UPDATED') {
        current.title = String(meta.title || current.title).trim();
        current.description = String(
          meta.description || current.description,
        ).trim();
        current.type = this.normalizeUpdateType(meta.type || current.type);
        current.eventDate =
          meta.eventDate === undefined ? current.eventDate : meta.eventDate;
        current.updatedAt = row.createdAt;
        current.user = row.user;
        current.deleted = false;
      }

      if (row.action === 'MATTER_UPDATE_DELETED') {
        current.deleted = true;
        current.updatedAt = row.createdAt;
      }

      state.set(id, current);
    }

    return Array.from(state.values()).filter((item) => !item.deleted);
  }

  async list(tenantId: string) {
    return this.prisma.matter.findMany({
      where: { tenantId },
      include: {
        client: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ✅ NOVO: pega 1 caso por id (garante tenant)
  async getOne(tenantId: string, id: string) {
    const matter = await this.prisma.matter.findFirst({
      where: { id, tenantId },
      include: {
        client: { select: { id: true, name: true, code: true } },
      },
    });

    if (!matter) throw new NotFoundException('Caso não encontrado');
    return matter;
  }

  private normalizeStatus(status?: string | null) {
    const value = String(status || 'OPEN').toUpperCase();
    return value === 'CLOSED' ? 'CLOSED' : 'OPEN';
  }

  private trimOrNull(value?: string | null) {
    const text = String(value || '').trim();
    return text || null;
  }

  private async ensureClient(tenantId: string, clientId?: string | null) {
    if (!clientId) return null;
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
      select: { id: true },
    });
    if (!client) throw new NotFoundException('Pessoa do caso não encontrada');
    return client.id;
  }

  async create(
    tenantId: string,
    createdByUserId: string,
    dto: CreateMatterDto,
  ) {
    await this.billing.assertCanCreateMatter(tenantId);
    const title = String(dto.title || '').trim();
    if (!title) throw new BadRequestException('Título é obrigatório');

    const clientId = await this.ensureClient(tenantId, dto.clientId || null);

    const created = await this.prisma.$transaction(async (tx) => {
      const code = await nextTenantCode(tx, tenantId, 'MATTER');
      const created = await tx.matter.create({
        data: {
          code,
          tenantId,
          clientId,
          title,
          area: this.trimOrNull(dto.area),
          subject: this.trimOrNull(dto.subject),
          court: this.trimOrNull(dto.court),
          caseNumber: this.trimOrNull(dto.caseNumber),
          status: this.normalizeStatus(dto.status),
        },
        include: {
          client: { select: { id: true, name: true, code: true } },
        },
      });

      await tx.matterMember.create({
        data: {
          tenantId,
          matterId: created.id,
          userId: createdByUserId,
          memberRole: 'RESPONSIBLE',
        },
      });

      return created;
    });

    await this.audit.log(
      tenantId,
      'MATTER_CREATED',
      createdByUserId,
      created.id,
      {
        title: created.title,
        status: created.status,
        clientId: created.clientId,
        caseNumber: created.caseNumber,
        area: created.area,
        subject: created.subject,
        court: created.court,
      },
    );

    return created;
  }

  async update(
    tenantId: string,
    actorId: string,
    id: string,
    dto: UpdateMatterDto,
  ) {
    const current = await this.getOne(tenantId, id);
    const hasNonStatusFields =
      dto.title !== undefined ||
      dto.clientId !== undefined ||
      dto.caseNumber !== undefined ||
      dto.area !== undefined ||
      dto.subject !== undefined ||
      dto.court !== undefined;

    const title =
      dto.title !== undefined ? String(dto.title || '').trim() : undefined;
    if (title !== undefined && !title)
      throw new BadRequestException('Título é obrigatório');

    const clientId =
      dto.clientId !== undefined
        ? await this.ensureClient(tenantId, dto.clientId)
        : undefined;
    const nextStatus =
      dto.status !== undefined
        ? this.normalizeStatus(dto.status)
        : current.status;
    const statusChanged = nextStatus !== current.status;
    const statusReason = String(dto.statusReason || '').trim();

    if (!statusChanged && statusReason) {
      throw new BadRequestException(
        'Motivo só pode ser enviado quando houver mudança de status',
      );
    }

    if (current.status === 'CLOSED') {
      if (dto.status === undefined) {
        throw new BadRequestException(
          'Caso encerrado não pode ser alterado. Reabra o caso primeiro',
        );
      }
      if (nextStatus !== 'OPEN') {
        throw new BadRequestException(
          'Caso encerrado só permite ação de reabertura',
        );
      }
      if (hasNonStatusFields) {
        throw new BadRequestException(
          'Caso encerrado só pode ter o status alterado para aberto',
        );
      }
    }

    if (statusChanged && nextStatus === 'CLOSED' && !statusReason) {
      throw new BadRequestException(
        'Motivo é obrigatório para encerrar o caso',
      );
    }

    const updated = await this.prisma.matter.update({
      where: { id },
      data: {
        clientId,
        title,
        area: dto.area !== undefined ? this.trimOrNull(dto.area) : undefined,
        subject:
          dto.subject !== undefined ? this.trimOrNull(dto.subject) : undefined,
        court: dto.court !== undefined ? this.trimOrNull(dto.court) : undefined,
        caseNumber:
          dto.caseNumber !== undefined
            ? this.trimOrNull(dto.caseNumber)
            : undefined,
        status: dto.status !== undefined ? nextStatus : undefined,
      },
      include: {
        client: { select: { id: true, name: true, code: true } },
      },
    });

    if (statusChanged) {
      await this.audit.log(tenantId, 'MATTER_STATUS_CHANGED', actorId, id, {
        previousStatus: current.status,
        nextStatus,
        reason: statusReason || null,
      });
    } else {
      await this.audit.log(tenantId, 'MATTER_UPDATED', actorId, id, {
        fields: {
          title: dto.title !== undefined,
          clientId: dto.clientId !== undefined,
          caseNumber: dto.caseNumber !== undefined,
          area: dto.area !== undefined,
          subject: dto.subject !== undefined,
          court: dto.court !== undefined,
        },
      });
    }

    return updated;
  }

  async listUpdates(tenantId: string, matterId: string, limit: number) {
    await this.getOne(tenantId, matterId);
    const take =
      Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 30;

    const rows = await this.getUpdateHistory(tenantId, matterId);

    return rows
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, take)
      .map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        user: row.user,
        title: row.title || 'Andamento',
        description: row.description || '',
        type: row.type || 'GERAL',
        eventDate: row.eventDate || null,
      }));
  }

  async addUpdate(
    tenantId: string,
    matterId: string,
    actorId: string,
    dto: CreateMatterUpdateDto,
  ) {
    await this.getOne(tenantId, matterId);
    const payload = this.normalizeUpdatePayload(dto);

    const log = await this.audit.log(
      tenantId,
      'MATTER_UPDATE_ADDED',
      actorId,
      matterId,
      payload,
    );

    return {
      id: payload.updateId,
      title: payload.title,
      description: payload.description,
      type: payload.type,
      eventDate: payload.eventDate,
      createdAt: log.createdAt,
    };
  }

  async updateUpdate(
    tenantId: string,
    matterId: string,
    updateId: string,
    actorId: string,
    dto: UpdateMatterUpdateDto,
  ) {
    await this.getOne(tenantId, matterId);
    const existing = (
      await this.getUpdateHistory(tenantId, matterId, updateId)
    )[0];
    if (!existing) throw new NotFoundException('Andamento não encontrado');

    const payload = this.normalizeUpdatePayload({
      updateId,
      title: dto.title ?? existing.title,
      description: dto.description ?? existing.description,
      type: dto.type ?? existing.type,
      eventDate:
        dto.eventDate === undefined ? existing.eventDate : dto.eventDate,
    });

    const log = await this.audit.log(
      tenantId,
      'MATTER_UPDATE_UPDATED',
      actorId,
      matterId,
      {
        ...payload,
        changes: {
          title:
            existing.title !== payload.title
              ? { from: existing.title, to: payload.title }
              : null,
          description:
            existing.description !== payload.description
              ? { from: existing.description, to: payload.description }
              : null,
          type:
            existing.type !== payload.type
              ? { from: existing.type, to: payload.type }
              : null,
          eventDate:
            (existing.eventDate || null) !== (payload.eventDate || null)
              ? {
                  from: existing.eventDate || null,
                  to: payload.eventDate || null,
                }
              : null,
        },
      },
    );

    return {
      id: payload.updateId,
      title: payload.title,
      description: payload.description,
      type: payload.type,
      eventDate: payload.eventDate,
      updatedAt: log.createdAt,
    };
  }

  async removeUpdate(
    tenantId: string,
    matterId: string,
    updateId: string,
    actorId: string,
  ) {
    await this.getOne(tenantId, matterId);
    const existing = (
      await this.getUpdateHistory(tenantId, matterId, updateId)
    )[0];
    if (!existing) throw new NotFoundException('Andamento não encontrado');

    await this.audit.log(tenantId, 'MATTER_UPDATE_DELETED', actorId, matterId, {
      updateId,
      snapshot: {
        title: existing.title,
        description: existing.description,
        type: existing.type,
        eventDate: existing.eventDate || null,
      },
    });

    return { ok: true };
  }

  async listUpdateHistory(
    tenantId: string,
    matterId: string,
    updateId: string,
  ) {
    await this.getOne(tenantId, matterId);

    const rows = await this.prisma.auditLog.findMany({
      where: {
        tenantId,
        matterId,
        action: {
          in: [
            'MATTER_UPDATE_ADDED',
            'MATTER_UPDATE_UPDATED',
            'MATTER_UPDATE_DELETED',
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    const history = rows
      .map((row) => {
        if (!row.metaJson) return null;

        let meta: {
          updateId?: string;
          title?: string;
          description?: string;
          type?: string;
          eventDate?: string | null;
          changes?: Record<string, { from: unknown; to: unknown } | null>;
        } = {};
        try {
          meta = JSON.parse(row.metaJson) as {
            updateId?: string;
            title?: string;
            description?: string;
            type?: string;
            eventDate?: string | null;
            changes?: Record<string, { from: unknown; to: unknown } | null>;
          };
        } catch {
          return null;
        }

        const metaUpdateId = String(meta.updateId || '').trim();
        const effectiveUpdateId =
          metaUpdateId || (row.action === 'MATTER_UPDATE_ADDED' ? row.id : '');
        if (!effectiveUpdateId || effectiveUpdateId !== updateId) return null;

        const changeItems = Object.entries(meta.changes || {})
          .filter(([, value]) => !!value)
          .map(([field, value]) => {
            const v = value as { from: unknown; to: unknown };
            return {
              field,
              from: v.from ?? null,
              to: v.to ?? null,
            };
          });

        return {
          id: row.id,
          action: row.action,
          createdAt: row.createdAt,
          user: row.user,
          title: meta.title || null,
          description: meta.description || null,
          type: meta.type || null,
          eventDate: meta.eventDate || null,
          changes: changeItems,
        };
      })
      .filter((item) => !!item);

    return history;
  }
}

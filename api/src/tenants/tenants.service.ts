import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../audit/audit.service';
import { createHash, randomBytes, randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';
import { BillingService } from '../billing/billing.service';
import {
  calculatePasswordExpiresAt,
  validatePasswordPolicy,
} from '../auth/password-policy';
import { nextTenantCode } from '../common/tenant-code';
import {
  ALL_PERMISSIONS,
  getEffectivePermissions,
  parseGroupPermissionSelection,
} from '../auth/roles/policy';
import type { AppRole } from '../auth/roles/roles.decorator';

type MemberSettings = {
  supervisor?: boolean;
  receivesReleaseCenterNotifications?: boolean;
  blockAccessAfter?: string | null;
  passwordRotateDays?: number | null;
  language?: string;
  timezone?: string;
  modulePermissions?: string[];
  groupPermissions?: string[];
  accessScheduleEnabled?: boolean;
  accessSchedule?: Array<{
    day: number;
    start: string;
    end: string;
  }>;
};

const ALLOWED_TENANT_TIMEZONES = new Set([
  'America/Manaus',
  'America/Sao_Paulo',
]);

const SYSTEM_ACCESS_GROUPS: Array<{
  key: 'OWNER' | 'LAWYER' | 'ASSISTANT';
  name: string;
  permissions: string[];
}> = [
  {
    key: 'OWNER',
    name: 'Sócio',
    permissions: getEffectivePermissions('OWNER'),
  },
  {
    key: 'LAWYER',
    name: 'Advogado',
    permissions: getEffectivePermissions('LAWYER'),
  },
  {
    key: 'ASSISTANT',
    name: 'Assistente',
    permissions: getEffectivePermissions('ASSISTANT'),
  },
];

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly billing: BillingService,
  ) {}

  private getSessionTtlDays() {
    return Math.max(1, Number(process.env.AUTH_SESSION_TTL_DAYS || 15));
  }

  private async issueSessionToken(input: {
    userId: string;
    tenantId: string;
    role: string;
    email: string;
  }) {
    const expiresAt = new Date(
      Date.now() + this.getSessionTtlDays() * 24 * 60 * 60 * 1000,
    );
    const sessionId = randomUUID();
    if (this.prisma.authSession?.create) {
      await this.prisma.authSession.create({
        data: {
          id: sessionId,
          userId: input.userId,
          tenantId: input.tenantId,
          role: input.role,
          expiresAt,
        },
      });
    }

    const accessToken = await this.jwt.signAsync({
      sub: input.userId,
      tenantId: input.tenantId,
      role: input.role,
      sid: sessionId,
      email: input.email,
    });

    return { accessToken, sessionId };
  }

  private async requireManager(tenantId: string, userId: string) {
    const user = await this.prisma.user?.findUnique?.({
      where: { id: userId },
      select: { isPlatformAdmin: true },
    });
    if (user?.isPlatformAdmin) return 'ADMIN';

    const membership = await this.prisma.tenantMember.findFirst({
      where: { tenantId, userId, isActive: true, tenant: { isActive: true } },
      select: { role: true },
    });

    if (!membership) throw new ForbiddenException('Sem acesso ao escritório');
    if (membership.role !== 'OWNER') {
      throw new ForbiddenException(
        'Apenas sócio/admin pode gerenciar usuários',
      );
    }
    return membership.role;
  }

  private normalizeAccessGroupKey(input?: string | null) {
    const raw = String(input || '')
      .trim()
      .toUpperCase();
    if (!raw) return null;
    if (raw === 'OWNER' || raw === 'LAWYER' || raw === 'ASSISTANT') return raw;
    if (raw === 'ADMIN') return 'OWNER';
    return raw;
  }

  private normalizePermissionValues(input?: unknown) {
    if (!Array.isArray(input)) return [];
    const allowed = new Set<string>(ALL_PERMISSIONS);
    const normalized = input
      .map((value) => String(value || '').trim())
      .filter((value) => allowed.has(value));
    return Array.from(new Set(normalized));
  }

  private async ensureSystemAccessGroups(tenantId: string) {
    if (
      !this.prisma.tenantAccessGroup?.findMany ||
      !this.prisma.tenantAccessGroup?.create
    ) {
      return;
    }
    const existing = await this.prisma.tenantAccessGroup.findMany({
      where: {
        tenantId,
        key: { in: SYSTEM_ACCESS_GROUPS.map((item) => item.key) },
      },
      select: { key: true },
    });
    const existingKeys = new Set(
      existing.map((item) => item.key).filter(Boolean),
    );

    for (const group of SYSTEM_ACCESS_GROUPS) {
      if (existingKeys.has(group.key)) continue;
      const code = await nextTenantCode(
        this.prisma as any,
        tenantId,
        'ACCESS_GROUP',
      );
      await this.prisma.tenantAccessGroup.create({
        data: {
          code,
          tenantId,
          key: group.key,
          name: group.name,
          isSystem: true,
          isActive: true,
          permissions: group.permissions,
        },
      });
    }
  }

  private async getRoleAccessGroupPermissions(tenantId: string, role: AppRole) {
    if (role !== 'OWNER' && role !== 'LAWYER' && role !== 'ASSISTANT') {
      return [];
    }
    if (!this.prisma.tenantAccessGroup?.findFirst) return [];
    await this.ensureSystemAccessGroups(tenantId);
    const group = await this.prisma.tenantAccessGroup.findFirst({
      where: { tenantId, key: role, isActive: true },
      select: { permissions: true },
    });
    return group?.permissions || [];
  }

  private parseSettingsForPermissions(settingsJson?: string | null): {
    modulePermissions?: unknown;
    groupPermissions?: unknown;
  } {
    if (!settingsJson) return {};
    try {
      const parsed = JSON.parse(settingsJson) as {
        modulePermissions?: unknown;
        groupPermissions?: unknown;
      };
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private async requireTeamPermission(
    tenantId: string,
    userId: string,
    permission: 'team.read' | 'team.update' | 'team.deactivate',
  ) {
    const user = await this.prisma.user?.findUnique?.({
      where: { id: userId },
      select: { isPlatformAdmin: true },
    });
    if (user?.isPlatformAdmin) return 'ADMIN' as const;

    const membership = await this.prisma.tenantMember.findFirst({
      where: { tenantId, userId, isActive: true, tenant: { isActive: true } },
      select: { role: true, settingsJson: true },
    });
    if (!membership) throw new ForbiddenException('Sem acesso ao escritório');

    const rawRole = this.normalizeLegacyTenantRole(membership.role);
    const role =
      rawRole === 'OWNER' || rawRole === 'LAWYER' || rawRole === 'ASSISTANT'
        ? rawRole
        : 'ASSISTANT';
    const parsedSettings = this.parseSettingsForPermissions(
      membership.settingsJson,
    );
    const selectedGroups = parseGroupPermissionSelection(
      parsedSettings.groupPermissions,
    );

    let rolePermissionsOverride: string[] = [];
    let hasSelectedGroupMatch = false;
    if (selectedGroups.hasSelection) {
      const selected = await this.prisma.tenantAccessGroup.findMany({
        where: {
          tenantId,
          isActive: true,
          OR: [
            ...(selectedGroups.ids.length
              ? [{ id: { in: selectedGroups.ids } }]
              : []),
            ...(selectedGroups.keys.length
              ? [{ key: { in: selectedGroups.keys } }]
              : []),
          ],
        },
        select: { permissions: true },
      });
      hasSelectedGroupMatch = selected.length > 0;
      rolePermissionsOverride = Array.from(
        new Set((selected || []).flatMap((item) => item.permissions || [])),
      );
      if (!hasSelectedGroupMatch) {
        rolePermissionsOverride = await this.getRoleAccessGroupPermissions(
          tenantId,
          role,
        );
      }
    } else {
      rolePermissionsOverride = await this.getRoleAccessGroupPermissions(
        tenantId,
        role,
      );
    }

    const permissions = getEffectivePermissions(
      role,
      parsedSettings,
      rolePermissionsOverride,
      {
        forceRoleOverrideBase:
          selectedGroups.hasSelection && hasSelectedGroupMatch,
      },
    );
    if (!permissions.includes(permission)) {
      throw new ForbiddenException(
        'Sem autorização. Entre em contato com o responsável do escritório.',
      );
    }

    return role;
  }

  private async requireAdmin(userId: string) {
    const user = await this.prisma.user?.findUnique?.({
      where: { id: userId },
      select: { isPlatformAdmin: true },
    });
    if (user?.isPlatformAdmin) return { type: 'PLATFORM_ADMIN' as const };
    throw new ForbiddenException('Apenas admin pode executar esta ação');
  }

  async listMyTenants(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isPlatformAdmin: true },
    });
    if (user?.isPlatformAdmin) {
      const tenants = await this.prisma.tenant.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      });
      return tenants.map((tenant) => ({
        tenantId: tenant.id,
        userId,
        role: 'ADMIN',
        isActive: true,
        createdAt: tenant.createdAt,
        tenant,
      }));
    }

    return this.prisma.tenantMember.findMany({
      where: { userId, isActive: true, tenant: { isActive: true } },
      include: { tenant: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAllTenants(userId: string) {
    await this.requireAdmin(userId);

    const [tenants, activeMemberCounts] = await Promise.all([
      this.prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tenantMember.groupBy({
        by: ['tenantId'],
        where: { isActive: true },
        _count: { _all: true },
      }),
    ]);

    const countsMap = new Map(
      activeMemberCounts.map((item) => [item.tenantId, item._count._all]),
    );

    return tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      timezone: tenant.timezone || 'America/Manaus',
      createdAt: tenant.createdAt,
      isActive: tenant.isActive,
      activeMembers: countsMap.get(tenant.id) || 0,
    }));
  }

  async switchTenant(userId: string, tenantId: string) {
    await this.requireAdmin(userId);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, isActive: true },
    });
    if (!tenant) throw new NotFoundException('Escritório não encontrado');
    if (!tenant.isActive)
      throw new BadRequestException('Escritório desativado');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const { accessToken, sessionId } = await this.issueSessionToken({
      userId,
      tenantId,
      role: 'ADMIN',
      email: user.email,
    });

    await this.audit.log(tenantId, 'TENANT_SWITCHED', userId, undefined, {
      tenantId,
      role: 'ADMIN',
    });

    return {
      accessToken,
      sessionId,
      tenantId,
      role: 'ADMIN',
      email: user.email,
    };
  }

  async createTenant(userId: string, name: string, timezone?: string) {
    await this.requireAdmin(userId);
    const trimmedName = String(name || '').trim();
    if (!trimmedName) {
      throw new BadRequestException('Nome do escritório é obrigatório');
    }
    const normalizedTimezone = this.normalizeTenantTimezone(timezone);

    const tenant = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          name: trimmedName,
          timezone: normalizedTimezone,
          isActive: true,
        },
      });

      const code = await nextTenantCode(tx, created.id, 'TENANT_MEMBER');
      await tx.tenantMember.create({
        data: {
          code,
          tenantId: created.id,
          userId,
          role: 'OWNER',
          isActive: true,
        },
      });

      return created;
    });

    await this.audit.log(tenant.id, 'TENANT_CREATED', userId, undefined, {
      tenantId: tenant.id,
      tenantName: tenant.name,
      timezone: tenant.timezone || normalizedTimezone,
    });

    return tenant;
  }

  async renameTenant(
    userId: string,
    tenantId: string,
    name?: string,
    timezone?: string,
  ) {
    await this.requireAdmin(userId);
    const hasName = name !== undefined;
    const hasTimezone = timezone !== undefined;
    if (!hasName && !hasTimezone) {
      throw new BadRequestException('Informe ao menos nome ou fuso horário');
    }
    const trimmedName = hasName ? String(name || '').trim() : undefined;
    if (hasName && !trimmedName) {
      throw new BadRequestException('Nome do escritório é obrigatório');
    }
    const normalizedTimezone = hasTimezone
      ? this.normalizeTenantTimezone(timezone)
      : undefined;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, timezone: true },
    });
    if (!tenant) throw new NotFoundException('Escritório não encontrado');

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(trimmedName ? { name: trimmedName } : {}),
        ...(normalizedTimezone ? { timezone: normalizedTimezone } : {}),
      },
    });

    await this.audit.log(tenantId, 'TENANT_RENAMED', userId, undefined, {
      tenantId,
      previousName: tenant.name,
      nextName: updated.name,
      previousTimezone: tenant.timezone || 'America/Manaus',
      nextTimezone: updated.timezone || 'America/Manaus',
    });

    return updated;
  }

  async setTenantStatus(userId: string, tenantId: string, isActive: boolean) {
    await this.requireAdmin(userId);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, isActive: true },
    });
    if (!tenant) throw new NotFoundException('Escritório não encontrado');

    if (tenant.isActive === isActive) {
      throw new BadRequestException(
        isActive ? 'Escritório já está ativo' : 'Escritório já está desativado',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenantId },
        data: { isActive },
      });

      if (!isActive) {
        await tx.tenantMember.updateMany({
          where: { tenantId, isActive: true },
          data: { isActive: false },
        });
        await tx.tenantInvite.updateMany({
          where: { tenantId, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
      } else {
        const membership = await tx.tenantMember.findFirst({
          where: { tenantId, userId },
          select: { id: true },
        });
        if (membership) {
          await tx.tenantMember.update({
            where: { id: membership.id },
            data: { isActive: true },
          });
        } else {
          const code = await nextTenantCode(tx, tenantId, 'TENANT_MEMBER');
          await tx.tenantMember.create({
            data: { code, tenantId, userId, role: 'OWNER', isActive: true },
          });
        }
      }
    });

    await this.audit.log(tenantId, 'TENANT_STATUS_UPDATED', userId, undefined, {
      tenantId,
      tenantName: tenant.name,
      isActive,
    });

    return { tenantId, isActive };
  }

  async listMembers(tenantId: string, userId: string) {
    const actorRole = await this.requireTeamPermission(
      tenantId,
      userId,
      'team.read',
    );
    const ownersCount = await this.prisma.tenantMember.count({
      where: { tenantId, role: 'OWNER', isActive: true },
    });

    const members = await this.prisma.tenantMember.findMany({
      where: {
        tenantId,
        ...(actorRole === 'ADMIN'
          ? {}
          : { user: { is: { isPlatformAdmin: false } } }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            failedLoginAttempts: true,
            lockedUntil: true,
          },
        },
        tenant: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return members.map((member) => {
      const role = this.normalizeLegacyTenantRole(member.role);
      const isSelf = member.userId === userId;
      const isLastActiveOwner =
        member.isActive && role === 'OWNER' && ownersCount <= 1;
      return {
        ...member,
        role,
        isTemporarilyLocked: Boolean(
          member.user.lockedUntil &&
          member.user.lockedUntil.getTime() > Date.now(),
        ),
        permissions: {
          isSelf,
          isLastActiveOwner,
          canChangeRole: !isSelf && !isLastActiveOwner,
          canDeactivate: !isSelf && member.isActive && !isLastActiveOwner,
        },
      };
    });
  }

  async listPendingInvites(tenantId: string, userId: string) {
    await this.requireTeamPermission(tenantId, userId, 'team.read');
    const invites = await this.prisma.tenantInvite.findMany({
      where: {
        tenantId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    const mapped = await Promise.all(
      invites.map(async (invite) => ({
        id: invite.id,
        email: invite.invitedEmail,
        role: this.normalizeLegacyTenantRole(invite.role),
        expiresAt: invite.expiresAt,
        fullName: await this.resolveInviteFullName(
          tenantId,
          invite.invitedEmail,
          invite.id,
        ),
      })),
    );

    return mapped;
  }

  async resendPendingInvite(
    tenantId: string,
    userId: string,
    inviteId: string,
  ) {
    await this.requireTeamPermission(tenantId, userId, 'team.update');
    const invite = await this.prisma.tenantInvite.findFirst({
      where: { id: inviteId, tenantId },
    });
    if (!invite) throw new NotFoundException('Convite pendente não encontrado');
    if (
      invite.status !== 'PENDING' ||
      invite.expiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException('Convite não está pendente');
    }

    await this.prisma.tenantInvite.update({
      where: { id: invite.id },
      data: { status: 'CANCELLED' },
    });

    const token = randomBytes(24).toString('hex');
    const tokenHash = this.hashInviteToken(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    const safeRole = this.normalizeRole(invite.role);
    const renewed = await this.prisma.tenantInvite.create({
      data: {
        tenantId,
        invitedByUserId: userId,
        invitedEmail: invite.invitedEmail,
        inviteEmployeeClientId: invite.inviteEmployeeClientId || null,
        role: safeRole,
        inviteSettingsJson: invite.inviteSettingsJson || null,
        tokenHash,
        expiresAt,
        status: 'PENDING',
      },
    });

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });
    const fullName = await this.resolveInviteFullName(
      tenantId,
      invite.invitedEmail,
      invite.id,
    );
    const webAppUrl = (
      process.env.WEB_APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3001'
    ).replace(/\/+$/, '');
    const inviteUrl = `${webAppUrl}/invite/${token}`;
    await this.mail.sendInvite({
      to: invite.invitedEmail,
      fullName,
      tenantName: tenant?.name || 'LexFlow',
      role: safeRole,
      inviteUrl,
    });

    await this.audit.log(tenantId, 'TENANT_INVITE_RESENT', userId, undefined, {
      oldInviteId: invite.id,
      newInviteId: renewed.id,
      invitedEmail: invite.invitedEmail,
      fullName,
    });

    return {
      message: 'Convite reenviado por e-mail',
      inviteId: renewed.id,
      expiresAt: renewed.expiresAt.toISOString(),
    };
  }

  async cancelPendingInvite(
    tenantId: string,
    userId: string,
    inviteId: string,
  ) {
    await this.requireTeamPermission(tenantId, userId, 'team.update');
    const invite = await this.prisma.tenantInvite.findFirst({
      where: { id: inviteId, tenantId },
    });
    if (!invite) throw new NotFoundException('Convite pendente não encontrado');
    if (invite.status !== 'PENDING')
      throw new BadRequestException('Convite não está pendente');

    await this.prisma.tenantInvite.update({
      where: { id: invite.id },
      data: { status: 'CANCELLED' },
    });

    await this.audit.log(
      tenantId,
      'TENANT_INVITE_CANCELLED',
      userId,
      undefined,
      {
        inviteId: invite.id,
        invitedEmail: invite.invitedEmail,
      },
    );

    return { message: 'Convite pendente cancelado' };
  }

  async listAccessGroups(tenantId: string, userId: string) {
    await this.requireTeamPermission(tenantId, userId, 'team.read');
    await this.ensureSystemAccessGroups(tenantId);
    return this.prisma.tenantAccessGroup.findMany({
      where: { tenantId },
      orderBy: [{ isSystem: 'desc' }, { code: 'asc' }],
    });
  }

  async createAccessGroup(
    tenantId: string,
    userId: string,
    dto: {
      name?: string;
      key?: string | null;
      isActive?: boolean;
      permissions?: string[];
    },
  ) {
    await this.requireTeamPermission(tenantId, userId, 'team.update');
    await this.ensureSystemAccessGroups(tenantId);

    const name = String(dto?.name || '').trim();
    if (!name) throw new BadRequestException('Nome do grupo é obrigatório');
    const key = this.normalizeAccessGroupKey(dto?.key);
    const permissions = this.normalizePermissionValues(dto?.permissions);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const code = await nextTenantCode(tx, tenantId, 'ACCESS_GROUP');
        return tx.tenantAccessGroup.create({
          data: {
            code,
            tenantId,
            key,
            name,
            isSystem:
              key === 'OWNER' || key === 'LAWYER' || key === 'ASSISTANT',
            isActive: dto?.isActive ?? true,
            permissions,
          },
        });
      });
      await this.audit.log(
        tenantId,
        'TEAM_ACCESS_GROUP_CREATED',
        userId,
        undefined,
        {
          groupId: created.id,
          key: created.key,
          name: created.name,
          permissions: created.permissions,
        },
      );
      return created;
    } catch {
      throw new BadRequestException(
        'Já existe grupo com essa chave neste escritório',
      );
    }
  }

  async updateAccessGroup(
    tenantId: string,
    userId: string,
    groupId: string,
    dto: { name?: string; isActive?: boolean; permissions?: string[] },
  ) {
    await this.requireTeamPermission(tenantId, userId, 'team.update');
    await this.ensureSystemAccessGroups(tenantId);

    const current = await this.prisma.tenantAccessGroup.findFirst({
      where: { id: groupId, tenantId },
    });
    if (!current) throw new NotFoundException('Grupo de acesso não encontrado');

    const nextName =
      dto?.name !== undefined ? String(dto.name || '').trim() : current.name;
    if (!nextName) throw new BadRequestException('Nome do grupo é obrigatório');
    const nextPermissions =
      dto?.permissions !== undefined
        ? this.normalizePermissionValues(dto.permissions)
        : current.permissions;

    const updated = await this.prisma.tenantAccessGroup.update({
      where: { id: groupId },
      data: {
        name: nextName,
        isActive: dto?.isActive ?? current.isActive,
        permissions: nextPermissions,
      },
    });

    await this.audit.log(
      tenantId,
      'TEAM_ACCESS_GROUP_UPDATED',
      userId,
      undefined,
      {
        groupId: updated.id,
        key: updated.key,
        name: updated.name,
        isActive: updated.isActive,
        permissions: updated.permissions,
      },
    );

    return updated;
  }

  async deleteAccessGroup(tenantId: string, userId: string, groupId: string) {
    await this.requireTeamPermission(tenantId, userId, 'team.update');
    const current = await this.prisma.tenantAccessGroup.findFirst({
      where: { id: groupId, tenantId },
    });
    if (!current) throw new NotFoundException('Grupo de acesso não encontrado');
    if (current.isSystem) {
      throw new BadRequestException(
        'Grupos padrão (Sócio, Advogado e Assistente) não podem ser removidos',
      );
    }

    await this.prisma.tenantAccessGroup.delete({ where: { id: groupId } });
    await this.audit.log(
      tenantId,
      'TEAM_ACCESS_GROUP_DELETED',
      userId,
      undefined,
      {
        groupId: current.id,
        key: current.key,
        name: current.name,
      },
    );
    return { ok: true };
  }

  private normalizeRole(role: string) {
    const value = String(role || '').toUpperCase();
    if (value === 'ADMIN') return 'OWNER';
    if (value !== 'OWNER' && value !== 'LAWYER' && value !== 'ASSISTANT') {
      throw new BadRequestException('Permissão inválida');
    }
    return value;
  }

  private normalizeLegacyTenantRole(role: string) {
    return String(role || '').toUpperCase() === 'ADMIN' ? 'OWNER' : role;
  }

  private normalizeTenantTimezone(timezone?: string | null) {
    const value = String(timezone || '').trim();
    if (!value) return 'America/Manaus';
    if (!ALLOWED_TENANT_TIMEZONES.has(value)) {
      throw new BadRequestException('Fuso horário do escritório inválido');
    }
    return value;
  }

  private parseMemberSettings(settingsJson?: string | null): MemberSettings {
    if (!settingsJson) return {};
    try {
      const parsed = JSON.parse(settingsJson) as MemberSettings;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private async getTenantTimezone(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    });
    return this.normalizeTenantTimezone(tenant?.timezone || 'America/Manaus');
  }

  private normalizeMemberSettings(
    settings?: MemberSettings,
    defaultTimezone = 'America/Manaus',
  ): MemberSettings {
    return {
      supervisor: Boolean(settings?.supervisor),
      receivesReleaseCenterNotifications: Boolean(
        settings?.receivesReleaseCenterNotifications,
      ),
      blockAccessAfter: settings?.blockAccessAfter || null,
      passwordRotateDays:
        settings?.passwordRotateDays != null
          ? Math.max(0, Number(settings.passwordRotateDays))
          : null,
      language: String(settings?.language || 'pt-BR'),
      timezone: String(
        settings?.timezone || defaultTimezone || 'America/Manaus',
      ),
      modulePermissions: Array.isArray(settings?.modulePermissions)
        ? settings.modulePermissions.map((v) => String(v)).slice(0, 200)
        : [],
      groupPermissions: Array.isArray(settings?.groupPermissions)
        ? settings.groupPermissions.map((v) => String(v)).slice(0, 200)
        : [],
      accessScheduleEnabled: Boolean(settings?.accessScheduleEnabled),
      accessSchedule: Array.isArray(settings?.accessSchedule)
        ? settings.accessSchedule
            .map((item) => ({
              day: Number(item?.day),
              start: String(item?.start || ''),
              end: String(item?.end || ''),
            }))
            .filter(
              (item) =>
                Number.isInteger(item.day) &&
                item.day >= 0 &&
                item.day <= 6 &&
                /^\d{2}:\d{2}$/.test(item.start) &&
                /^\d{2}:\d{2}$/.test(item.end),
            )
            .slice(0, 14)
        : [],
    };
  }

  private hashInviteToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async ensureOwnerSafety(
    tenantId: string,
    memberToChange: { userId: string; role: string; isActive: boolean },
    next: { role: string; isActive: boolean },
  ) {
    const isOwnerToday =
      memberToChange.role === 'OWNER' && memberToChange.isActive;
    if (!isOwnerToday) return;

    const owners = await this.prisma.tenantMember.count({
      where: { tenantId, role: 'OWNER', isActive: true },
    });

    const roleChanged = next.role !== memberToChange.role;
    const activeChanged = next.isActive !== memberToChange.isActive;

    if (owners <= 1 && (roleChanged || activeChanged)) {
      throw new BadRequestException(
        'O último sócio ativo não pode ser alterado',
      );
    }

    const isOwnerNext = next.role === 'OWNER' && next.isActive;
    if (isOwnerNext) return;

    if (owners <= 1) {
      throw new BadRequestException(
        'O escritório precisa manter ao menos um sócio ativo',
      );
    }
  }

  private async ensureValidEmployeeBinding(
    tenantId: string,
    employeeClientId: string,
    options?: { excludeMemberId?: string; excludeInviteId?: string },
  ) {
    const normalizedEmployeeClientId = String(employeeClientId || '').trim();
    if (!normalizedEmployeeClientId) {
      throw new BadRequestException('Funcionário é obrigatório');
    }

    const employee = await this.prisma.client.findFirst({
      where: {
        id: normalizedEmployeeClientId,
        tenantId,
        relacoesComerciais: { has: 'FUNCIONARIO' },
      },
      select: { id: true },
    });
    if (!employee) {
      throw new BadRequestException(
        'Funcionário inválido para este escritório',
      );
    }

    const existingMember = await this.prisma.tenantMember.findFirst({
      where: {
        tenantId,
        employeeClientId: normalizedEmployeeClientId,
        ...(options?.excludeMemberId
          ? { id: { not: options.excludeMemberId } }
          : {}),
      },
      select: { id: true },
    });
    if (existingMember) {
      throw new BadRequestException(
        'Este funcionário já está vinculado a outro usuário',
      );
    }

    const existingInvite = await this.prisma.tenantInvite.findFirst({
      where: {
        tenantId,
        inviteEmployeeClientId: normalizedEmployeeClientId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
        ...(options?.excludeInviteId
          ? { id: { not: options.excludeInviteId } }
          : {}),
      },
      select: { id: true },
    });
    if (existingInvite) {
      throw new BadRequestException(
        'Este funcionário já possui convite pendente',
      );
    }

    return normalizedEmployeeClientId;
  }

  async addMember(
    tenantId: string,
    userId: string,
    email: string,
    role: string,
    fullName?: string,
    employeeClientId?: string,
    settings?: MemberSettings,
  ) {
    await this.billing.assertCanCreateUser(tenantId);
    const actorRole = await this.requireTeamPermission(
      tenantId,
      userId,
      'team.update',
    );
    const normalized = email.trim().toLowerCase();
    const safeRole = this.normalizeRole(role);
    const normalizedEmployeeClientId = await this.ensureValidEmployeeBinding(
      tenantId,
      employeeClientId || '',
    );
    if (safeRole === 'OWNER' && actorRole !== 'ADMIN') {
      throw new BadRequestException(
        'Convite de sócio deve ser feito promovendo um membro já ativo',
      );
    }

    const existing = await this.prisma.tenantMember.findFirst({
      where: {
        tenantId,
        user: { email: normalized },
      },
    });
    if (existing) {
      if (existing.isActive) {
        throw new BadRequestException('Usuário já existe no escritório');
      }
      throw new BadRequestException(
        'Usuário já existe no escritório, use Reativar',
      );
    }

    const pendingInvite = await this.prisma.tenantInvite.findFirst({
      where: {
        tenantId,
        invitedEmail: normalized,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });
    if (pendingInvite) {
      throw new BadRequestException(
        'Já existe convite pendente para este usuário',
      );
    }

    const token = randomBytes(24).toString('hex');
    const tokenHash = this.hashInviteToken(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    const tenantTimezone = await this.getTenantTimezone(tenantId);
    const normalizedSettings = this.normalizeMemberSettings(
      settings,
      tenantTimezone,
    );
    const invite = await this.prisma.tenantInvite.create({
      data: {
        tenantId,
        invitedByUserId: userId,
        invitedEmail: normalized,
        inviteEmployeeClientId: normalizedEmployeeClientId,
        role: safeRole,
        inviteSettingsJson: JSON.stringify(normalizedSettings),
        tokenHash,
        expiresAt,
        status: 'PENDING',
      },
    });

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, timezone: true },
    });
    const resolvedFullName =
      (fullName || '').trim() ||
      (await this.resolveInviteFullName(tenantId, normalized, invite.id));
    const webAppUrl = (
      process.env.WEB_APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3001'
    ).replace(/\/+$/, '');
    const inviteUrl = `${webAppUrl}/invite/${token}`;
    await this.mail.sendInvite({
      to: normalized,
      fullName: resolvedFullName,
      tenantName: tenant?.name || 'LexFlow',
      role: safeRole,
      inviteUrl,
    });

    await this.audit.log(tenantId, 'TENANT_MEMBER_INVITED', userId, undefined, {
      inviteId: invite.id,
      invitedEmail: normalized,
      role: safeRole,
      fullName: resolvedFullName,
      inviteSettings: normalizedSettings,
    });

    return {
      kind: 'INVITE_CREATED',
      message: 'Convite enviado por e-mail',
      invitedEmail: normalized,
      fullName: resolvedFullName,
      inviteSettings: normalizedSettings,
      expiresAt: invite.expiresAt.toISOString(),
    };
  }

  async updateMember(
    tenantId: string,
    actorId: string,
    memberId: string,
    data: { role?: string; isActive?: boolean },
  ) {
    await this.requireTeamPermission(tenantId, actorId, 'team.update');

    const member = await this.prisma.tenantMember.findFirst({
      where: { id: memberId, tenantId },
    });
    if (!member) throw new NotFoundException('Membro não encontrado');
    const nextRole = data.role
      ? this.normalizeRole(data.role)
      : this.normalizeLegacyTenantRole(member.role);
    const nextIsActive = data.isActive ?? member.isActive;
    if (data.isActive !== undefined && data.isActive !== member.isActive) {
      await this.requireTeamPermission(tenantId, actorId, 'team.deactivate');
    }

    if (member.userId === actorId && nextRole !== member.role) {
      throw new BadRequestException('Você não pode alterar o próprio cargo');
    }

    if (member.userId === actorId && nextIsActive === false) {
      throw new BadRequestException(
        'Você não pode desativar o próprio usuário',
      );
    }

    await this.ensureOwnerSafety(
      tenantId,
      {
        userId: member.userId,
        role: this.normalizeLegacyTenantRole(member.role),
        isActive: member.isActive,
      },
      { role: nextRole, isActive: nextIsActive },
    );

    const updated = await this.prisma.tenantMember.update({
      where: { id: memberId },
      data: {
        role: nextRole,
        isActive: nextIsActive,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    await this.audit.log(
      tenantId,
      'TENANT_MEMBER_UPDATED',
      actorId,
      undefined,
      {
        memberId,
        targetUserId: updated.user.id,
        prevRole: this.normalizeLegacyTenantRole(member.role),
        nextRole,
        prevIsActive: member.isActive,
        nextIsActive,
      },
    );

    return updated;
  }

  private async memberCanEditEmail(tenantId: string, email: string) {
    const pending = await this.prisma.tenantInvite.findFirst({
      where: {
        tenantId,
        invitedEmail: email.toLowerCase(),
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });
    return Boolean(pending);
  }

  async getMember(tenantId: string, actorId: string, memberId: string) {
    const actorRole = await this.requireTeamPermission(
      tenantId,
      actorId,
      'team.read',
    );

    const member = await this.prisma.tenantMember.findFirst({
      where: { id: memberId, tenantId },
      include: {
        user: {
          select: { id: true, name: true, email: true, isPlatformAdmin: true },
        },
      },
    });
    if (!member) throw new NotFoundException('Membro não encontrado');
    if (member.user.isPlatformAdmin && actorRole !== 'ADMIN') {
      throw new NotFoundException('Membro não encontrado');
    }

    const canEditEmail = await this.memberCanEditEmail(
      tenantId,
      member.user.email,
    );
    return {
      id: member.id,
      role: this.normalizeLegacyTenantRole(member.role),
      isActive: member.isActive,
      employeeClientId: member.employeeClientId || null,
      user: member.user,
      canEditEmail,
      settings: this.parseMemberSettings(member.settingsJson),
      tenantTimezone: await this.getTenantTimezone(tenantId),
    };
  }

  async updateMemberSettings(
    tenantId: string,
    actorId: string,
    memberId: string,
    settings: MemberSettings,
  ) {
    await this.requireTeamPermission(tenantId, actorId, 'team.update');
    const member = await this.prisma.tenantMember.findFirst({
      where: { id: memberId, tenantId },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!member) throw new NotFoundException('Membro não encontrado');

    const tenantTimezone = await this.getTenantTimezone(tenantId);
    const normalized = this.normalizeMemberSettings(settings, tenantTimezone);

    await this.prisma.tenantMember.update({
      where: { id: memberId },
      data: { settingsJson: JSON.stringify(normalized) },
    });

    await this.audit.log(
      tenantId,
      'TENANT_MEMBER_SETTINGS_UPDATED',
      actorId,
      undefined,
      {
        memberId,
        targetUserId: member.user.id,
        targetEmail: member.user.email,
        settings: normalized,
      },
    );

    return { ok: true, settings: normalized };
  }

  async updateMemberProfile(
    tenantId: string,
    actorId: string,
    memberId: string,
    dto: { name?: string; email?: string; employeeClientId?: string },
  ) {
    await this.requireTeamPermission(tenantId, actorId, 'team.update');

    const member = await this.prisma.tenantMember.findFirst({
      where: { id: memberId, tenantId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
    if (!member) throw new NotFoundException('Membro não encontrado');

    const nextName = dto?.name?.trim();
    const nextEmail = dto?.email?.trim().toLowerCase();
    if (!nextName) throw new BadRequestException('Nome é obrigatório');
    const normalizedEmployeeClientId = await this.ensureValidEmployeeBinding(
      tenantId,
      dto.employeeClientId || member.employeeClientId || '',
      { excludeMemberId: member.id },
    );

    const canEditEmail = await this.memberCanEditEmail(
      tenantId,
      member.user.email,
    );
    if (nextEmail && nextEmail !== member.user.email && !canEditEmail) {
      throw new BadRequestException(
        'Email não pode ser alterado após ativação do usuário',
      );
    }

    if (nextEmail && nextEmail !== member.user.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: nextEmail },
      });
      if (existingUser && existingUser.id !== member.user.id) {
        throw new BadRequestException('Email já cadastrado');
      }
    }

    const [updatedUser] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: member.user.id },
        data: {
          name: nextName,
          email: nextEmail && canEditEmail ? nextEmail : member.user.email,
        },
        select: { id: true, name: true, email: true },
      }),
      this.prisma.tenantMember.update({
        where: { id: member.id },
        data: { employeeClientId: normalizedEmployeeClientId },
        select: { id: true },
      }),
    ]);

    await this.audit.log(
      tenantId,
      'TENANT_MEMBER_PROFILE_UPDATED',
      actorId,
      undefined,
      {
        memberId,
        targetUserId: updatedUser.id,
        previousName: member.user.name,
        nextName: updatedUser.name,
        previousEmail: member.user.email,
        nextEmail: updatedUser.email,
        employeeClientId: normalizedEmployeeClientId,
      },
    );

    return {
      memberId,
      user: updatedUser,
      employeeClientId: normalizedEmployeeClientId,
    };
  }

  async resendActivation(tenantId: string, actorId: string, memberId: string) {
    await this.requireTeamPermission(tenantId, actorId, 'team.update');

    const member = await this.prisma.tenantMember.findFirst({
      where: { id: memberId, tenantId },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!member) throw new NotFoundException('Membro não encontrado');

    const canEditEmail = await this.memberCanEditEmail(
      tenantId,
      member.user.email,
    );
    if (!canEditEmail) {
      throw new BadRequestException('Usuário já ativou o acesso');
    }

    await this.prisma.tenantInvite.updateMany({
      where: {
        tenantId,
        invitedEmail: member.user.email.toLowerCase(),
        status: 'PENDING',
      },
      data: { status: 'CANCELLED' },
    });

    const token = randomBytes(24).toString('hex');
    const tokenHash = this.hashInviteToken(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    const safeRole = this.normalizeRole(member.role);
    const invite = await this.prisma.tenantInvite.create({
      data: {
        tenantId,
        invitedByUserId: actorId,
        invitedEmail: member.user.email.toLowerCase(),
        inviteEmployeeClientId: member.employeeClientId || null,
        role: safeRole,
        inviteSettingsJson: member.settingsJson || null,
        tokenHash,
        expiresAt,
        status: 'PENDING',
      },
    });

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });
    const fullName = await this.resolveInviteFullName(
      tenantId,
      member.user.email,
      invite.id,
    );
    const webAppUrl = (
      process.env.WEB_APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3001'
    ).replace(/\/+$/, '');
    const inviteUrl = `${webAppUrl}/invite/${token}`;
    await this.mail.sendInvite({
      to: member.user.email.toLowerCase(),
      fullName,
      tenantName: tenant?.name || 'LexFlow',
      role: safeRole,
      inviteUrl,
    });

    await this.audit.log(
      tenantId,
      'TENANT_MEMBER_ACTIVATION_RESENT',
      actorId,
      undefined,
      {
        memberId,
        inviteId: invite.id,
        invitedEmail: member.user.email,
        fullName,
      },
    );

    return {
      message: 'E-mail de ativação reenviado',
      expiresAt: expiresAt.toISOString(),
    };
  }

  async unlockMember(tenantId: string, actorId: string, memberId: string) {
    await this.requireTeamPermission(tenantId, actorId, 'team.update');

    const member = await this.prisma.tenantMember.findFirst({
      where: { id: memberId, tenantId },
      include: {
        user: { select: { id: true, email: true, lockedUntil: true } },
      },
    });
    if (!member) throw new NotFoundException('Membro não encontrado');

    await this.prisma.user.update({
      where: { id: member.user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    await this.audit.log(
      tenantId,
      'TENANT_MEMBER_UNLOCKED',
      actorId,
      undefined,
      {
        memberId,
        targetUserId: member.user.id,
        targetEmail: member.user.email,
        previousLockedUntil: member.user.lockedUntil
          ? member.user.lockedUntil.toISOString()
          : null,
      },
    );

    return { message: 'Usuário desbloqueado com sucesso.' };
  }

  async getInviteByToken(token: string) {
    const invite = await this.prisma.tenantInvite.findFirst({
      where: { tokenHash: this.hashInviteToken(token) },
      include: { tenant: { select: { id: true, name: true } } },
    });
    if (!invite) throw new NotFoundException('Convite inválido');
    if (invite.status !== 'PENDING')
      throw new BadRequestException('Convite não está pendente');
    if (invite.expiresAt.getTime() < Date.now())
      throw new BadRequestException('Convite expirado');

    const fullName = await this.resolveInviteFullName(
      invite.tenantId,
      invite.invitedEmail,
      invite.id,
    );

    return {
      email: invite.invitedEmail,
      fullName,
      role: this.normalizeLegacyTenantRole(invite.role),
      tenant: invite.tenant,
      expiresAt: invite.expiresAt,
    };
  }

  private async resolveInviteFullName(
    tenantId: string,
    invitedEmail: string,
    inviteId?: string,
  ) {
    if (inviteId) {
      const inviteLogs = await this.prisma.auditLog.findMany({
        where: {
          tenantId,
          action: {
            in: [
              'TENANT_MEMBER_INVITED',
              'TENANT_INVITE_RESENT',
              'TENANT_MEMBER_ACTIVATION_RESENT',
            ],
          },
          metaJson: { contains: inviteId },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      for (const log of inviteLogs) {
        if (!log.metaJson) continue;
        try {
          const meta: unknown = JSON.parse(log.metaJson);
          const fromMeta =
            typeof meta === 'object' &&
            meta !== null &&
            'fullName' in meta &&
            typeof (meta as { fullName?: unknown }).fullName === 'string'
              ? (meta as { fullName: string }).fullName.trim()
              : '';
          if (fromMeta) return fromMeta;
        } catch {
          // ignore invalid audit payload
        }
      }
    }

    const normalized = invitedEmail.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      select: { name: true },
    });
    if (user?.name?.trim()) return user.name.trim();

    const client = await this.prisma.client.findFirst({
      where: { tenantId, email: normalized },
      select: { name: true, razaoSocial: true, nomeFantasia: true },
      orderBy: { createdAt: 'desc' },
    });
    if (client?.name?.trim()) return client.name.trim();
    if (client?.razaoSocial?.trim()) return client.razaoSocial.trim();
    if (client?.nomeFantasia?.trim()) return client.nomeFantasia.trim();

    return invitedEmail.split('@')[0] || invitedEmail;
  }

  async acceptInvite(token: string, password: string) {
    if (!token || !password) {
      throw new BadRequestException('Dados inválidos para aceitar convite');
    }
    validatePasswordPolicy(password);

    const invite = await this.prisma.tenantInvite.findFirst({
      where: { tokenHash: this.hashInviteToken(token) },
    });
    if (!invite) throw new NotFoundException('Convite inválido');
    if (invite.status === 'ACCEPTED') {
      const user =
        (invite.acceptedByUserId
          ? await this.prisma.user.findUnique({
              where: { id: invite.acceptedByUserId },
            })
          : null) ||
        (await this.prisma.user.findUnique({
          where: { email: invite.invitedEmail },
        }));

      if (!user)
        throw new BadRequestException(
          'Convite já aceito, mas usuário não encontrado',
        );

      const membership = await this.prisma.tenantMember.findFirst({
        where: { tenantId: invite.tenantId, userId: user.id, isActive: true },
      });
      if (!membership)
        throw new BadRequestException(
          'Convite já aceito, mas vínculo do usuário está inativo',
        );

      const role = this.normalizeLegacyTenantRole(membership.role);
      const { accessToken, sessionId } = await this.issueSessionToken({
        userId: user.id,
        tenantId: invite.tenantId,
        role,
        email: user.email,
      });

      return {
        accessToken,
        sessionId,
        tenantId: invite.tenantId,
        role,
        user: { id: user.id, name: user.name, email: user.email },
      };
    }

    if (invite.status !== 'PENDING')
      throw new BadRequestException('Convite não está pendente');
    if (invite.expiresAt.getTime() < Date.now())
      throw new BadRequestException('Convite expirado');

    const passwordHash = await bcrypt.hash(password, 10);

    const fallbackName = await this.resolveInviteFullName(
      invite.tenantId,
      invite.invitedEmail,
      invite.id,
    );
    const safeInviteRole = this.normalizeRole(invite.role);
    const inviteEmployeeClientId = String(
      invite.inviteEmployeeClientId || '',
    ).trim();
    if (!inviteEmployeeClientId) {
      throw new BadRequestException(
        'Convite sem funcionário vinculado. Refaça o convite.',
      );
    }
    const inviteSettingsJson = invite.inviteSettingsJson || null;

    const result = await this.prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({
        where: { email: invite.invitedEmail },
      });
      if (!user) {
        user = await tx.user.create({
          data: {
            email: invite.invitedEmail,
            name: fallbackName,
            passwordHash,
            passwordChangedAt: new Date(),
            passwordExpiresAt: calculatePasswordExpiresAt(new Date()),
          },
        });
      }

      const membership = await tx.tenantMember.findFirst({
        where: { tenantId: invite.tenantId, userId: user.id },
      });

      if (!membership) {
        const code = await nextTenantCode(tx, invite.tenantId, 'TENANT_MEMBER');
        await tx.tenantMember.create({
          data: {
            code,
            tenantId: invite.tenantId,
            userId: user.id,
            employeeClientId: inviteEmployeeClientId,
            role: safeInviteRole,
            isActive: true,
            settingsJson: inviteSettingsJson,
          },
        });
      } else if (!membership.isActive) {
        await tx.tenantMember.update({
          where: { id: membership.id },
          data: {
            employeeClientId: inviteEmployeeClientId,
            isActive: true,
            role: safeInviteRole,
            settingsJson: inviteSettingsJson || membership.settingsJson,
          },
        });
      } else {
        await tx.tenantMember.update({
          where: { id: membership.id },
          data: {
            employeeClientId: inviteEmployeeClientId,
            role: safeInviteRole,
            settingsJson: inviteSettingsJson || membership.settingsJson,
          },
        });
      }

      await tx.tenantInvite.update({
        where: { id: invite.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          acceptedByUserId: user.id,
        },
      });

      return { user };
    });

    try {
      await this.audit.log(
        invite.tenantId,
        'TENANT_INVITE_ACCEPTED',
        result.user.id,
        undefined,
        {
          inviteId: invite.id,
          email: invite.invitedEmail,
          role: safeInviteRole,
        },
      );
    } catch {
      // Auditoria não deve bloquear aceite do convite.
    }

    const { accessToken, sessionId } = await this.issueSessionToken({
      userId: result.user.id,
      tenantId: invite.tenantId,
      role: safeInviteRole,
      email: result.user.email,
    });

    return {
      accessToken,
      sessionId,
      tenantId: invite.tenantId,
      role: safeInviteRole,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
      },
    };
  }
}

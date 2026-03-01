import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { AuditService } from '../audit/audit.service';
import {
  calculatePasswordExpiresAt,
  validatePasswordPolicy,
} from '../auth/password-policy';
import { nextTenantCode } from '../common/tenant-code';
import { BillingService } from '../billing/billing.service';

const userSafeSelect = {
  id: true,
  name: true,
  email: true,
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly billing: BillingService,
  ) {}

  private normalizeTenantRoleForCreate(role?: string) {
    const value = String(role || '')
      .trim()
      .toUpperCase();
    if (value === 'ADMIN') {
      throw new BadRequestException('Sem permissão para criar usuário admin');
    }
    if (value === 'OWNER' || value === 'LAWYER' || value === 'ASSISTANT') {
      return value;
    }
    return 'LAWYER';
  }

  private normalizeLegacyTenantRole(role?: string) {
    if (
      String(role || '')
        .trim()
        .toUpperCase() === 'ADMIN'
    )
      return 'OWNER';
    return role;
  }

  async createInTenant(tenantId: string, dto: CreateUserDto) {
    await this.billing.assertCanCreateUser(tenantId);
    const email = dto.email.trim().toLowerCase();
    const role = this.normalizeTenantRoleForCreate(dto.role);

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('Email já cadastrado');
    validatePasswordPolicy(dto.password);

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const passwordChangedAt = new Date();

    const { user } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: dto.name.trim(),
          email,
          passwordHash,
          passwordChangedAt,
          passwordExpiresAt: calculatePasswordExpiresAt(passwordChangedAt),
        },
      });

      const code = await nextTenantCode(tx, tenantId, 'TENANT_MEMBER');
      await tx.tenantMember.create({
        data: { code, tenantId, userId: user.id, role, isActive: true },
      });

      return { user };
    });

    return { id: user.id, name: user.name, email: user.email, role };
  }

  async listTenantMembers(tenantId: string, requesterRole?: string) {
    const isAdmin = String(requesterRole || '').toUpperCase() === 'ADMIN';
    const members = await this.prisma.tenantMember.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(isAdmin ? {} : { user: { is: { isPlatformAdmin: false } } }),
      },
      include: { user: { select: userSafeSelect } },
      orderBy: { createdAt: 'desc' },
    });

    return members.map((member) => {
      if (!('role' in member) || member.role == null) return member;
      return {
        ...member,
        role: this.normalizeLegacyTenantRole(member.role),
      };
    });
  }

  async getMyProfile(tenantId: string, userId: string) {
    const membership = await this.prisma.tenantMember.findFirst({
      where: { tenantId, userId, isActive: true },
      include: {
        tenant: { select: { timezone: true } },
        user: {
          select: {
            ...userSafeSelect,
            twoFactorEnabled: true,
            passwordExpiresAt: true,
          },
        },
      },
    });
    if (!membership)
      throw new BadRequestException('Usuário sem vínculo ativo no escritório');

    return {
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      role: this.normalizeLegacyTenantRole(membership.role),
      tenantTimezone: String(membership.tenant?.timezone || 'America/Manaus'),
      twoFactorEnabled: membership.user.twoFactorEnabled,
      passwordExpiresAt: membership.user.passwordExpiresAt,
    };
  }

  async changeMyPassword(
    tenantId: string,
    userId: string,
    input: {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    },
    currentSessionId?: string,
  ) {
    const currentPassword = String(input?.currentPassword || '');
    const newPassword = String(input?.newPassword || '');
    const confirmPassword = String(input?.confirmPassword || '');

    if (!currentPassword)
      throw new BadRequestException('Senha atual é obrigatória');
    if (!newPassword) throw new BadRequestException('Nova senha é obrigatória');
    validatePasswordPolicy(newPassword);
    if (newPassword !== confirmPassword)
      throw new BadRequestException('Confirmação de senha não confere');

    const membership = await this.prisma.tenantMember.findFirst({
      where: { tenantId, userId, isActive: true },
      select: { id: true },
    });
    if (!membership)
      throw new BadRequestException('Usuário sem vínculo ativo no escritório');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) throw new BadRequestException('Usuário não encontrado');

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('Senha atual inválida');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const passwordChangedAt = new Date();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordChangedAt,
        passwordExpiresAt: calculatePasswordExpiresAt(passwordChangedAt),
      },
    });

    if (this.prisma.authSession?.updateMany) {
      await this.prisma.authSession.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
        },
        data: {
          revokedAt: new Date(),
          revokeReason: 'PASSWORD_CHANGED',
        },
      });
    }

    return { ok: true, message: 'Senha alterada com sucesso' };
  }

  listPlatformAdmins() {
    return this.prisma.user.findMany({
      where: { isPlatformAdmin: true },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async promotePlatformAdmin(tenantId: string, actorId: string, email: string) {
    const normalized = email.trim().toLowerCase();
    if (!normalized) throw new BadRequestException('Email é obrigatório');

    const target = await this.prisma.user.findUnique({
      where: { email: normalized },
      select: { id: true, email: true, isPlatformAdmin: true },
    });
    if (!target) throw new BadRequestException('Usuário não encontrado');
    if (target.isPlatformAdmin) {
      throw new BadRequestException('Usuário já é admin de plataforma');
    }

    const updated = await this.prisma.user.update({
      where: { id: target.id },
      data: { isPlatformAdmin: true },
      select: { id: true, name: true, email: true, isPlatformAdmin: true },
    });

    await this.audit.log(
      tenantId,
      'PLATFORM_ADMIN_PROMOTED',
      actorId,
      undefined,
      {
        targetUserId: updated.id,
        targetEmail: updated.email,
      },
    );

    return updated;
  }

  async demotePlatformAdmin(tenantId: string, actorId: string, userId: string) {
    const targetId = userId.trim();
    if (!targetId) throw new BadRequestException('Usuário é obrigatório');
    if (targetId === actorId) {
      throw new BadRequestException(
        'Você não pode remover seu próprio acesso admin',
      );
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, email: true, isPlatformAdmin: true },
    });
    if (!target) throw new BadRequestException('Usuário não encontrado');
    if (!target.isPlatformAdmin) {
      throw new BadRequestException('Usuário não é admin de plataforma');
    }

    const totalAdmins = await this.prisma.user.count({
      where: { isPlatformAdmin: true },
    });
    if (totalAdmins <= 1) {
      throw new BadRequestException(
        'É obrigatório manter ao menos um admin de plataforma',
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: target.id },
      data: { isPlatformAdmin: false },
      select: { id: true, name: true, email: true, isPlatformAdmin: true },
    });

    await this.audit.log(
      tenantId,
      'PLATFORM_ADMIN_DEMOTED',
      actorId,
      undefined,
      {
        targetUserId: updated.id,
        targetEmail: updated.email,
      },
    );

    return updated;
  }
}

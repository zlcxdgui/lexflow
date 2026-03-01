import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';

import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import {
  calculatePasswordExpiresAt,
  validatePasswordPolicy,
} from './password-policy';
import { buildOtpAuthUri, generateTotpSecret, verifyTotpCode } from './totp';
import {
  isMemberBlockedByDate,
  isMemberOutsideAccessSchedule,
  isMemberPasswordRotationExpired,
} from './member-access-policy';
import { nextTenantCode } from '../common/tenant-code';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private getSessionTtlDays() {
    return Math.max(1, Number(process.env.AUTH_SESSION_TTL_DAYS || 15));
  }

  private shouldEnforce2faForPrivileged() {
    return ['1', 'true', 'yes', 'on'].includes(
      String(process.env.AUTH_ENFORCE_2FA_OWNER_ADMIN || 'false').toLowerCase(),
    );
  }

  private async issueSessionToken(input: {
    userId: string;
    tenantId: string;
    role: string;
    email: string;
    ip?: string | null;
    userAgent?: string | null;
    deviceKey?: string | null;
  }) {
    const ttlDays = this.getSessionTtlDays();
    const maxActiveSessions = Math.max(
      1,
      Number(process.env.AUTH_MAX_ACTIVE_SESSIONS || 10),
    );
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
    let sessionId: string = randomUUID();

    if (this.prisma.authSession?.create) {
      const deviceKey = (input.deviceKey || '').trim() || null;
      let reused = false;
      if (deviceKey) {
        const existing = await this.prisma.authSession.findFirst({
          where: {
            userId: input.userId,
            tenantId: input.tenantId,
            revokedAt: null,
            expiresAt: { gt: now },
            deviceKey,
          },
          orderBy: { lastSeenAt: 'desc' },
          select: { id: true },
        });
        if (existing) {
          sessionId = existing.id;
          reused = true;
          await this.prisma.authSession.update({
            where: { id: existing.id },
            data: {
              lastSeenAt: now,
              expiresAt,
              ip: input.ip || null,
              userAgent: input.userAgent || null,
              role: input.role,
            },
          });
        }
      }

      if (!reused) {
        await this.prisma.authSession.create({
          data: {
            id: sessionId,
            userId: input.userId,
            tenantId: input.tenantId,
            role: input.role,
            deviceKey: (input.deviceKey || '').trim() || null,
            ip: input.ip || null,
            userAgent: input.userAgent || null,
            expiresAt,
          },
        });
      }

      const overflow = await this.prisma.authSession.findMany({
        where: {
          userId: input.userId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        orderBy: [{ lastSeenAt: 'desc' }, { issuedAt: 'desc' }],
        skip: maxActiveSessions,
        select: { id: true },
      });
      if (overflow.length) {
        await this.prisma.authSession.updateMany({
          where: { id: { in: overflow.map((item) => item.id) } },
          data: { revokedAt: now, revokeReason: 'MAX_ACTIVE_SESSIONS' },
        });
      }
    }

    const accessToken = await this.jwt.signAsync({
      sub: input.userId,
      tenantId: input.tenantId,
      role: input.role,
      sid: sessionId,
      email: input.email,
    });

    return { accessToken, session: { id: sessionId, expiresAt } };
  }

  async signup(
    dto: SignupDto,
    context?: { ip?: string; userAgent?: string; deviceKey?: string },
  ) {
    const email = dto.email.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('Email já cadastrado');
    validatePasswordPolicy(dto.password);

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const passwordChangedAt = new Date();

    const { tenant, user } = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: dto.tenantName.trim() },
      });

      const user = await tx.user.create({
        data: {
          email,
          name: dto.name.trim(),
          passwordHash,
          passwordChangedAt,
          passwordExpiresAt: calculatePasswordExpiresAt(passwordChangedAt),
        },
      });

      const code = await nextTenantCode(tx, tenant.id, 'TENANT_MEMBER');
      await tx.tenantMember.create({
        data: {
          code,
          tenantId: tenant.id,
          userId: user.id,
          role: 'OWNER',
          isActive: true,
        },
      });

      return { tenant, user };
    });

    const { accessToken, session } = await this.issueSessionToken({
      userId: user.id,
      tenantId: tenant.id,
      role: 'OWNER',
      email: user.email,
      ip: context?.ip || null,
      userAgent: context?.userAgent || null,
      deviceKey: context?.deviceKey || null,
    });

    return {
      accessToken,
      sessionId: session.id,
      tenant: { id: tenant.id, name: tenant.name },
      user: { id: user.id, name: user.name, email: user.email },
    };
  }

  async login(
    dto: LoginDto,
    context?: { ip?: string; userAgent?: string; deviceKey?: string },
  ) {
    const email = dto.email.trim().toLowerCase();
    const maxAttempts = Number(process.env.AUTH_LOCKOUT_MAX_ATTEMPTS || 5);
    const lockMinutes = Number(process.env.AUTH_LOCKOUT_MINUTES || 15);

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Credenciais inválidas');
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const remainingMs = user.lockedUntil.getTime() - Date.now();
      const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
      throw new UnauthorizedException(
        `Conta temporariamente bloqueada. Tente novamente em ${remainingMinutes} minuto(s) ou entre em contato com o responsável do escritório.`,
      );
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      const nextAttempts = (user.failedLoginAttempts || 0) + 1;
      const isLocked = nextAttempts >= maxAttempts;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: isLocked ? 0 : nextAttempts,
          lockedUntil: isLocked
            ? new Date(Date.now() + lockMinutes * 60 * 1000)
            : null,
        },
      });
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (
      user.passwordExpiresAt &&
      user.passwordExpiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException(
        'Senha expirada. Atualize sua senha para continuar.',
      );
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    const membership = await this.prisma.tenantMember.findFirst({
      where: { userId: user.id, isActive: true },
    });
    if (!membership) {
      const inactiveMembership = await this.prisma.tenantMember.findFirst({
        where: { userId: user.id, isActive: false },
        select: { id: true },
      });
      if (inactiveMembership) {
        throw new UnauthorizedException(
          'Usuário desativado no escritório. Entre em contato com o responsável.',
        );
      }
      throw new UnauthorizedException('Usuário sem escritório');
    }
    if (isMemberBlockedByDate(membership.settingsJson)) {
      throw new UnauthorizedException('Acesso bloqueado para este usuário.');
    }
    if (
      isMemberPasswordRotationExpired(
        membership.settingsJson,
        user.passwordChangedAt,
      )
    ) {
      throw new UnauthorizedException(
        'Senha expirada. Atualize sua senha para continuar.',
      );
    }
    if (isMemberOutsideAccessSchedule(membership.settingsJson)) {
      throw new UnauthorizedException(
        'Acesso fora do horário permitido para este usuário.',
      );
    }
    const membershipRole =
      String(membership.role || '').toUpperCase() === 'ADMIN'
        ? 'OWNER'
        : membership.role;
    const effectiveRole = user.isPlatformAdmin ? 'ADMIN' : membershipRole;

    const requires2fa =
      String(effectiveRole).toUpperCase() === 'OWNER' ||
      String(effectiveRole).toUpperCase() === 'ADMIN';
    if (requires2fa) {
      if (!user.twoFactorEnabled && this.shouldEnforce2faForPrivileged()) {
        throw new UnauthorizedException(
          '2FA obrigatório para este perfil. Configure no menu de segurança.',
        );
      }
      if (user.twoFactorEnabled) {
        const code = String(dto.totpCode || '').trim();
        if (!verifyTotpCode(String(user.twoFactorSecret || ''), code)) {
          throw new UnauthorizedException('Código 2FA inválido');
        }
      }
    }

    const { accessToken, session } = await this.issueSessionToken({
      userId: user.id,
      tenantId: membership.tenantId,
      role: effectiveRole,
      email: user.email,
      ip: context?.ip || null,
      userAgent: context?.userAgent || null,
      deviceKey: context?.deviceKey || null,
    });

    return {
      accessToken,
      sessionId: session.id,
      user: { id: user.id, name: user.name, email: user.email },
      tenantId: membership.tenantId,
      role: effectiveRole,
    };
  }

  async setupTwoFactor(userId: string, email: string) {
    const secret = generateTotpSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: secret,
        twoFactorEnabled: false,
      },
    });

    return {
      secret,
      issuer: process.env.AUTH_2FA_ISSUER || 'LexFlow',
      otpauthUrl: buildOtpAuthUri(
        email,
        secret,
        process.env.AUTH_2FA_ISSUER || 'LexFlow',
      ),
    };
  }

  async twoFactorStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true, twoFactorSecret: true },
    });
    return {
      enabled: Boolean(user?.twoFactorEnabled),
      configured: Boolean(user?.twoFactorSecret),
    };
  }

  async enableTwoFactor(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorSecret: true },
    });
    if (!user?.twoFactorSecret) {
      throw new BadRequestException('2FA ainda não foi configurado');
    }
    if (!verifyTotpCode(user.twoFactorSecret, code)) {
      throw new BadRequestException('Código 2FA inválido');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });
    return { ok: true, message: '2FA ativado com sucesso' };
  }

  async disableTwoFactor(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorSecret: true, twoFactorEnabled: true },
    });
    if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
      return { ok: true, message: '2FA já estava desativado' };
    }
    if (!verifyTotpCode(user.twoFactorSecret, code)) {
      throw new BadRequestException('Código 2FA inválido');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    return { ok: true, message: '2FA desativado com sucesso' };
  }

  async listSessions(userId: string, currentSessionId?: string) {
    const sessions = await this.prisma.authSession.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { issuedAt: 'desc' },
      select: {
        id: true,
        tenantId: true,
        role: true,
        ip: true,
        userAgent: true,
        issuedAt: true,
        lastSeenAt: true,
        expiresAt: true,
      },
    });

    return sessions.map((session) => ({
      ...session,
      isCurrent: currentSessionId ? session.id === currentSessionId : false,
    }));
  }

  async revokeSession(userId: string, sessionId: string, reason = 'MANUAL') {
    const session = await this.prisma.authSession.findFirst({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
      },
      select: { id: true },
    });
    if (!session) throw new BadRequestException('Sessão não encontrada');

    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
    return { ok: true, message: 'Sessão encerrada' };
  }

  async revokeOtherSessions(userId: string, currentSessionId?: string) {
    const where = {
      userId,
      revokedAt: null,
      ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
    };
    const result = await this.prisma.authSession.updateMany({
      where,
      data: { revokedAt: new Date(), revokeReason: 'REVOKE_OTHERS' },
    });
    return { ok: true, revoked: result.count };
  }
}

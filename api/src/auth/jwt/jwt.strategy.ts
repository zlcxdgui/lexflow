import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getEffectivePermissions,
  parseGroupPermissionSelection,
} from '../roles/policy';
import type { AppRole } from '../roles/roles.decorator';
import {
  isMemberBlockedByDate,
  isMemberOutsideAccessSchedule,
  isMemberPasswordRotationExpired,
} from '../member-access-policy';

type JwtPayload = {
  sub: string;
  tenantId?: string;
  email?: string;
  sid?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || 'dev_secret_change_me',
    });
  }

  async validate(payload: JwtPayload) {
    const userId = payload.sub;
    const tenantId = payload.tenantId;
    const sessionId = payload.sid;

    if (!userId || !tenantId) {
      throw new UnauthorizedException('Token inválido');
    }
    if (!sessionId) {
      throw new UnauthorizedException('Sessão inválida');
    }

    const session = await this.prisma.authSession.findFirst({
      where: {
        id: sessionId,
        userId,
        tenantId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!session) {
      throw new UnauthorizedException('Sessão encerrada');
    }

    await this.prisma.authSession.update({
      where: { id: sessionId },
      data: { lastSeenAt: new Date() },
    });

    const membership = await this.prisma.tenantMember.findFirst({
      where: { tenantId, userId, isActive: true, tenant: { isActive: true } },
      select: { role: true, tenantId: true, settingsJson: true },
    });

    const platformAdmin = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isPlatformAdmin: true, passwordChangedAt: true },
    });

    const isAdmin = Boolean(platformAdmin?.isPlatformAdmin);
    if (!membership?.role && !isAdmin) {
      throw new UnauthorizedException('Usuário sem vínculo ativo no tenant');
    }
    if (
      membership?.settingsJson &&
      isMemberBlockedByDate(membership.settingsJson)
    ) {
      throw new UnauthorizedException('Acesso bloqueado para este usuário.');
    }
    if (
      membership?.settingsJson &&
      isMemberPasswordRotationExpired(
        membership.settingsJson,
        platformAdmin?.passwordChangedAt,
      )
    ) {
      throw new UnauthorizedException(
        'Senha expirada. Atualize sua senha para continuar.',
      );
    }
    if (
      membership?.settingsJson &&
      isMemberOutsideAccessSchedule(membership.settingsJson)
    ) {
      throw new UnauthorizedException(
        'Acesso fora do horário permitido para este usuário.',
      );
    }

    // Compatibilidade com base antiga: "ADMIN" em membership vira "OWNER".
    const tenantRole =
      membership?.role === 'ADMIN' ? 'OWNER' : (membership?.role ?? '');

    let parsedSettings:
      | { modulePermissions?: unknown; groupPermissions?: unknown }
      | undefined;
    if (membership?.settingsJson) {
      try {
        const parsed = JSON.parse(membership.settingsJson) as {
          modulePermissions?: unknown;
          groupPermissions?: unknown;
        };
        parsedSettings =
          parsed && typeof parsed === 'object' ? parsed : undefined;
      } catch {
        parsedSettings = undefined;
      }
    }

    const effectiveRole: AppRole = (isAdmin ? 'ADMIN' : tenantRole) as AppRole;
    const selectedGroups = parseGroupPermissionSelection(
      parsedSettings?.groupPermissions,
    );
    let overridePermissions: string[] = [];
    let hasSelectedGroupMatch = false;
    if (!isAdmin && selectedGroups.hasSelection) {
      const selected = await this.prisma.tenantAccessGroup?.findMany?.({
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
      hasSelectedGroupMatch = Boolean(selected && selected.length > 0);
      overridePermissions = Array.from(
        new Set((selected || []).flatMap((item) => item.permissions || [])),
      );
      if (!hasSelectedGroupMatch) {
        const fallbackGroup =
          tenantRole === 'OWNER' ||
          tenantRole === 'LAWYER' ||
          tenantRole === 'ASSISTANT'
            ? await this.prisma.tenantAccessGroup?.findFirst?.({
                where: { tenantId, key: tenantRole, isActive: true },
                select: { permissions: true },
              })
            : null;
        overridePermissions = fallbackGroup?.permissions || [];
      }
    } else {
      const accessGroup =
        !isAdmin &&
        (tenantRole === 'OWNER' ||
          tenantRole === 'LAWYER' ||
          tenantRole === 'ASSISTANT')
          ? await this.prisma.tenantAccessGroup?.findFirst?.({
              where: { tenantId, key: tenantRole, isActive: true },
              select: { permissions: true },
            })
          : null;
      overridePermissions = accessGroup?.permissions || [];
    }

    const permissions = getEffectivePermissions(
      effectiveRole,
      parsedSettings,
      overridePermissions,
      {
        forceRoleOverrideBase:
          selectedGroups.hasSelection && hasSelectedGroupMatch,
      },
    );

    // Isso vira req.user
    return {
      sub: userId,
      tenantId,
      sid: sessionId,
      role: effectiveRole,
      tenantRole,
      isAdmin,
      email: payload.email,
      permissions,
    };
  }
}

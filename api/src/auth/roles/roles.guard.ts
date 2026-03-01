import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, AppRole } from './roles.decorator';
import { PERMISSIONS_KEY } from './permissions.decorator';
import {
  getEffectivePermissions,
  hasPermission,
  parseGroupPermissionSelection,
} from './policy';
import type { JwtAuthRequest } from '../jwt-auth-request';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<AppRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // sem @Roles e sem @Permissions, deixa passar
    if (
      (!requiredRoles || requiredRoles.length === 0) &&
      (!requiredPermissions || requiredPermissions.length === 0)
    ) {
      return true;
    }

    const req = context.switchToHttp().getRequest<JwtAuthRequest>();
    const user = req.user as
      | { role?: AppRole; isAdmin?: boolean; permissions?: string[] }
      | undefined;

    if (!user?.role) throw new ForbiddenException('Role ausente');
    const role = user.role;
    if (role === 'ADMIN' || user.isAdmin) return true;

    if (requiredRoles?.length && !requiredRoles.includes(role)) {
      throw new ForbiddenException(
        'Sem autorização. Entre em contato com o responsável do escritório.',
      );
    }

    if (requiredPermissions?.length) {
      let effectivePermissions = Array.isArray(user.permissions)
        ? user.permissions
        : [];

      const membership = await this.prisma.tenantMember.findFirst({
        where: {
          tenantId: req.user.tenantId,
          userId: req.user.sub,
          isActive: true,
          tenant: { isActive: true },
        },
        select: { settingsJson: true },
      });

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

      const selectedGroups = parseGroupPermissionSelection(
        parsedSettings?.groupPermissions,
      );
      let overridePermissions: string[] = [];
      let hasSelectedGroupMatch = false;
      if (selectedGroups.hasSelection) {
        const selected = await this.prisma.tenantAccessGroup?.findMany?.({
          where: {
            tenantId: req.user.tenantId,
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
            role === 'OWNER' || role === 'LAWYER' || role === 'ASSISTANT'
              ? await this.prisma.tenantAccessGroup?.findFirst?.({
                  where: {
                    tenantId: req.user.tenantId,
                    key: role,
                    isActive: true,
                  },
                  select: { permissions: true },
                })
              : null;
          overridePermissions = fallbackGroup?.permissions || [];
        }
      } else {
        const accessGroup =
          role === 'OWNER' || role === 'LAWYER' || role === 'ASSISTANT'
            ? await this.prisma.tenantAccessGroup?.findFirst?.({
                where: {
                  tenantId: req.user.tenantId,
                  key: role,
                  isActive: true,
                },
                select: { permissions: true },
              })
            : null;
        overridePermissions = accessGroup?.permissions || [];
      }

      effectivePermissions = getEffectivePermissions(
        role,
        parsedSettings,
        overridePermissions,
        {
          forceRoleOverrideBase:
            selectedGroups.hasSelection && hasSelectedGroupMatch,
        },
      );

      const hasAllPermissions = requiredPermissions.every((permission) => {
        if (effectivePermissions.length > 0) {
          return effectivePermissions.includes(permission);
        }
        return hasPermission(role, permission);
      });
      if (!hasAllPermissions) {
        throw new ForbiddenException(
          'Sem autorização. Entre em contato com o responsável do escritório.',
        );
      }
    }

    return true;
  }
}

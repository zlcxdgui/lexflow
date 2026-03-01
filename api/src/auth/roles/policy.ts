import type { AppRole } from './roles.decorator';

export const ALL_PERMISSIONS = [
  'dashboard.read',
  'notifications.read',
  'client.read',
  'client.create',
  'client.edit',
  'client.delete',
  'matter.read',
  'matter.create',
  'matter.edit',
  'matter.delete',
  'task.read',
  'task.create',
  'task.edit',
  'task.delete',
  'appointment.read',
  'appointment.create',
  'appointment.edit',
  'appointment.delete',
  'deadline.read',
  'deadline.create',
  'deadline.edit',
  'deadline.delete',
  'document.read',
  'document.upload',
  'document.edit',
  'document.delete',
  'team.read',
  'team.update',
  'team.deactivate',
  'audit.read',
  'reports.read',
  'agenda.read',
  'agenda.read.own',
  'agenda.read.all',
  'agenda.manage',
  'calculator.read',
  'finance.read',
  'finance.create',
  'finance.edit',
  'finance.settle',
  'finance.cancel',
  'finance.catalog.read',
  'finance.catalog.manage',
  'finance.recurrence.manage',
] as const;

type Permission = (typeof ALL_PERMISSIONS)[number];
type GroupKey = 'OWNER' | 'LAWYER' | 'ASSISTANT';

export const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  ADMIN: [...ALL_PERMISSIONS],
  OWNER: [...ALL_PERMISSIONS],
  LAWYER: [
    'dashboard.read',
    'notifications.read',
    'client.read',
    'client.create',
    'client.edit',
    'matter.read',
    'matter.create',
    'matter.edit',
    'task.read',
    'task.create',
    'task.edit',
    'appointment.read',
    'appointment.create',
    'appointment.edit',
    'deadline.read',
    'deadline.create',
    'deadline.edit',
    'document.read',
    'document.upload',
    'document.edit',
    'team.read',
    'audit.read',
    'reports.read',
    'agenda.read',
    'agenda.read.own',
    'calculator.read',
    'finance.read',
    'finance.create',
    'finance.edit',
    'finance.settle',
    'finance.cancel',
    'finance.catalog.read',
  ],
  ASSISTANT: [
    'dashboard.read',
    'notifications.read',
    'client.read',
    'client.create',
    'client.edit',
    'matter.read',
    'matter.create',
    'matter.edit',
    'task.read',
    'task.create',
    'task.edit',
    'appointment.read',
    'appointment.create',
    'appointment.edit',
    'deadline.read',
    'deadline.create',
    'deadline.edit',
    'document.read',
    'document.upload',
    'document.edit',
    'team.read',
    'audit.read',
    'reports.read',
    'agenda.read',
    'agenda.read.own',
    'calculator.read',
    'finance.read',
    'finance.create',
    'finance.edit',
    'finance.settle',
    'finance.cancel',
    'finance.catalog.read',
  ],
};

export function hasPermission(role: AppRole, permission: string) {
  return ROLE_PERMISSIONS[role]?.includes(permission as Permission) ?? false;
}

function normalizePermission(value: string): Permission | null {
  if (value === 'team.manage') return 'team.update';
  return ALL_PERMISSIONS.includes(value as Permission)
    ? (value as Permission)
    : null;
}

export function parseGroupPermissionSelection(input: unknown): {
  hasSelection: boolean;
  keys: GroupKey[];
  ids: string[];
} {
  if (!Array.isArray(input)) {
    return { hasSelection: false, keys: [], ids: [] };
  }

  const keys = new Set<GroupKey>();
  const ids = new Set<string>();

  for (const raw of input) {
    const value = String(raw || '').trim();
    if (!value) continue;

    const upper = value.toUpperCase();
    if (upper === 'OWNER' || upper === 'LAWYER' || upper === 'ASSISTANT') {
      keys.add(upper);
      continue;
    }

    if (upper.startsWith('GROUP:')) {
      const id = value.slice(6).trim();
      if (id) ids.add(id);
    }
  }

  return {
    hasSelection: keys.size > 0 || ids.size > 0,
    keys: Array.from(keys),
    ids: Array.from(ids),
  };
}

function normalizePermissionList(list: unknown): Permission[] {
  if (!Array.isArray(list)) return [];
  const normalized = list
    .map((value) => normalizePermission(String(value)))
    .filter((value): value is Permission => Boolean(value));
  const expanded = normalized.flatMap((permission) =>
    permission === 'team.update'
      ? (['team.update', 'team.deactivate'] as Permission[])
      : permission === 'agenda.read.all'
        ? ([
            'agenda.read',
            'agenda.read.own',
            'agenda.read.all',
          ] as Permission[])
        : permission === 'agenda.read.own'
          ? (['agenda.read', 'agenda.read.own'] as Permission[])
          : [permission],
  );
  return Array.from(new Set(expanded));
}

export function getEffectivePermissions(
  role: AppRole,
  settings?: { modulePermissions?: unknown; groupPermissions?: unknown } | null,
  rolePermissionsOverride?: unknown,
  options?: { forceRoleOverrideBase?: boolean },
): string[] {
  if (role === 'ADMIN') {
    return [...ROLE_PERMISSIONS[role]];
  }

  const modulePermissions = normalizePermissionList(
    settings?.modulePermissions,
  );
  const groupPermissions = normalizePermissionList(settings?.groupPermissions);
  const roleOverridePermissions = normalizePermissionList(
    rolePermissionsOverride,
  );
  const forceRoleOverrideBase = Boolean(options?.forceRoleOverrideBase);

  const base = forceRoleOverrideBase
    ? roleOverridePermissions
    : groupPermissions.length
      ? groupPermissions
      : roleOverridePermissions.length
        ? roleOverridePermissions
        : ROLE_PERMISSIONS[role];
  return Array.from(new Set([...base, ...modulePermissions]));
}

export type AppRole = 'ADMIN' | 'OWNER' | 'LAWYER' | 'ASSISTANT' | '';

export type PermissionAction =
  | 'client.read'
  | 'client.create'
  | 'client.edit'
  | 'client.delete'
  | 'matter.read'
  | 'matter.create'
  | 'matter.edit'
  | 'task.read'
  | 'task.create'
  | 'task.edit'
  | 'task.delete'
  | 'appointment.read'
  | 'appointment.create'
  | 'appointment.edit'
  | 'appointment.delete'
  | 'deadline.read'
  | 'deadline.create'
  | 'deadline.edit'
  | 'deadline.delete'
  | 'document.read'
  | 'document.upload'
  | 'document.edit'
  | 'document.delete'
  | 'update.read'
  | 'update.create'
  | 'update.edit'
  | 'update.delete'
  | 'agendaView.delete'
  | 'calculator.read'
  | 'audit.read'
  | 'finance.read'
  | 'finance.create'
  | 'finance.edit'
  | 'finance.settle'
  | 'finance.cancel'
  | 'finance.catalog.read'
  | 'finance.catalog.manage'
  | 'finance.recurrence.manage';

const LAWYER_PERMISSIONS: PermissionAction[] = [
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
  'calculator.read',
  'update.read',
  'update.create',
  'update.edit',
  'finance.read',
  'finance.create',
  'finance.edit',
  'finance.settle',
  'finance.cancel',
  'finance.catalog.read',
];

const matrix: Record<Exclude<AppRole, ''>, Set<PermissionAction>> = {
  ADMIN: new Set<PermissionAction>([
    'client.read',
    'client.create',
    'client.edit',
    'client.delete',
    'matter.read',
    'matter.create',
    'matter.edit',
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
    'update.read',
    'update.create',
    'update.edit',
    'update.delete',
    'agendaView.delete',
    'calculator.read',
    'audit.read',
    'finance.read',
    'finance.create',
    'finance.edit',
    'finance.settle',
    'finance.cancel',
    'finance.catalog.read',
    'finance.catalog.manage',
    'finance.recurrence.manage',
  ]),
  OWNER: new Set<PermissionAction>([
    'client.read',
    'client.create',
    'client.edit',
    'client.delete',
    'matter.read',
    'matter.create',
    'matter.edit',
    'task.read',
    'task.create',
    'task.edit',
    'appointment.read',
    'appointment.create',
    'appointment.edit',
    'appointment.delete',
    'task.delete',
    'deadline.read',
    'deadline.create',
    'deadline.edit',
    'deadline.delete',
    'document.read',
    'document.upload',
    'document.edit',
    'document.delete',
    'update.read',
    'update.create',
    'update.edit',
    'update.delete',
    'agendaView.delete',
    'calculator.read',
    'audit.read',
    'finance.read',
    'finance.create',
    'finance.edit',
    'finance.settle',
    'finance.cancel',
    'finance.catalog.read',
    'finance.catalog.manage',
    'finance.recurrence.manage',
  ]),
  LAWYER: new Set<PermissionAction>(LAWYER_PERMISSIONS),
  ASSISTANT: new Set<PermissionAction>(LAWYER_PERMISSIONS),
};

export function normalizeRole(role?: string | null): AppRole {
  const value = String(role || '').toUpperCase();
  if (value === 'ADMIN' || value === 'OWNER' || value === 'LAWYER' || value === 'ASSISTANT') {
    return value;
  }
  return '';
}

export function can(
  role: string | null | undefined,
  action: PermissionAction,
  explicitPermissions?: string[] | null,
): boolean {
  const normalized = normalizeRole(role);
  if (!normalized) return false;
  // A UI sempre exibe as ações para o usuário clicar.
  // A autorização final é sempre aplicada no backend (403 quando não permitido).
  void action;
  void explicitPermissions;
  void matrix;
  return true;
}

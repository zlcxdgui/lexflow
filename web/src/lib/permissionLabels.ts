export const PERMISSION_LABELS: Record<string, string> = {
  'dashboard.read': 'Ver painel',
  'notifications.read': 'Ver notificações',
  'reports.read': 'Ver relatórios',
  'agenda.read': 'Ver agenda',
  'agenda.read.own': 'Ver próprias marcações da agenda',
  'agenda.read.all': 'Ver todas marcações da agenda',
  'agenda.manage': 'Gerenciar agenda',
  'calculator.read': 'Ver calculadoras',
  'audit.read': 'Ver auditoria do caso/sistema',
  'client.read': 'Ver pessoas',
  'client.create': 'Cadastrar pessoas',
  'client.edit': 'Editar pessoas',
  'client.delete': 'Excluir pessoas',
  'matter.read': 'Ver casos',
  'matter.create': 'Cadastrar casos',
  'matter.edit': 'Editar casos',
  'matter.delete': 'Excluir andamentos do caso',
  'task.read': 'Ver tarefas',
  'task.create': 'Cadastrar tarefas',
  'task.edit': 'Editar tarefas',
  'task.delete': 'Excluir tarefas',
  'appointment.read': 'Ver atendimentos',
  'appointment.create': 'Cadastrar atendimentos',
  'appointment.edit': 'Editar atendimentos',
  'appointment.delete': 'Excluir atendimentos',
  'deadline.read': 'Ver prazos',
  'deadline.create': 'Cadastrar prazos',
  'deadline.edit': 'Editar prazos',
  'deadline.delete': 'Excluir prazos',
  'document.read': 'Ver documentos',
  'document.upload': 'Enviar documentos',
  'document.edit': 'Editar documentos',
  'document.delete': 'Excluir documentos',
  'team.read': 'Ver equipe',
  'team.update': 'Alterar equipe',
  'team.deactivate': 'Desativar equipe',
  'team.manage': 'Gerenciar equipe',
  'finance.read': 'Ver financeiro',
  'finance.create': 'Cadastrar lançamentos financeiros',
  'finance.edit': 'Editar lançamentos financeiros',
  'finance.settle': 'Dar baixa em parcelas financeiras',
  'finance.cancel': 'Cancelar lançamentos/parcelas financeiras',
  'finance.catalog.read': 'Ver cadastros do financeiro',
  'finance.catalog.manage': 'Gerenciar cadastros do financeiro',
  'finance.recurrence.manage': 'Gerenciar recorrências financeiras',
};

export const GROUP_PERMISSION_LABELS: Record<string, string> = {
  OWNER: 'Sócio',
  LAWYER: 'Advogado',
  ASSISTANT: 'Assistente',
};

export function labelPermission(code: string): string {
  return PERMISSION_LABELS[code] || code;
}

export function labelGroupPermission(code: string): string {
  return GROUP_PERMISSION_LABELS[code] || code;
}

export function summarizeSettingsForAudit(raw: unknown): string {
  const settings =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  const groups = Array.isArray(settings.groupPermissions)
    ? settings.groupPermissions.map((value) => {
        const rawValue = String(value);
        if (rawValue.startsWith('GROUP:')) return 'Grupo personalizado';
        return labelGroupPermission(rawValue);
      })
    : [];

  const modules = Array.isArray(settings.modulePermissions)
    ? settings.modulePermissions.map((value) => labelPermission(String(value)))
    : [];

  const scheduleEnabled = Boolean(settings.accessScheduleEnabled);
  const passwordRotateDays =
    typeof settings.passwordRotateDays === 'number'
      ? settings.passwordRotateDays
      : null;

  const parts: string[] = [];
  parts.push(`Grupos: ${groups.length ? groups.join(', ') : 'nenhum'}`);
  parts.push(`Permissões: ${modules.length}`);
  parts.push(`Horário controlado: ${scheduleEnabled ? 'sim' : 'não'}`);
  if (passwordRotateDays != null) {
    parts.push(
      `Troca de senha: ${
        passwordRotateDays > 0
          ? `a cada ${passwordRotateDays} dia(s)`
          : 'sem obrigatoriedade'
      }`,
    );
  }
  return parts.join(' · ');
}

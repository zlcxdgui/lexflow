export function formatDateBR(iso?: string | null, timeZone?: string) {
  if (!iso) return '-';
  const text = String(iso);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const isDateOnly =
    /^\d{4}-\d{2}-\d{2}$/.test(text) ||
    /T00:00:00(\.000)?Z$/i.test(text);
  if (isDateOnly) {
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  }
  if (timeZone) {
    return d.toLocaleDateString('pt-BR', { timeZone });
  }
  return d.toLocaleDateString('pt-BR');
}

export function formatDateTimeBR(iso?: string | null, timeZone?: string) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR', timeZone ? { timeZone } : undefined);
}

export function formatBytes(bytes?: number | null) {
  if (bytes == null) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v = v / 1024;
    i++;
  }
  const decimals = i === 0 ? 0 : 1;
  return `${v.toFixed(decimals)} ${units[i]}`;
}

export function formatCurrencyBRLFromCents(cents?: number | null) {
  const value = Number(cents || 0) / 100;
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}

export function formatRole(role?: string | null) {
  if (!role) return '-';
  switch (role) {
    case 'ADMIN':
      return 'Admin';
    case 'OWNER':
      return 'Sócio';
    case 'LAWYER':
      return 'Advogado';
    case 'ASSISTANT':
      return 'Assistente';
    default:
      return role;
  }
}

export function formatStatus(status?: string | null) {
  if (!status) return '-';
  switch (status) {
    case 'OPEN':
      return 'Aberto';
    case 'CLOSED':
      return 'Encerrado';
    case 'DOING':
      return 'Em andamento';
    case 'DONE':
      return 'Concluído';
    case 'PENDING':
      return 'Pendente';
    default:
      return status;
  }
}

export function formatPriority(priority?: string | null) {
  if (!priority) return '-';
  switch (priority) {
    case 'LOW':
      return 'Baixa';
    case 'MEDIUM':
      return 'Média';
    case 'HIGH':
      return 'Alta';
    default:
      return priority;
  }
}

export function formatDeadlineType(value?: string | null) {
  if (!value) return '-';
  switch (value) {
    case 'PROCESSUAL':
      return 'Processual';
    case 'GENERIC':
      return 'Geral';
    default:
      return value;
  }
}

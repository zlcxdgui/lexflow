import type { AppointmentClient } from './useAppointmentPickerData';

export function appointmentToLocalIsoUtc(date: string, time: string) {
  const safeTime = time || '09:00';
  return new Date(`${date}T${safeTime}:00`).toISOString();
}

export function appointmentToLocalIsoLocal(date: string, time: string) {
  const safeTime = time || '09:00';
  return `${date}T${safeTime}:00`;
}

export function todayIsoDate() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function onlyDigits(value?: string | null) {
  return (value || '').replace(/\D+/g, '');
}

export function formatCpf(value?: string | null) {
  const d = onlyDigits(value).slice(0, 11);
  if (!d) return '-';
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function appointmentClientFullLabel(client: AppointmentClient) {
  const code = client.code ?? '-';
  const cpf = formatCpf(client.cpf);
  return `${code} - ${client.name} - ${cpf}`;
}

export function appointmentClientSimpleLabel(client: AppointmentClient) {
  return `${client.code ? `${client.code} - ` : ''}${client.name}`;
}

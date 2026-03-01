export function financeStatusLabel(status?: string | null) {
  const s = String(status || '').toUpperCase();
  if (s === 'SETTLED') return 'Quitado';
  if (s === 'OVERDUE') return 'Vencido';
  if (s === 'CANCELED') return 'Cancelado';
  if (s === 'PARTIAL') return 'Parcial';
  return 'Em aberto';
}

export function financeDirectionLabel(direction?: string | null) {
  return String(direction || '').toUpperCase() === 'OUT' ? 'Pagar' : 'Receber';
}

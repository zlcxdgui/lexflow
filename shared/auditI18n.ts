export function formatAuditActionLabel(action: string): string {
  const map: Record<string, string> = {
    MATTER_CREATED: 'Caso criado',
    MATTER_UPDATED: 'Caso atualizado',
    MATTER_STATUS_CHANGED: 'Status do caso alterado',
    MATTER_UPDATE_ADDED: 'Andamento registrado',
    MATTER_UPDATE_UPDATED: 'Andamento alterado',
    MATTER_UPDATE_DELETED: 'Andamento excluído',
    DOCUMENT_UPLOADED: 'Documento enviado',
    DOCUMENT_RENAMED: 'Documento renomeado',
    DOCUMENT_DELETED: 'Documento excluído',
    DOCUMENT_DOWNLOADED: 'Documento baixado',
    DOCUMENT_VIEWED: 'Documento visualizado',
    DOCUMENT_META_UPDATED: 'Metadados de documento alterados',
    CLIENT_CREATED: 'Pessoa criada',
    CLIENT_UPDATED: 'Pessoa alterada',
    CLIENT_DELETED: 'Pessoa excluída',
    TASK_CREATED: 'Tarefa criada',
    TASK_UPDATED: 'Tarefa alterada',
    TASK_DELETED: 'Tarefa excluída',
    DEADLINE_CREATED: 'Prazo criado',
    DEADLINE_UPDATED: 'Prazo alterado',
    DEADLINE_DELETED: 'Prazo excluído',
    APPOINTMENT_CREATED: 'Atendimento criado',
    APPOINTMENT_UPDATED: 'Atendimento alterado',
    APPOINTMENT_DELETED: 'Atendimento excluído',
    NOTIFICATION_MARKED_READ: 'Notificação marcada como lida',
    NOTIFICATION_MARKED_ALL_READ: 'Todas notificações marcadas como lidas',
    TENANT_MEMBER_INVITED: 'Membro convidado',
    TENANT_MEMBER_UPDATED: 'Membro atualizado',
    TENANT_MEMBER_PROFILE_UPDATED: 'Perfil de membro atualizado',
    TENANT_MEMBER_ACTIVATION_RESENT: 'Reenvio de ativação',
    TENANT_MEMBER_SETTINGS_UPDATED: 'Configurações do membro alteradas',
    TENANT_MEMBER_UNLOCKED: 'Membro desbloqueado',
    TENANT_INVITE_RESENT: 'Convite reenviado',
    TENANT_INVITE_CANCELLED: 'Convite cancelado',
    TENANT_INVITE_ACCEPTED: 'Convite aceito',
    TENANT_SWITCHED: 'Troca de escritório',
    TENANT_CREATED: 'Escritório criado',
    TENANT_RENAMED: 'Nome do escritório alterado',
    TENANT_STATUS_UPDATED: 'Status do escritório alterado',
    TEAM_ACCESS_GROUP_CREATED: 'Grupo de acesso criado',
    TEAM_ACCESS_GROUP_UPDATED: 'Grupo de acesso alterado',
    TEAM_ACCESS_GROUP_DELETED: 'Grupo de acesso excluído',
    PLATFORM_ADMIN_PROMOTED: 'Administrador da plataforma promovido',
    PLATFORM_ADMIN_DEMOTED: 'Administrador da plataforma removido',
    REPORT_SNAPSHOT_DAILY: 'Snapshot diário de relatórios',
    REPORT_EXPORTED_CSV: 'Relatório exportado em CSV',
    REPORT_EXPORTED_PDF: 'Relatório exportado em PDF',
    REPORT_PRINTED: 'Relatório impresso',
    BILLING_PLAN_CHANGED: 'Plano alterado',
    BILLING_PLAN_CHANGE_REQUESTED: 'Solicitação de mudança de plano criada',
    BILLING_PLAN_CHANGE_REQUEST_REVIEWED: 'Solicitação de mudança de plano revisada',
    BILLING_CANCEL_AT_PERIOD_END_UPDATED: 'Cancelamento no fim do período alterado',
    BILLING_WEBHOOK_RECEIVED: 'Webhook de cobrança recebido',
    FINANCE_ENTRY_CREATED: 'Lançamento financeiro criado',
    FINANCE_ENTRY_UPDATED: 'Lançamento financeiro atualizado',
    FINANCE_ENTRY_CANCELED: 'Lançamento financeiro cancelado',
    FINANCE_INSTALLMENT_UPDATED: 'Parcela financeira atualizada',
    FINANCE_INSTALLMENT_SETTLED: 'Parcela financeira baixada',
    FINANCE_INSTALLMENT_CANCELED: 'Parcela financeira cancelada',
    FINANCE_RECURRENCE_TEMPLATE_CREATED: 'Template recorrente financeiro criado',
    FINANCE_RECURRENCE_TEMPLATE_UPDATED: 'Template recorrente financeiro atualizado',
    FINANCE_RECURRENCE_GENERATED: 'Lançamento financeiro gerado por recorrência',
    FINANCE_CATALOG_ACCOUNT_CREATED: 'Conta financeira criada',
    FINANCE_CATALOG_ACCOUNT_UPDATED: 'Conta financeira atualizada',
    FINANCE_CATALOG_CATEGORY_CREATED: 'Categoria financeira criada',
    FINANCE_CATALOG_CATEGORY_UPDATED: 'Categoria financeira atualizada',
    FINANCE_CATALOG_COST_CENTER_CREATED: 'Centro de custo financeiro criado',
    FINANCE_CATALOG_COST_CENTER_UPDATED: 'Centro de custo financeiro atualizado',
    AGENDA_VIEW_CREATED: 'Visão da agenda criada',
    AGENDA_VIEW_UPDATED: 'Visão da agenda atualizada',
    AGENDA_VIEW_DELETED: 'Visão da agenda excluída',
    AUDIT_FILTER_PROCESSED: 'Auditoria processada',
    AUDIT_EXPORTED_CSV: 'Auditoria exportada em CSV',
    AUDIT_EXPORTED_PDF: 'Auditoria exportada em PDF',
  };
  return map[action] || 'Ação registrada';
}

export function formatAuditRoleLabel(role: string): string {
  const map: Record<string, string> = {
    OWNER: 'Sócio',
    LAWYER: 'Advogado',
    ASSISTANT: 'Assistente',
    ADMIN: 'Administrador',
  };
  return map[role] || role;
}

export function formatAuditMetaKeyLabel(key: string): string {
  const map: Record<string, string> = {
    inviteId: 'ID do convite',
    oldInviteId: 'ID do convite anterior',
    newInviteId: 'ID do novo convite',
    invitedEmail: 'E-mail convidado',
    fullName: 'Nome',
    role: 'Cargo',
    groupId: 'ID do grupo',
    key: 'Chave',
    name: 'Nome',
    tenantId: 'ID do escritório',
    tenantName: 'Escritório',
    previousName: 'Nome anterior',
    nextName: 'Nome novo',
    previousStatus: 'Status anterior',
    nextStatus: 'Status novo',
    previousPlanKey: 'Plano anterior (chave)',
    previousPlanName: 'Plano anterior',
    nextPlanKey: 'Novo plano (chave)',
    nextPlanName: 'Novo plano',
    currentPlanKey: 'Plano atual (chave)',
    currentPlanName: 'Plano atual',
    requestedPlanKey: 'Plano solicitado (chave)',
    requestedPlanName: 'Plano solicitado',
    previousRequestedPlanKey: 'Plano solicitado anterior (chave)',
    previousRequestedPlanName: 'Plano solicitado anterior',
    replacedPendingRequest: 'Substituiu solicitação pendente',
    requestId: 'Solicitação',
    reviewerEmail: 'E-mail do revisor',
    resolutionNotes: 'Observações da revisão',
    requestedBillingCycle: 'Ciclo solicitado',
    billingCycle: 'Ciclo de cobrança',
    source: 'Origem',
    cancelAtPeriodEnd: 'Cancelar no fim do período',
    previousCancelAtPeriodEnd: 'Cancelamento no fim do período (anterior)',
    nextCancelAtPeriodEnd: 'Cancelamento no fim do período (novo)',
    currentPeriodEnd: 'Fim do período atual',
    provider: 'Provedor',
    eventType: 'Evento',
    referenceId: 'Referência',
    billingEventId: 'ID do evento de cobrança',
    financeEntryId: 'Lançamento financeiro',
    financeInstallmentId: 'Parcela financeira',
    financeRecurrenceTemplateId: 'Template recorrente financeiro',
    financeAccountId: 'Conta financeira',
    financeCategoryId: 'Categoria financeira',
    financeCostCenterId: 'Centro de custo financeiro',
    direction: 'Direção',
    paidAt: 'Data da baixa',
    notes: 'Observações',
    origin: 'Origem',
    frequency: 'Frequência',
    installmentsPerGeneration: 'Parcelas por geração',
    dayOfMonth: 'Dia de vencimento',
    startDate: 'Início da vigência',
    endDate: 'Fim da vigência',
    totalAmountCents: 'Valor total',
    paidAmountCents: 'Valor pago',
    amountCents: 'Valor',
    installmentsCount: 'Quantidade de parcelas',
    paymentMethod: 'Forma de pagamento',
    paidAt: 'Data da baixa',
    competenceDate: 'Competência',
    direction: 'Direção',
    frequency: 'Frequência',
    origin: 'Origem',
    kind: 'Natureza',
    dayOfMonth: 'Dia do vencimento',
    reason: 'Motivo',
    previousRole: 'Cargo anterior',
    nextRole: 'Cargo novo',
    userId: 'Usuário',
    memberId: 'Membro',
    clientId: 'Pessoa',
    clientCode: 'Código da pessoa',
    taskId: 'Tarefa',
    deadlineId: 'Prazo',
    notificationId: 'Notificação',
    documentId: 'Documento',
    originalName: 'Nome do arquivo',
    oldName: 'Nome anterior',
    newName: 'Nome novo',
    previousOriginalName: 'Nome anterior',
    nextOriginalName: 'Nome novo',
    matterId: 'Caso',
    matterTitle: 'Título do caso',
    updateId: 'Andamento',
    title: 'Título',
    description: 'Descrição',
    status: 'Status',
    type: 'Tipo',
    dueDate: 'Data de vencimento',
    isDone: 'Concluído',
    priority: 'Prioridade',
    cpf: 'CPF',
    rg: 'RG',
    cnpj: 'CNPJ',
    razaoSocial: 'Razão social',
    nomeFantasia: 'Nome fantasia',
    contribuinte: 'Contribuinte',
    inscricaoEstadual: 'Inscrição estadual',
    ufInscricaoEstadual: 'UF inscrição estadual',
    email: 'E-mail',
    phone: 'Telefone',
    cep: 'CEP',
    logradouro: 'Logradouro',
    numero: 'Número',
    complemento: 'Complemento',
    bairro: 'Bairro',
    cidade: 'Cidade',
    uf: 'UF',
    isActive: 'Ativo',
    prevIsActive: 'Status anterior',
    nextIsActive: 'Status novo',
    actorId: 'Responsável',
    action: 'Ação',
    unlockedUserId: 'Usuário desbloqueado',
    targetUserId: 'Usuário alvo',
    targetEmail: 'E-mail do usuário',
    previousEmail: 'E-mail anterior',
    nextEmail: 'E-mail novo',
    employeeClientId: 'Funcionário vinculado',
    fields: 'Campos alterados',
    settings: 'Configurações',
    snapshot: 'Snapshot',
    before: 'Antes',
    after: 'Depois',
    modulePermissions: 'Permissões',
    expiresAt: 'Expira em',
    acceptedAt: 'Aceito em',
    relacoesComerciais: 'Relações comerciais',
    days: 'Período (dias)',
    q: 'Busca',
    area: 'Área',
    responsible: 'Responsável',
    deadlineType: 'Tipo de prazo',
    routine: 'Rotina',
    scope: 'Escopo',
  };
  return map[key] || key;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function formatAuditEnumValue(key: string, value: string): string {
  const normalized = value.trim().toUpperCase();
  if (/role/i.test(key)) return formatAuditRoleLabel(normalized);

  if (/status/i.test(key)) {
    const statusMap: Record<string, string> = {
      OPEN: 'Aberto',
      IN_PROGRESS: 'Em andamento',
      DONE: 'Concluído',
      CLOSED: 'Fechado',
      CANCELED: 'Cancelado',
      CANCELLED: 'Cancelado',
      PENDING: 'Pendente',
      ACTIVE: 'Ativo',
      INACTIVE: 'Inativo',
    };
    return statusMap[normalized] || value;
  }

  if (/priority/i.test(key)) {
    const priorityMap: Record<string, string> = {
      LOW: 'Baixa',
      MEDIUM: 'Média',
      HIGH: 'Alta',
      URGENT: 'Urgente',
    };
    return priorityMap[normalized] || value;
  }

  if (key === 'routine') {
    const routineMap: Record<string, string> = {
      todas: 'Todas',
      casos: 'Casos',
      pessoas: 'Pessoas',
      atendimento: 'Atendimento',
      agenda: 'Agenda',
      financeiro: 'Financeiro',
      relatorios: 'Relatórios',
      relatórios: 'Relatórios',
      equipe: 'Equipe',
      auditoria: 'Auditoria',
      notificacoes: 'Notificações',
      notificações: 'Notificações',
      escritorios: 'Escritórios',
      escritórios: 'Escritórios',
    };
    return routineMap[value.toLowerCase()] || value;
  }

  if (key === 'scope') {
    const scopeMap: Record<string, string> = {
      tenant: 'Escritório',
      matter: 'Caso',
    };
    return scopeMap[value.toLowerCase()] || value;
  }

  if (key === 'type') {
    const typeMap: Record<string, string> = {
      GENERIC: 'Genérico',
      PF: 'Pessoa física',
      PJ: 'Pessoa jurídica',
      CASH: 'Caixa',
      BANK: 'Banco',
      DIGITAL: 'Digital',
    };
    return typeMap[normalized] || value;
  }

  if (/direction/i.test(key)) {
    const directionMap: Record<string, string> = {
      IN: 'Receber',
      OUT: 'Pagar',
    };
    return directionMap[normalized] || value;
  }

  if (/frequency/i.test(key)) {
    const frequencyMap: Record<string, string> = {
      DAILY: 'Diária',
      WEEKLY: 'Semanal',
      MONTHLY: 'Mensal',
      YEARLY: 'Anual',
    };
    return frequencyMap[normalized] || value;
  }

  if (/paymentmethod/i.test(key)) {
    const methodMap: Record<string, string> = {
      CASH: 'Dinheiro',
      PIX: 'PIX',
      BANK_TRANSFER: 'Transferência bancária',
      CARD: 'Cartão',
      OTHER: 'Outro',
    };
    return methodMap[normalized] || value;
  }

  if (/origin/i.test(key)) {
    const originMap: Record<string, string> = {
      MANUAL: 'Manual',
      RECURRENCE: 'Recorrência',
    };
    return originMap[normalized] || value;
  }

  if (/kind/i.test(key)) {
    const kindMap: Record<string, string> = {
      RECEIVABLE: 'Receber',
      PAYABLE: 'Pagar',
      BOTH: 'Receber e pagar',
    };
    return kindMap[normalized] || value;
  }

  if (key === 'direction') {
    const directionMap: Record<string, string> = {
      IN: 'Receber',
      OUT: 'Pagar',
    };
    return directionMap[normalized] || value;
  }

  if (key === 'paymentMethod') {
    const paymentMap: Record<string, string> = {
      CASH: 'Dinheiro',
      PIX: 'PIX',
      BANK_TRANSFER: 'Transferência bancária',
      CARD: 'Cartão',
      OTHER: 'Outro',
    };
    return paymentMap[normalized] || value;
  }

  if (key === 'origin') {
    const originMap: Record<string, string> = {
      MANUAL: 'Manual',
      RECURRENCE: 'Recorrência',
    };
    return originMap[normalized] || value;
  }

  if (key === 'frequency' || key === 'installmentFrequency') {
    const frequencyMap: Record<string, string> = {
      MONTHLY: 'Mensal',
      WEEKLY: 'Semanal',
      YEARLY: 'Anual',
    };
    return frequencyMap[normalized] || value;
  }

  return value;
}

function formatAuditDateValue(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const onlyDate =
    /^\d{4}-\d{2}-\d{2}$/.test(value) || value.includes('T00:00:00.000Z');
  if (onlyDate) {
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  }
  return d.toLocaleString('pt-BR', { timeZone: 'UTC' });
}

function formatCentsToBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function formatAuditMetaValueText(key: string, value: unknown): string {
  if (value == null) return '-';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'number') {
    if (/cents$/i.test(key)) return formatCentsToBRL(value);
    return String(value);
  }
  if (typeof value === 'string') {
    if (/date|at$/i.test(key) || /(Date|At)$/.test(key)) {
      return formatAuditDateValue(value);
    }
    return formatAuditEnumValue(key, value);
  }
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === 'string' ? formatAuditRoleLabel(item) : JSON.stringify(item),
      )
      .join(', ');
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .slice(0, 6)
      .map(([childKey, childValue]) => {
        if (typeof childValue === 'boolean') {
          return `${formatAuditMetaKeyLabel(childKey)}=${childValue ? 'Sim' : 'Não'}`;
        }
        if (typeof childValue === 'string' && /role/i.test(childKey)) {
          return `${formatAuditMetaKeyLabel(childKey)}=${formatAuditRoleLabel(childValue)}`;
        }
        if (
          typeof childValue === 'string' ||
          typeof childValue === 'number' ||
          childValue == null
        ) {
          return `${formatAuditMetaKeyLabel(childKey)}=${childValue == null ? '-' : String(childValue)}`;
        }
        return `${formatAuditMetaKeyLabel(childKey)}=[...]`;
      })
      .join(', ');
  }
  return String(value);
}

function formatChangedFieldsSummary(meta: Record<string, unknown>): string {
  const before = isRecord(meta.before) ? meta.before : null;
  const after = isRecord(meta.after) ? meta.after : null;
  const fields = isRecord(meta.fields) ? meta.fields : null;
  if (!before || !after || !fields) return '';

  const changedKeys = Object.entries(fields)
    .filter(([, changed]) => changed === true)
    .map(([field]) => field)
    .filter((field) => !field.toLowerCase().endsWith('id'));

  if (changedKeys.length === 0) return '';

  return changedKeys
    .map((field) => {
      const beforeRaw = before[field];
      const afterRaw = after[field];
      const same =
        JSON.stringify(beforeRaw ?? null) === JSON.stringify(afterRaw ?? null);
      if (same) return null;

      const prev = formatAuditMetaValueText(field, beforeRaw);
      const next = formatAuditMetaValueText(field, afterRaw);
      return `${formatAuditMetaKeyLabel(field)}: ${prev} → ${next}`;
    })
    .filter((line): line is string => Boolean(line))
    .join(' · ');
}

export function formatAuditMetaEntries(meta: Record<string, unknown>, maxEntries = 3): string {
  const changedSummary = formatChangedFieldsSummary(meta || {});
  if (changedSummary) return changedSummary;

  return Object.entries(meta || {})
    .filter(([k]) => k !== 'before' && k !== 'after' && k !== 'fields')
    .filter(([k]) => !k.startsWith('_'))
    .filter(([k]) => !k.toLowerCase().endsWith('id'))
    .filter(([, v]) => !(typeof v === 'string' && v.trim() === ''))
    .slice(0, Math.max(0, maxEntries))
    .map(([k, v]) => `${formatAuditMetaKeyLabel(k)}: ${formatAuditMetaValueText(k, v)}`)
    .join(' · ');
}

export type TenantCodeScope =
  | 'CLIENT'
  | 'MATTER'
  | 'TENANT_MEMBER'
  | 'ACCESS_GROUP'
  | 'FINANCE_ACCOUNT'
  | 'FINANCE_CATEGORY'
  | 'FINANCE_COST_CENTER'
  | 'FINANCE_ENTRY'
  | 'FINANCE_RECURRENCE_TEMPLATE';

export async function nextTenantCode(
  tx: any,
  tenantId: string,
  scope: TenantCodeScope,
) {
  const counterModel = tx?.tenantCodeCounter;

  if (counterModel?.upsert) {
    const row = await counterModel.upsert({
      where: { tenantId_scope: { tenantId, scope } },
      create: { tenantId, scope, value: 1 },
      update: { value: { increment: 1 } },
      select: { value: true },
    });
    return row.value;
  }

  // Fallback para testes antigos com mock parcial do Prisma.
  const modelName =
    scope === 'CLIENT'
      ? 'client'
      : scope === 'MATTER'
        ? 'matter'
        : scope === 'FINANCE_ACCOUNT'
          ? 'financeAccount'
          : scope === 'FINANCE_CATEGORY'
            ? 'financeCategory'
            : scope === 'FINANCE_COST_CENTER'
              ? 'financeCostCenter'
              : scope === 'FINANCE_ENTRY'
                ? 'financeEntry'
                : scope === 'FINANCE_RECURRENCE_TEMPLATE'
                  ? 'financeRecurrenceTemplate'
                  : scope === 'ACCESS_GROUP'
                    ? 'tenantAccessGroup'
                    : 'tenantMember';
  const model = tx?.[modelName];
  if (!model?.findFirst) return 1;
  const latest = await model.findFirst({
    where: { tenantId },
    select: { code: true },
    orderBy: { code: 'desc' },
  });
  return Number(latest?.code || 0) + 1;
}

export class CreateFinanceEntryDto {
  direction?: 'IN' | 'OUT' | string;
  description?: string;
  notes?: string | null;
  clientId?: string | null;
  matterId?: string | null;
  categoryId?: string;
  costCenterId?: string;
  accountId?: string;
  issueDate?: string;
  competenceDate?: string | null;
  totalAmountCents?: number;
  installmentsCount?: number;
  firstDueDate?: string;
  installmentFrequency?: 'MONTHLY' | 'WEEKLY' | 'YEARLY' | string;
}

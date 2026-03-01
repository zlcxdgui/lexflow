export class CreateFinanceRecurrenceTemplateDto {
  name?: string;
  isActive?: boolean;
  direction?: 'IN' | 'OUT' | string;
  description?: string;
  notes?: string | null;
  clientId?: string | null;
  matterId?: string | null;
  categoryId?: string;
  costCenterId?: string;
  accountId?: string;
  amountCents?: number;
  frequency?: 'MONTHLY' | 'WEEKLY' | 'YEARLY' | string;
  installmentsPerGeneration?: number;
  dayOfMonth?: number | null;
  startDate?: string;
  endDate?: string | null;
}

export class UpdateFinanceEntryDto {
  description?: string;
  notes?: string | null;
  clientId?: string | null;
  matterId?: string | null;
  categoryId?: string;
  costCenterId?: string;
  accountId?: string;
  issueDate?: string;
  competenceDate?: string | null;
}

export class CreateFinanceCategoryDto {
  name?: string;
  kind?: 'RECEIVABLE' | 'PAYABLE' | 'BOTH' | string;
  isActive?: boolean;
}

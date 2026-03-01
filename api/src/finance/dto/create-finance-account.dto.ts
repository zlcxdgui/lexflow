export class CreateFinanceAccountDto {
  name?: string;
  type?: 'CASH' | 'BANK' | 'DIGITAL' | string;
  isActive?: boolean;
}

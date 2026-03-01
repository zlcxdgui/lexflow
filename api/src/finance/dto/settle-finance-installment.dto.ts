export class SettleFinanceInstallmentDto {
  paidAt?: string;
  paidAmountCents?: number;
  discountCents?: number;
  interestCents?: number;
  fineCents?: number;
  accountId?: string | null;
  paymentMethod?:
    | 'CASH'
    | 'PIX'
    | 'BANK_TRANSFER'
    | 'CARD'
    | 'OTHER'
    | string
    | null;
  notes?: string | null;
}

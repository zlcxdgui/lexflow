export class CreateDeadlineDto {
  title: string;
  type?: string;
  dueDate: string; // ISO ou YYYY-MM-DD
  notes?: string;
  allowPast?: boolean;
}

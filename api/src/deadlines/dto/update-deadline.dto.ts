export class UpdateDeadlineDto {
  title?: string;
  type?: string;
  dueDate?: string;
  notes?: string | null;
  isDone?: boolean;
  allowPast?: boolean;
}

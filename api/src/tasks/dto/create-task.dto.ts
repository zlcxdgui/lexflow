export class CreateTaskDto {
  matterId?: string;
  title: string;
  description?: string;
  priority?: string; // LOW/MEDIUM/HIGH
  dueDate?: string; // ISO: "2026-02-10T18:00:00.000Z" ou "2026-02-10"
  assignedToUserId?: string;
}

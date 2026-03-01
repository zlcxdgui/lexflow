export class UpdateTaskDto {
  title?: string;
  description?: string;
  status?: string; // OPEN/DOING/DONE/CANCELED
  priority?: string; // LOW/MEDIUM/HIGH
  dueDate?: string | null;
  assignedToUserId?: string | null;
}

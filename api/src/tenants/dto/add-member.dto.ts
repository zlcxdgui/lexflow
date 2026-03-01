export class AddMemberDto {
  email!: string;
  role!: 'OWNER' | 'LAWYER' | 'ASSISTANT';
  fullName?: string;
  employeeClientId!: string;
  settings?: {
    supervisor?: boolean;
    receivesReleaseCenterNotifications?: boolean;
    blockAccessAfter?: string | null;
    passwordRotateDays?: number | null;
    language?: string;
    timezone?: string;
    modulePermissions?: string[];
    groupPermissions?: string[];
    accessScheduleEnabled?: boolean;
    accessSchedule?: Array<{ day: number; start: string; end: string }>;
  };
}

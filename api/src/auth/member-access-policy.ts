type MemberSettings = {
  blockAccessAfter?: string | null;
  passwordRotateDays?: number | null;
  timezone?: string;
  accessScheduleEnabled?: unknown;
  accessSchedule?: Array<{ day: number; start: string; end: string }>;
};

function parseSettings(settingsJson?: string | null): MemberSettings {
  if (!settingsJson) return {};
  try {
    const parsed = JSON.parse(settingsJson) as MemberSettings;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function toStrictBool(value: unknown): boolean {
  if (value === true) return true;
  if (value === false || value == null) return false;
  const normalized = String(value).trim().toLowerCase();
  return (
    normalized === 'true' ||
    normalized === '1' ||
    normalized === 'yes' ||
    normalized === 'on'
  );
}

function parseDateOnly(
  value: string,
): { y: number; m: number; d: number } | null {
  const raw = value.trim();

  // yyyy-mm-dd
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (m) {
    const y = Number(m[1]);
    const month = Number(m[2]);
    const d = Number(m[3]);
    if (Number.isFinite(y) && Number.isFinite(month) && Number.isFinite(d)) {
      if (month >= 1 && month <= 12 && d >= 1 && d <= 31) {
        return { y, m: month, d };
      }
    }
  }

  // yyyy-mm-ddTHH:mm:ss... (legacy ISO)
  m = /^(\d{4})-(\d{2})-(\d{2})T/.exec(raw);
  if (m) {
    const y = Number(m[1]);
    const month = Number(m[2]);
    const d = Number(m[3]);
    if (Number.isFinite(y) && Number.isFinite(month) && Number.isFinite(d)) {
      if (month >= 1 && month <= 12 && d >= 1 && d <= 31) {
        return { y, m: month, d };
      }
    }
  }

  // dd/mm/yyyy (legacy display format)
  m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (m) {
    const d = Number(m[1]);
    const month = Number(m[2]);
    const y = Number(m[3]);
    if (Number.isFinite(y) && Number.isFinite(month) && Number.isFinite(d)) {
      if (month >= 1 && month <= 12 && d >= 1 && d <= 31) {
        return { y, m: month, d };
      }
    }
  }

  return null;
}

export function isMemberBlockedByDate(
  settingsJson?: string | null,
  now = new Date(),
): boolean {
  const settings = parseSettings(settingsJson);
  const raw = String(settings.blockAccessAfter || '').trim();
  if (!raw) return false;

  const parsed = parseDateOnly(raw);
  if (!parsed) return false;

  // Bloqueia quando a data atual local for posterior à data limite.
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const limit = new Date(parsed.y, parsed.m - 1, parsed.d);
  return today.getTime() > limit.getTime();
}

export function isMemberPasswordRotationExpired(
  settingsJson: string | null | undefined,
  passwordChangedAt: Date | null | undefined,
  now = new Date(),
): boolean {
  const settings = parseSettings(settingsJson);
  const rotateDays = Number(settings.passwordRotateDays ?? 0);
  if (!Number.isFinite(rotateDays) || rotateDays <= 0) return false;
  if (!passwordChangedAt) return false;

  const expiresAt =
    passwordChangedAt.getTime() + rotateDays * 24 * 60 * 60 * 1000;
  return now.getTime() >= expiresAt;
}

function parseTimeToMinutes(value: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(String(value || '').trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function currentDayAndMinutes(
  now: Date,
  timeZone: string,
): { day: number; minutes: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const year = Number(parts.find((p) => p.type === 'year')?.value || '0');
  const month = Number(parts.find((p) => p.type === 'month')?.value || '1');
  const dayOfMonth = Number(parts.find((p) => p.type === 'day')?.value || '1');
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || '0');
  const safeHour = hour === 24 ? 0 : hour;
  const day = new Date(Date.UTC(year, month - 1, dayOfMonth)).getUTCDay();
  return { day, minutes: safeHour * 60 + minute };
}

export function isMemberOutsideAccessSchedule(
  settingsJson: string | null | undefined,
  now = new Date(),
): boolean {
  const settings = parseSettings(settingsJson);
  if (!toStrictBool(settings.accessScheduleEnabled)) return false;

  const schedule = Array.isArray(settings.accessSchedule)
    ? settings.accessSchedule
    : [];
  if (schedule.length === 0) return true;

  const tz = String(settings.timezone || 'America/Manaus');
  let current: { day: number; minutes: number };
  try {
    current = currentDayAndMinutes(now, tz);
  } catch {
    current = {
      day: now.getDay(),
      minutes: now.getHours() * 60 + now.getMinutes(),
    };
  }

  const rowsToday = schedule.filter((row) => Number(row.day) === current.day);
  if (rowsToday.length === 0) return true;

  for (const row of rowsToday) {
    const start = parseTimeToMinutes(row.start);
    const end = parseTimeToMinutes(row.end);
    if (start == null || end == null) continue;

    if (start <= end) {
      if (current.minutes >= start && current.minutes <= end) return false;
    } else {
      // Faixa que atravessa meia-noite (ex.: 22:00 -> 06:00)
      if (current.minutes >= start || current.minutes <= end) return false;
    }
  }

  return true;
}

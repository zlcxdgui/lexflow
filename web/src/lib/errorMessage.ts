export const ACCESS_DENIED_MESSAGE =
  'Sem autorização. Entre em contato com o responsável do escritório.';

export function extractErrorMessage(
  raw: string,
  fallback = 'Erro inesperado',
  statusCode?: number,
) {
  if (statusCode === 401 || statusCode === 403) {
    return ACCESS_DENIED_MESSAGE;
  }

  const text = String(raw || '').trim();
  if (!text) return fallback;

  try {
    const parsed = JSON.parse(text) as {
      message?: unknown;
      detail?: unknown;
      error?: unknown;
    };
    if (typeof parsed?.message === 'string' && parsed.message.trim()) {
      if (/sem acesso|sem autoriza|forbidden|unauthorized/i.test(parsed.message)) {
        return ACCESS_DENIED_MESSAGE;
      }
      return parsed.message;
    }
    if (typeof parsed?.detail === 'string' && parsed.detail.trim()) {
      if (/sem acesso|sem autoriza|forbidden|unauthorized/i.test(parsed.detail)) {
        return ACCESS_DENIED_MESSAGE;
      }
      return parsed.detail;
    }
    if (Array.isArray(parsed?.message) && parsed.message[0]) {
      const msg = String(parsed.message[0]);
      if (/sem acesso|sem autoriza|forbidden|unauthorized/i.test(msg)) {
        return ACCESS_DENIED_MESSAGE;
      }
      return msg;
    }
  } catch {
    // plain text
  }

  if (/sem acesso|sem autoriza|forbidden|unauthorized/i.test(text)) {
    return ACCESS_DENIED_MESSAGE;
  }

  return text;
}

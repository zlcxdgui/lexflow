export class ApiError extends Error {
  status: number;
  bodyText: string;

  constructor(status: number, bodyText: string) {
    super(`Erro da API ${status}: ${bodyText}`);
    this.status = status;
    this.bodyText = bodyText;
  }
}

function apiUrl() {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error('NEXT_PUBLIC_API_URL não configurado');
  return url.replace(/\/+$/, '');
}

export async function clientGet<T>(path: string): Promise<T> {
  const resp = await fetch(`${apiUrl()}${path}`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => '');
    throw new ApiError(resp.status, err);
  }
  return resp.json() as Promise<T>;
}

export async function clientPost<T>(path: string, body?: unknown): Promise<T> {
  const resp = await fetch(`${apiUrl()}${path}`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => '');
    throw new ApiError(resp.status, err);
  }
  return resp.json() as Promise<T>;
}

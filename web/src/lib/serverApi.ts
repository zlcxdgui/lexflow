import 'server-only';
import { cookies } from 'next/headers';

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

async function authHeader(): Promise<Record<string, string>> {
  const store = await cookies();
  const token = store.get('lexflow_token')?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiGet<T>(path: string): Promise<T> {
  const resp = await fetch(`${apiUrl()}${path}`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      ...(await authHeader()),
      Accept: 'application/json',
    },
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => '');
    throw new ApiError(resp.status, err);
  }
  return resp.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const resp = await fetch(`${apiUrl()}${path}`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      ...(await authHeader()),
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

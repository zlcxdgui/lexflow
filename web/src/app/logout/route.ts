import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function clearCookie(res: NextResponse, name: string) {
  // Apaga no path padrão
  res.cookies.set(name, '', { httpOnly: true, path: '/', expires: new Date(0) });

  // Algumas libs criam cookie com path diferente; tentamos também o path vazio (fallback)
  res.cookies.set(name, '', { httpOnly: true, path: '', expires: new Date(0) });

  // Variações comuns (SameSite/Secure) — não faz mal repetir
  res.cookies.set(name, '', {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: false,
    expires: new Date(0),
  });

  res.cookies.set(name, '', {
    httpOnly: true,
    path: '/',
    sameSite: 'none',
    secure: true,
    expires: new Date(0),
  });
}

export async function GET(req: NextRequest) {
  const url = new URL('/login', req.url);
  const res = NextResponse.redirect(url);

  clearCookie(res, 'lexflow_token');

  // Se você tiver outro cookie no futuro, limpe aqui também:
  // clearCookie(res, 'lexflow_refresh');

  return res;
}

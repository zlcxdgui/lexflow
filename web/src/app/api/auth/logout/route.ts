import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'));

  // apaga cookie HttpOnly
  res.cookies.set('lexflow_token', '', {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: false, // em prod: true (https)
    maxAge: 0,
  });

  return res;
}

// (Opcional) Se alguém acessar via GET no navegador, também redireciona:
export async function GET() {
  const res = NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'));

  res.cookies.set('lexflow_token', '', {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: false,
    maxAge: 0,
  });

  return res;
}

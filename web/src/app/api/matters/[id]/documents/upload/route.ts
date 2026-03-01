import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  if (!API_URL) return new NextResponse(String("NEXT_PUBLIC_API_URL não configurado"), { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } });

  const token = (await cookies()).get("lexflow_token")?.value;
  if (!token) return new NextResponse('Não autorizado', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const { id } = await context.params;

  const form = await req.formData();

  const resp = await fetch(`${API_URL}/matters/${id}/documents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  const text = await resp.text();
  if (!resp.ok) return new NextResponse(text, { status: resp.status });

  // Depois de upload, volta pro caso
  return NextResponse.redirect(new URL(`/matters/${id}`, req.url), 303);
}

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  if (!API_URL) return new NextResponse(String("NEXT_PUBLIC_API_URL não configurado"), { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } });

  const token = (await cookies()).get("lexflow_token")?.value;
  if (!token) return new NextResponse('Não autorizado', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const { id } = await context.params;

  const resp = await fetch(`${API_URL}/documents/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  const referer = req.headers.get("referer") || "/matters";

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    return new NextResponse(txt, { status: resp.status });
  }

  // volta para a página anterior
  return NextResponse.redirect(referer, 303);
}

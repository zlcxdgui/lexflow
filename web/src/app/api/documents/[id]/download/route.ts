import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getApiUrl() {
  const raw =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.API_URL ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const API_URL = getApiUrl();
  if (!API_URL) return new NextResponse(String("NEXT_PUBLIC_API_URL não configurado"), { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } });

  const token = (await cookies()).get("lexflow_token")?.value;
  if (!token) return new NextResponse('Não autorizado', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const params = await ctx.params;
  const id = params?.id;
  if (!id) return new NextResponse(String("Parâmetro id ausente"), { status: 400, headers: { 'content-type': 'text/plain; charset=utf-8' } });

  const resp = await fetch(`${API_URL}/documents/${id}/download`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    return new NextResponse(txt, { status: resp.status });
  }

  const headers = new Headers(resp.headers);
  const data = await resp.arrayBuffer();
  return new NextResponse(data, { status: 200, headers });
}

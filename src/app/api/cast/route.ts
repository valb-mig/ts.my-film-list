export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

// "Transmitir no projetor": the projector hub (github.com/valb-mig/projetor-miracast) runs on
// this same machine and opens the TV version on the projector. The phone never talks to the hub
// directly — this route does, over localhost, which is the only place the hub accepts it from.
const HUB_URL = process.env.PROJETOR_HUB_URL ?? "http://127.0.0.1:8765";

async function hub(init?: RequestInit) {
  return fetch(`${HUB_URL}/cast`, { ...init, cache: "no-store", signal: AbortSignal.timeout(1500) });
}

// Is the hub on the projector right now? Also hands over its phone-remote page.
export async function GET() {
  try {
    const res = await hub();
    const data = res.ok ? ((await res.json()) as { remote?: string }) : null;
    return NextResponse.json({ available: Boolean(data), remote: data?.remote ?? null });
  } catch {
    return NextResponse.json({ available: false, remote: null });
  }
}

// Plays a title on the projector: the hub opens /tv?t=<id>[&s=&e=]&play=1.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { id?: unknown; season?: unknown; episode?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!/^[\w-]{1,40}$/.test(id)) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const params = new URLSearchParams({ t: id });
  const season = Number(body?.season);
  const episode = Number(body?.episode);
  if (Number.isInteger(season) && season > 0 && Number.isInteger(episode) && episode > 0) {
    params.set("s", String(season));
    params.set("e", String(episode));
  }
  params.set("play", "1");
  try {
    const res = await hub({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: `/tv?${params}` }),
    });
    if (!res.ok) throw new Error(`hub answered ${res.status}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Cast failed:", err);
    return NextResponse.json({ error: "O hub do projetor não está aberto" }, { status: 503 });
  }
}

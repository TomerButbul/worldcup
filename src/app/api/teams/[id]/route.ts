import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCachedTeam } from "@/lib/teamProfile";

// National-team profile for the tap-to-open team card. Auth-gated (app-only),
// reads cached public tournament data — cheap even when many viewers tap the
// same nation. Mirrors /api/players/[id].
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const tid = Number.parseInt(id, 10);
  if (!Number.isFinite(tid)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const profile = await getCachedTeam(tid);
  if (!profile) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(profile);
}

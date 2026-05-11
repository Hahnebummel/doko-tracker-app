import { NextResponse } from "next/server";
import { supabase } from "@/utils/supabase/client";

// Diese Route soll nie gecacht werden, sondern bei jedem Aufruf
// tatsächlich die Supabase-Datenbank anstoßen.
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = new Date().toISOString();

  // Minimale, harmlose Query: einen Spieler ziehen.
  // Das reicht aus, damit Supabase die Datenbank als aktiv markiert.
  const { error } = await supabase
    .from("players")
    .select("id")
    .limit(1);

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        startedAt,
        error: error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    startedAt,
    finishedAt: new Date().toISOString(),
  });
}

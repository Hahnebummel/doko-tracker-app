"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { buildPlayerOverviewStats } from "@/utils/player-overview-stats";

type Player = {
  id: string;
  display_name: string;
};

type SessionEvent = {
  id: string;
  session_id: string;
  event_type: "game" | "incident";
  game_kind: "normal" | "solo" | "wedding_game" | null;
  solo_type: string | null;
  solo_player_id: string | null;
};

type EventParticipant = {
  event_id: string;
  player_id: string;
  players?:
    | { id?: string; display_name?: string | null }
    | { id?: string; display_name?: string | null }[]
    | null;
};

type EventResult = {
  event_id: string;
  player_id: string;
  penalty_points: number;
};

type PlayerOverviewRow = {
  playerId: string;
  playerName: string;
  totalPenaltyPoints: number;
  gamesPlayed: number;
  avgPenaltyPerGame: number | null;
  solosPlayed: number;
  soloWins: number;
  soloWinRate: number | null;
};

export default function StatsPage() {
  const [rows, setRows] = useState<PlayerOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      setError(null);

      const { data: playersData, error: playersError } = await supabase
        .from("players")
        .select("id, display_name")
        .eq("is_active", true)
        .order("display_name", { ascending: true });

      if (playersError) {
        setError(playersError.message);
        setLoading(false);
        return;
      }

      const { data: sessionEventsData, error: sessionEventsError } = await supabase
        .from("session_events")
        .select("id, session_id, event_type, game_kind, solo_type, solo_player_id");

      if (sessionEventsError) {
        setError(sessionEventsError.message);
        setLoading(false);
        return;
      }

      const { data: eventParticipantsData, error: eventParticipantsError } =
        await supabase.from("event_participants").select(`
          event_id,
          player_id,
          players (
            id,
            display_name
          )
        `);

      if (eventParticipantsError) {
        setError(eventParticipantsError.message);
        setLoading(false);
        return;
      }

      const { data: eventResultsData, error: eventResultsError } = await supabase
        .from("event_results")
        .select("event_id, player_id, penalty_points");

      if (eventResultsError) {
        setError(eventResultsError.message);
        setLoading(false);
        return;
      }

      const players = (playersData || []) as Player[];
      const sessionEvents = (sessionEventsData || []) as SessionEvent[];
      const eventParticipants = (eventParticipantsData || []) as EventParticipant[];
      const eventResults = (eventResultsData || []) as EventResult[];

      const statRows = buildPlayerOverviewStats({
        players,
        sessionEvents,
        eventParticipants,
        eventResults,
      });

      setRows(statRows);
      setLoading(false);
    }

    loadStats();
  }, []);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.2em] text-neutral-400">
              Langzeit-Auswertung
            </p>
            <h1 className="text-3xl font-bold sm:text-4xl">Gesamtstatistik</h1>
          </div>

          <Link
            href="/"
            className="rounded-2xl border border-neutral-700 px-4 py-3 text-center font-medium transition hover:bg-neutral-100 hover:text-neutral-900"
          >
            Zurück
          </Link>
        </div>

        {loading && (
          <div className="rounded-3xl border border-neutral-800 p-5 text-neutral-400">
            Lade Statistik...
          </div>
        )}

        {error && (
          <div className="rounded-3xl border border-red-800/60 bg-red-950/40 p-5 text-red-300">
            Fehler: {error}
          </div>
        )}

        {!loading && !error && (
          <section className="space-y-4">
            <div>
              <p className="text-sm text-neutral-400">
                Kompakte Übersicht aller Spieler über alle erfassten Spielabende.
              </p>
            </div>

            <div className="grid gap-3 md:hidden">
              {rows.map((row, index) => (
                <div
                  key={row.playerId}
                  className="rounded-3xl border border-neutral-800 bg-neutral-900/60 p-5"
                >
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-sm text-neutral-400">
                        {index + 1}.
                      </span>
                      <span className="text-lg font-semibold">{row.playerName}</span>
                    </div>

                    <span className="rounded-full border border-neutral-700 px-3 py-1 text-sm font-medium text-neutral-200">
                      {row.totalPenaltyPoints} Punkte
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl border border-neutral-800 p-4">
                      <p className="mb-1 text-neutral-400">Spiele</p>
                      <p className="font-medium">{row.gamesPlayed}</p>
                    </div>

                    <div className="rounded-2xl border border-neutral-800 p-4">
                      <p className="mb-1 text-neutral-400">Ø / Spiel</p>
                      <p className="font-medium">
                        {row.avgPenaltyPerGame !== null
                          ? row.avgPenaltyPerGame.toFixed(1)
                          : "—"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-neutral-800 p-4">
                      <p className="mb-1 text-neutral-400">Soli</p>
                      <p className="font-medium">{row.solosPlayed}</p>
                    </div>

                    <div className="rounded-2xl border border-neutral-800 p-4">
                      <p className="mb-1 text-neutral-400">Solo-Quote</p>
                      <p className="font-medium">
                        {row.soloWinRate !== null
                          ? `${Math.round(row.soloWinRate)} %`
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-hidden rounded-3xl border border-neutral-800 md:block">
              <div className="grid grid-cols-6 gap-4 border-b border-neutral-800 bg-neutral-900/80 px-5 py-4 text-sm text-neutral-400">
                <div>Spieler</div>
                <div className="text-right">Strafpunkte</div>
                <div className="text-right">Spiele</div>
                <div className="text-right">Ø / Spiel</div>
                <div className="text-right">Soli</div>
                <div className="text-right">Solo-Quote</div>
              </div>

              <div className="divide-y divide-neutral-800">
                {rows.map((row, index) => (
                  <div
                    key={row.playerId}
                    className="grid grid-cols-6 gap-4 px-5 py-4 text-sm hover:bg-neutral-900/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-neutral-500">{index + 1}.</span>
                      <span className="font-medium text-neutral-100">
                        {row.playerName}
                      </span>
                    </div>

                    <div className="text-right font-semibold text-neutral-100">
                      {row.totalPenaltyPoints}
                    </div>

                    <div className="text-right text-neutral-300">
                      {row.gamesPlayed}
                    </div>

                    <div className="text-right text-neutral-300">
                      {row.avgPenaltyPerGame !== null
                        ? row.avgPenaltyPerGame.toFixed(1)
                        : "—"}
                    </div>

                    <div className="text-right text-neutral-300">
                      {row.solosPlayed}
                    </div>

                    <div className="text-right text-neutral-300">
                      {row.soloWinRate !== null
                        ? `${Math.round(row.soloWinRate)} %`
                        : "—"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
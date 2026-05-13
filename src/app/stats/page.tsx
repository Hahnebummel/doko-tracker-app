"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, BarChart3, Trophy } from "lucide-react";
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
  gameWins: number;
  gameWinRate: number | null;
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
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-amber-400" />
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-400/80">
                Langzeit-Auswertung
              </p>
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Gesamtstatistik
            </h1>
            <p className="mt-2 text-neutral-400">
              Kompakte Übersicht aller Spieler über alle erfassten Spielabende.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-neutral-700 px-4 py-3 text-center font-medium transition hover:border-neutral-500 hover:bg-neutral-900"
          >
            <ArrowLeft className="h-4 w-4" />
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
            {/* Reduzierte Sicht: nur im Hochformat auf kleinen Bildschirmen */}
            <div className="overflow-hidden rounded-3xl border border-neutral-800 md:hidden landscape:hidden">
              <div className="grid grid-cols-[1.5rem_1fr_auto_auto] gap-3 border-b border-neutral-800 bg-neutral-900/80 px-4 py-3 text-xs font-medium uppercase tracking-wider text-neutral-400">
                <div></div>
                <div>Spieler</div>
                <div className="text-right">Ø/Spiel</div>
                <div className="w-12 text-right">Quote</div>
              </div>

              <div className="divide-y divide-neutral-800">
                {rows.map((row, index) => {
                  const isLeader = index === 0;
                  return (
                    <div
                      key={row.playerId}
                      className={`grid grid-cols-[1.5rem_1fr_auto_auto] items-center gap-3 px-4 py-3 text-sm ${
                        isLeader ? "bg-amber-400/[0.04]" : ""
                      }`}
                    >
                      <div className="flex items-center justify-center">
                        {isLeader ? (
                          <Trophy className="h-4 w-4 text-amber-400" />
                        ) : (
                          <span className="text-neutral-500 tabular-nums">
                            {index + 1}
                          </span>
                        )}
                      </div>
                      <span
                        className={`truncate font-medium ${
                          isLeader ? "text-amber-100" : "text-neutral-100"
                        }`}
                      >
                        {row.playerName}
                      </span>
                      <span
                        className={`text-right font-semibold tabular-nums ${
                          isLeader ? "text-amber-300" : ""
                        }`}
                      >
                        {row.avgPenaltyPerGame !== null
                          ? row.avgPenaltyPerGame.toFixed(1)
                          : "—"}
                      </span>
                      <span className="w-12 text-right text-neutral-300 tabular-nums">
                        {row.gameWinRate !== null
                          ? `${Math.round(row.gameWinRate)}%`
                          : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hinweis: nur im Hochformat auf kleinen Bildschirmen */}
            <p className="text-xs text-neutral-500 md:hidden landscape:hidden">
              Alle Werte sichtbar im Querformat oder auf größerem Bildschirm.
            </p>

            {/* Volle Tabelle: im Querformat (auch auf dem Handy) und auf größeren Bildschirmen */}
            <div className="hidden overflow-hidden rounded-3xl border border-neutral-800 landscape:block md:block">
              <div className="grid grid-cols-[1.75rem_minmax(0,1.5fr)_repeat(6,minmax(0,1fr))] gap-2 border-b border-neutral-800 bg-neutral-900/80 px-3 py-3 text-xs font-medium text-neutral-400 sm:gap-4 sm:px-5 sm:py-4 sm:text-sm">
                <div></div>
                <div>Spieler</div>
                <div className="text-right">Ø/Spiel</div>
                <div className="text-right">Strafp.</div>
                <div className="text-right">Quote</div>
                <div className="text-right">Spiele</div>
                <div className="text-right">Soli</div>
                <div className="text-right">Solo-Quote</div>
              </div>

              <div className="divide-y divide-neutral-800">
                {rows.map((row, index) => {
                  const isLeader = index === 0;
                  return (
                    <div
                      key={row.playerId}
                      className={`grid grid-cols-[1.75rem_minmax(0,1.5fr)_repeat(6,minmax(0,1fr))] items-center gap-2 px-3 py-3 text-xs transition hover:bg-neutral-900/60 sm:gap-4 sm:px-5 sm:py-3 sm:text-sm ${
                        isLeader ? "bg-amber-400/[0.03]" : ""
                      }`}
                    >
                      <div className="flex items-center justify-center">
                        {isLeader ? (
                          <Trophy className="h-4 w-4 text-amber-400" />
                        ) : (
                          <span className="text-neutral-500 tabular-nums">
                            {index + 1}
                          </span>
                        )}
                      </div>

                      <span
                        className={`truncate font-medium ${
                          isLeader ? "text-amber-100" : "text-neutral-100"
                        }`}
                      >
                        {row.playerName}
                      </span>

                      <div
                        className={`text-right font-semibold tabular-nums ${
                          isLeader ? "text-amber-300" : "text-neutral-100"
                        }`}
                      >
                        {row.avgPenaltyPerGame !== null
                          ? row.avgPenaltyPerGame.toFixed(1)
                          : "—"}
                      </div>

                      <div className="text-right text-neutral-300 tabular-nums">
                        {row.totalPenaltyPoints}
                      </div>

                      <div className="text-right text-neutral-300 tabular-nums">
                        {row.gameWinRate !== null
                          ? `${Math.round(row.gameWinRate)} %`
                          : "—"}
                      </div>

                      <div className="text-right text-neutral-300 tabular-nums">
                        {row.gamesPlayed}
                      </div>

                      <div className="text-right text-neutral-300 tabular-nums">
                        {row.solosPlayed}
                      </div>

                      <div className="text-right text-neutral-300 tabular-nums">
                        {row.soloWinRate !== null
                          ? `${Math.round(row.soloWinRate)} %`
                          : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
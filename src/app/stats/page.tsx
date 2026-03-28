"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type Player = {
  id: string;
  display_name: string;
};

type SessionParticipant = {
  session_id: string;
  player_id: string;
};

type SessionEvent = {
  id: string;
  session_id: string;
  event_type: "game" | "incident";
};

type EventParticipant = {
  event_id: string;
  player_id: string;
};

type EventResult = {
  event_id: string;
  player_id: string;
  penalty_points: number;
};

type StatRow = {
  player_id: string;
  display_name: string;
  total_penalty_points: number;
  games_played: number;
  incidents_involved: number;
  sessions_attended: number;
};

export default function StatsPage() {
  const [rows, setRows] = useState<StatRow[]>([]);
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

      const { data: sessionParticipantsData, error: sessionParticipantsError } =
        await supabase.from("session_participants").select("session_id, player_id");

      if (sessionParticipantsError) {
        setError(sessionParticipantsError.message);
        setLoading(false);
        return;
      }

      const { data: sessionEventsData, error: sessionEventsError } = await supabase
        .from("session_events")
        .select("id, session_id, event_type");

      if (sessionEventsError) {
        setError(sessionEventsError.message);
        setLoading(false);
        return;
      }

      const { data: eventParticipantsData, error: eventParticipantsError } =
        await supabase.from("event_participants").select("event_id, player_id");

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
      const sessionParticipants = (sessionParticipantsData || []) as SessionParticipant[];
      const sessionEvents = (sessionEventsData || []) as SessionEvent[];
      const eventParticipants = (eventParticipantsData || []) as EventParticipant[];
      const eventResults = (eventResultsData || []) as EventResult[];

      const eventsById = new Map<string, SessionEvent>();
      sessionEvents.forEach((event) => {
        eventsById.set(event.id, event);
      });

      const sessionAttendanceMap = new Map<string, Set<string>>();
      sessionParticipants.forEach((row) => {
        if (!sessionAttendanceMap.has(row.player_id)) {
          sessionAttendanceMap.set(row.player_id, new Set());
        }
        sessionAttendanceMap.get(row.player_id)!.add(row.session_id);
      });

      const gamesPlayedMap = new Map<string, number>();
      const incidentsInvolvedMap = new Map<string, number>();

      eventParticipants.forEach((row) => {
        const event = eventsById.get(row.event_id);
        if (!event) return;

        if (event.event_type === "game") {
          gamesPlayedMap.set(row.player_id, (gamesPlayedMap.get(row.player_id) || 0) + 1);
        }

        if (event.event_type === "incident") {
          incidentsInvolvedMap.set(
            row.player_id,
            (incidentsInvolvedMap.get(row.player_id) || 0) + 1
          );
        }
      });

      const totalPenaltyMap = new Map<string, number>();
      eventResults.forEach((row) => {
        totalPenaltyMap.set(
          row.player_id,
          (totalPenaltyMap.get(row.player_id) || 0) + (row.penalty_points || 0)
        );
      });

      const statRows: StatRow[] = players.map((player) => ({
        player_id: player.id,
        display_name: player.display_name,
        total_penalty_points: totalPenaltyMap.get(player.id) || 0,
        games_played: gamesPlayedMap.get(player.id) || 0,
        incidents_involved: incidentsInvolvedMap.get(player.id) || 0,
        sessions_attended: sessionAttendanceMap.get(player.id)?.size || 0,
      }));

      statRows.sort((a, b) => {
        if (a.total_penalty_points !== b.total_penalty_points) {
          return a.total_penalty_points - b.total_penalty_points;
        }
        return a.display_name.localeCompare(b.display_name);
      });

      setRows(statRows);
      setLoading(false);
    }

    loadStats();
  }, []);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50">
      <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-neutral-400 mb-2">
              Langzeit-Auswertung
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold">Gesamtstatistik</h1>
          </div>

          <Link
            href="/"
            className="rounded-2xl border border-neutral-700 px-4 py-3 font-medium text-center hover:bg-neutral-100 hover:text-neutral-900 transition"
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
          <div className="space-y-3">
            <div className="hidden md:grid md:grid-cols-5 gap-4 rounded-3xl border border-neutral-800 px-5 py-4 text-sm text-neutral-400">
              <div>Spieler</div>
              <div>Gesamtstrafpunkte</div>
              <div>Gespielte Spiele</div>
              <div>Inzidenzen</div>
              <div>Anwesende Abende</div>
            </div>

            {rows.map((row, index) => (
              <div
                key={row.player_id}
                className="rounded-3xl border border-neutral-800 p-5"
              >
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-neutral-400 w-6">{index + 1}.</span>
                    <span className="text-lg font-semibold">{row.display_name}</span>
                  </div>
                  <span className="text-xl font-bold">{row.total_penalty_points}</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="rounded-2xl border border-neutral-800 p-4">
                    <p className="text-neutral-400 mb-1">Spiele</p>
                    <p>{row.games_played}</p>
                  </div>
                  <div className="rounded-2xl border border-neutral-800 p-4">
                    <p className="text-neutral-400 mb-1">Inzidenzen</p>
                    <p>{row.incidents_involved}</p>
                  </div>
                  <div className="rounded-2xl border border-neutral-800 p-4">
                    <p className="text-neutral-400 mb-1">Abende</p>
                    <p>{row.sessions_attended}</p>
                  </div>
                  <div className="rounded-2xl border border-neutral-800 p-4">
                    <p className="text-neutral-400 mb-1">Strafpunkte</p>
                    <p className="font-semibold">{row.total_penalty_points}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

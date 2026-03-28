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
        await supabase
          .from("session_participants")
          .select("session_id, player_id");

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
        await supabase
          .from("event_participants")
          .select("event_id, player_id");

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
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <h1 className="text-3xl font-bold">Gesamtstatistik</h1>

        <Link
          href="/"
          className="rounded-xl border px-4 py-2 font-medium hover:bg-white hover:text-black transition"
        >
          Zurück
        </Link>
      </div>

      {loading && <p>Lade Statistik...</p>}

      {error && <p className="text-red-600">Fehler: {error}</p>}

      {!loading && !error && (
        <div className="space-y-4">
          <div className="grid grid-cols-5 gap-4 font-semibold border rounded-2xl p-4">
            <div>Spieler</div>
            <div>Gesamtstrafpunkte</div>
            <div>Gespielte Spiele</div>
            <div>Inzidenzen</div>
            <div>Anwesende Abende</div>
          </div>

          {rows.map((row) => (
            <div
              key={row.player_id}
              className="grid grid-cols-5 gap-4 border rounded-2xl p-4"
            >
              <div>{row.display_name}</div>
              <div className="font-semibold">{row.total_penalty_points}</div>
              <div>{row.games_played}</div>
              <div>{row.incidents_involved}</div>
              <div>{row.sessions_attended}</div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

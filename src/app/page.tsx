"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type Player = {
  id: string;
  display_name: string;
};

type Session = {
  id: string;
  session_date: string;
  location: string;
  notes: string | null;
};

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export default function Home() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPlayers() {
      const { data, error } = await supabase
        .from("players")
        .select("id, display_name")
        .order("display_name", { ascending: true });

      if (error) {
        setPlayerError(error.message);
      } else {
        setPlayers(data || []);
      }

      setLoadingPlayers(false);
    }

    async function loadSessions() {
      const { data, error } = await supabase
        .from("sessions")
        .select("id, session_date, location, notes")
        .order("session_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        setSessionError(error.message);
      } else {
        setSessions(data || []);
      }

      setLoadingSessions(false);
    }

    loadPlayers();
    loadSessions();
  }, []);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-neutral-400 mb-2">
              Doppelkopf Tracker
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold">Doko Tracker</h1>
            <p className="text-neutral-400 mt-2">
              Spielabende erfassen, auswerten und vergleichen.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/stats"
              className="rounded-2xl border border-neutral-700 px-4 py-3 font-medium text-center hover:bg-neutral-100 hover:text-neutral-900 transition"
            >
              Gesamtstatistik
            </Link>

            <Link
              href="/sessions/new"
              className="rounded-2xl border border-neutral-700 px-4 py-3 font-medium text-center hover:bg-neutral-100 hover:text-neutral-900 transition"
            >
              Neuen Spielabend anlegen
            </Link>
          </div>
        </div>

        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl sm:text-2xl font-semibold">Spielabende</h2>
            <span className="text-sm text-neutral-400">
              {sessions.length} Eintrag{sessions.length === 1 ? "" : "e"}
            </span>
          </div>

          {loadingSessions && (
            <div className="rounded-3xl border border-neutral-800 p-5 text-neutral-400">
              Lade Spielabende...
            </div>
          )}

          {sessionError && (
            <div className="rounded-3xl border border-red-800/60 bg-red-950/40 p-5 text-red-300">
              Fehler beim Laden der Spielabende: {sessionError}
            </div>
          )}

          {!loadingSessions && !sessionError && sessions.length === 0 && (
            <div className="rounded-3xl border border-neutral-800 p-5 text-neutral-400">
              Noch keine Spielabende vorhanden.
            </div>
          )}

          {!loadingSessions && !sessionError && sessions.length > 0 && (
            <div className="space-y-3">
              {sessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/sessions/${session.id}`}
                  className="block rounded-3xl border border-neutral-800 p-5 hover:border-neutral-600 hover:bg-neutral-900 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-lg">{formatDate(session.session_date)}</p>
                      <p className="text-neutral-400 mt-1">{session.location}</p>
                    </div>

                    <span className="text-sm text-neutral-400">
                      Details ansehen →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl sm:text-2xl font-semibold">Spielerliste</h2>
            <span className="text-sm text-neutral-400">
              {players.length} Spieler
            </span>
          </div>

          {loadingPlayers && (
            <div className="rounded-3xl border border-neutral-800 p-5 text-neutral-400">
              Lade Spieler...
            </div>
          )}

          {playerError && (
            <div className="rounded-3xl border border-red-800/60 bg-red-950/40 p-5 text-red-300">
              Fehler beim Laden der Spieler: {playerError}
            </div>
          )}

          {!loadingPlayers && !playerError && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {players.map((player) => (
                <div
                  key={player.id}
                  className="rounded-2xl border border-neutral-800 px-4 py-4"
                >
                  {player.display_name}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

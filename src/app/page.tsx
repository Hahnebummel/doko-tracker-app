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
  return new Intl.DateTimeFormat("de-DE").format(date);
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
    <main className="min-h-screen p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <h1 className="text-3xl font-bold">Doko Tracker</h1>

        <div className="flex gap-3 flex-wrap">
          <Link
            href="/stats"
            className="rounded-xl border px-4 py-2 font-medium hover:bg-white hover:text-black transition"
          >
            Gesamtstatistik
          </Link>

          <Link
            href="/sessions/new"
            className="rounded-xl border px-4 py-2 font-medium hover:bg-white hover:text-black transition"
          >
            Neuen Spielabend anlegen
          </Link>
        </div>
      </div>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">Spielabende</h2>

        {loadingSessions && <p>Lade Spielabende...</p>}

        {sessionError && (
          <p className="text-red-600">
            Fehler beim Laden der Spielabende: {sessionError}
          </p>
        )}

        {!loadingSessions && !sessionError && sessions.length === 0 && (
          <p>Noch keine Spielabende vorhanden.</p>
        )}

        {!loadingSessions && !sessionError && sessions.length > 0 && (
          <div className="space-y-3">
            {sessions.map((session) => (
              <Link
                key={session.id}
                href={`/sessions/${session.id}`}
                className="block border rounded-xl p-4 hover:bg-white hover:text-black transition"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">{formatDate(session.session_date)}</p>
                    <p className="opacity-80">{session.location}</p>
                  </div>
                  <span className="text-sm opacity-70">Details ansehen</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Spielerliste</h2>

        {loadingPlayers && <p>Lade Spieler...</p>}

        {playerError && (
          <p className="text-red-600">
            Fehler beim Laden der Spieler: {playerError}
          </p>
        )}

        {!loadingPlayers && !playerError && (
          <ul className="space-y-2">
            {players.map((player) => (
              <li key={player.id} className="border rounded-xl p-3">
                {player.display_name}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

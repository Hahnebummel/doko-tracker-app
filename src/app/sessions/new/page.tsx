"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Plus,
  Save,
  StickyNote,
  Users,
} from "lucide-react";
import { supabase } from "@/utils/supabase/client";

type Player = {
  id: string;
  display_name: string;
};

function todayAsInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function NewSessionPage() {
  const router = useRouter();

  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [sessionDate, setSessionDate] = useState(todayAsInputValue());
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPlayers() {
      const { data, error } = await supabase
        .from("players")
        .select("id, display_name")
        .eq("is_active", true)
        .order("display_name", { ascending: true });

      if (error) {
        setError(error.message);
      } else {
        setPlayers(data || []);
      }

      setLoadingPlayers(false);
    }

    loadPlayers();
  }, []);

  function togglePlayer(playerId: string) {
    setSelectedPlayerIds((current) => {
      if (current.includes(playerId)) {
        return current.filter((id) => id !== playerId);
      }
      return [...current, playerId];
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!sessionDate) {
      setError("Bitte ein Datum wählen.");
      return;
    }

    if (!location.trim()) {
      setError("Bitte einen Ort eingeben.");
      return;
    }

    if (selectedPlayerIds.length < 4) {
      setError("Bitte mindestens 4 anwesende Spieler auswählen.");
      return;
    }

    if (selectedPlayerIds.length > 7) {
      setError("Es dürfen höchstens 7 Spieler ausgewählt werden.");
      return;
    }

    setSaving(true);

    const { data: sessionData, error: sessionError } = await supabase
      .from("sessions")
      .insert({
        session_date: sessionDate,
        location: location.trim(),
        notes: notes.trim() || null,
      })
      .select("id")
      .single();

    if (sessionError || !sessionData) {
      setSaving(false);
      setError(sessionError?.message || "Spielabend konnte nicht angelegt werden.");
      return;
    }

    const participantRows = selectedPlayerIds.map((playerId) => ({
      session_id: sessionData.id,
      player_id: playerId,
    }));

    const { error: participantsError } = await supabase
      .from("session_participants")
      .insert(participantRows);

    setSaving(false);

    if (participantsError) {
      setError(participantsError.message);
      return;
    }

    router.push("/");
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Plus className="w-4 h-4 text-amber-400" />
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-400/80">
                Neuer Spielabend
              </p>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Spielabend anlegen
            </h1>
            <p className="mt-2 text-neutral-400">
              Datum, Ort und anwesende Spieler erfassen.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-neutral-700 px-4 py-3 font-medium text-center hover:border-neutral-500 hover:bg-neutral-900 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Zurück
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-3xl border border-red-800/60 bg-red-950/40 p-4 text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-3xl border border-neutral-800 bg-neutral-900/30 p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-amber-400/80" />
              <h2 className="text-xl font-semibold">Rahmendaten</h2>
            </div>

            <div className="space-y-2">
              <label htmlFor="sessionDate" className="block text-sm font-medium text-neutral-300">
                Datum
              </label>
              <input
                id="sessionDate"
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-neutral-50 placeholder:text-neutral-500 focus:border-amber-400/50 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="location" className="block text-sm font-medium text-neutral-300">
                <span className="inline-flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Ort
                </span>
              </label>
              <input
                id="location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="z. B. Christophs Wohnung"
                className="w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-neutral-50 placeholder:text-neutral-500 focus:border-amber-400/50 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="notes" className="block text-sm font-medium text-neutral-300">
                <span className="inline-flex items-center gap-2">
                  <StickyNote className="w-4 h-4" />
                  Notiz
                </span>
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional"
                rows={3}
                className="w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-neutral-50 placeholder:text-neutral-500 focus:border-amber-400/50 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition resize-none"
              />
            </div>
          </section>

          <section className="rounded-3xl border border-neutral-800 bg-neutral-900/30 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400/80" />
                <h2 className="text-xl font-semibold">Anwesende Spieler</h2>
              </div>
              <span className="text-sm text-neutral-400 tabular-nums">
                {selectedPlayerIds.length} von 7
              </span>
            </div>

            {loadingPlayers && (
              <p className="text-neutral-400">Lade Spieler...</p>
            )}

            {!loadingPlayers && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {players.map((player) => {
                  const checked = selectedPlayerIds.includes(player.id);

                  return (
                    <label
                      key={player.id}
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 cursor-pointer transition ${
                        checked
                          ? "border-amber-400/40 bg-amber-400/[0.06]"
                          : "border-neutral-800 bg-neutral-950/40 hover:border-neutral-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePlayer(player.id)}
                        className="h-4 w-4 accent-amber-400"
                      />
                      <span className={checked ? "text-amber-100 font-medium" : ""}>
                        {player.display_name}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </section>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl bg-amber-400 text-neutral-950 px-5 py-3 font-semibold hover:bg-amber-300 transition shadow-lg shadow-amber-400/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? "Speichere..." : "Spielabend speichern"}
          </button>
        </form>
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold">Neuen Spielabend anlegen</h1>
        <Link
          href="/"
          className="rounded-xl border px-4 py-2 font-medium hover:bg-white hover:text-black transition"
        >
          Zurück
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="sessionDate" className="block font-medium">
            Datum
          </label>
          <input
            id="sessionDate"
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            className="w-full rounded-xl border bg-transparent p-3"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="location" className="block font-medium">
            Ort
          </label>
          <input
            id="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="z. B. Christophs Wohnung"
            className="w-full rounded-xl border bg-transparent p-3"
          />
        </div>

        <div className="space-y-3">
          <p className="font-medium">Anwesende Spieler</p>

          {loadingPlayers && <p>Lade Spieler...</p>}

          {!loadingPlayers && (
            <div className="space-y-2">
              {players.map((player) => {
                const checked = selectedPlayerIds.includes(player.id);

                return (
                  <label
                    key={player.id}
                    className="flex items-center gap-3 border rounded-xl p-3 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePlayer(player.id)}
                    />
                    <span>{player.display_name}</span>
                  </label>
                );
              })}
            </div>
          )}

          <p className="text-sm opacity-80">
            Ausgewählt: {selectedPlayerIds.length} von 7
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="notes" className="block font-medium">
            Notiz
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
            rows={4}
            className="w-full rounded-xl border bg-transparent p-3"
          />
        </div>

        {error && <p className="text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl border px-5 py-3 font-medium hover:bg-white hover:text-black transition disabled:opacity-50"
        >
          {saving ? "Speichere..." : "Spielabend speichern"}
        </button>
      </form>
    </main>
  );
}

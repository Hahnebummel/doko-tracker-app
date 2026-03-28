"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

type Player = {
  id: string;
  display_name: string;
};

type SessionParticipantRow = {
  player_id: string;
  players: {
    id: string;
    display_name: string;
  } | null;
};

type EventRow = {
  id: string;
  incident_type: string | null;
  notes: string | null;
};

type EventParticipantRow = {
  player_id: string;
};

type EventResultRow = {
  player_id: string;
  penalty_points: number;
};

type ScoreMap = Record<string, string>;

function labelForIncidentType(value: string) {
  if (value === "wedding_penalty") return "Hochzeit-Störfall";
  if (value === "misdeal") return "Vergeben";
  if (value === "misplay") return "Falsch bedient";
  return value;
}

export default function EditIncidentPage() {
  const params = useParams();
  const router = useRouter();

  const sessionId = useMemo(() => {
    const rawId = params?.id;
    if (typeof rawId === "string") return rawId;
    if (Array.isArray(rawId)) return rawId[0];
    return null;
  }, [params]);

  const eventId = useMemo(() => {
    const rawId = params?.eventId;
    if (typeof rawId === "string") return rawId;
    if (Array.isArray(rawId)) return rawId[0];
    return null;
  }, [params]);

  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [scores, setScores] = useState<ScoreMap>({});

  const [incidentType, setIncidentType] = useState("wedding_penalty");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!sessionId || !eventId) {
        setError("Session oder Ereignis konnte nicht erkannt werden.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const { data: participantData, error: participantError } = await supabase
        .from("session_participants")
        .select("player_id, players(id, display_name)")
        .eq("session_id", sessionId);

      if (participantError) {
        setError(participantError.message);
        setLoading(false);
        return;
      }

      const sortedPlayers = ((participantData as unknown as SessionParticipantRow[]) || [])
        .map((row) => row.players)
        .filter(Boolean) as Player[];

      sortedPlayers.sort((a, b) => a.display_name.localeCompare(b.display_name));

      const { data: eventData, error: eventError } = await supabase
        .from("session_events")
        .select("id, incident_type, notes")
        .eq("id", eventId)
        .single();

      if (eventError) {
        setError(eventError.message);
        setLoading(false);
        return;
      }

      const { data: eventParticipantsData, error: eventParticipantsError } = await supabase
        .from("event_participants")
        .select("player_id")
        .eq("event_id", eventId);

      if (eventParticipantsError) {
        setError(eventParticipantsError.message);
        setLoading(false);
        return;
      }

      const { data: eventResultsData, error: eventResultsError } = await supabase
        .from("event_results")
        .select("player_id, penalty_points")
        .eq("event_id", eventId);

      if (eventResultsError) {
        setError(eventResultsError.message);
        setLoading(false);
        return;
      }

      const currentEvent = eventData as EventRow;
      const currentParticipants = (eventParticipantsData || []) as EventParticipantRow[];
      const currentResults = (eventResultsData || []) as EventResultRow[];

      const currentScores: ScoreMap = {};
      currentResults.forEach((row) => {
        currentScores[row.player_id] = String(row.penalty_points ?? 0);
      });

      setPlayers(sortedPlayers);
      setSelectedPlayerIds(currentParticipants.map((row) => row.player_id));
      setScores(currentScores);
      setIncidentType(currentEvent.incident_type || "wedding_penalty");
      setNotes(currentEvent.notes || "");
      setLoading(false);
    }

    loadData();
  }, [sessionId, eventId]);

  function togglePlayer(playerId: string) {
    setSelectedPlayerIds((current) => {
      if (current.includes(playerId)) {
        const updated = current.filter((id) => id !== playerId);
        setScores((prev) => {
          const copy = { ...prev };
          delete copy[playerId];
          return copy;
        });
        return updated;
      }

      return [...current, playerId];
    });
  }

  function updateScore(playerId: string, value: string) {
    setScores((prev) => ({
      ...prev,
      [playerId]: value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!sessionId || !eventId) {
      setError("Session oder Ereignis konnte nicht erkannt werden.");
      return;
    }

    if (selectedPlayerIds.length === 0) {
      setError("Bitte mindestens einen beteiligten Spieler auswählen.");
      return;
    }

    setSaving(true);

    const { error: updateEventError } = await supabase
      .from("session_events")
      .update({
        incident_type: incidentType,
        notes: notes.trim() || null,
      })
      .eq("id", eventId);

    if (updateEventError) {
      setSaving(false);
      setError(updateEventError.message);
      return;
    }

    const { error: deleteParticipantsError } = await supabase
      .from("event_participants")
      .delete()
      .eq("event_id", eventId);

    if (deleteParticipantsError) {
      setSaving(false);
      setError(deleteParticipantsError.message);
      return;
    }

    const { error: deleteResultsError } = await supabase
      .from("event_results")
      .delete()
      .eq("event_id", eventId);

    if (deleteResultsError) {
      setSaving(false);
      setError(deleteResultsError.message);
      return;
    }

    const participantRows = selectedPlayerIds.map((playerId) => ({
      event_id: eventId,
      player_id: playerId,
    }));

    const { error: insertParticipantsError } = await supabase
      .from("event_participants")
      .insert(participantRows);

    if (insertParticipantsError) {
      setSaving(false);
      setError(insertParticipantsError.message);
      return;
    }

    const resultRows = selectedPlayerIds.map((playerId) => {
      const rawValue = scores[playerId]?.trim();
      const penaltyPoints = rawValue ? Number(rawValue) : 0;

      return {
        event_id: eventId,
        player_id: playerId,
        penalty_points: Number.isNaN(penaltyPoints) ? 0 : penaltyPoints,
        notes: null,
      };
    });

    const { error: insertResultsError } = await supabase
      .from("event_results")
      .insert(resultRows);

    setSaving(false);

    if (insertResultsError) {
      setError(insertResultsError.message);
      return;
    }

    router.push(`/sessions/${sessionId}`);
  }

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold">Inzidenz bearbeiten</h1>
        <Link
          href={sessionId ? `/sessions/${sessionId}` : "/"}
          className="rounded-xl border px-4 py-2 font-medium hover:bg-white hover:text-black transition"
        >
          Zurück
        </Link>
      </div>

      {loading && <p>Lade Daten...</p>}

      {error && <p className="text-red-600 mb-4">Fehler: {error}</p>}

      {!loading && (
        <form onSubmit={handleSubmit} className="space-y-8">
          <section className="border rounded-2xl p-5 space-y-4">
            <h2 className="text-xl font-semibold">Inzidenz</h2>

            <div className="space-y-2">
              <label className="block font-medium">Inzidenz-Typ</label>
              <select
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value)}
                className="w-full rounded-xl border bg-transparent p-3"
              >
                <option value="wedding_penalty">Hochzeit-Störfall</option>
                <option value="misdeal">Vergeben</option>
                <option value="misplay">Falsch bedient</option>
              </select>
            </div>

            <p className="text-sm opacity-80">
              Gewählt: {labelForIncidentType(incidentType)}
            </p>
          </section>

          <section className="border rounded-2xl p-5 space-y-4">
            <h2 className="text-xl font-semibold">Beteiligte Spieler</h2>

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

            <p className="text-sm opacity-80">Ausgewählt: {selectedPlayerIds.length}</p>
          </section>

          <section className="border rounded-2xl p-5 space-y-4">
            <h2 className="text-xl font-semibold">Strafpunkte</h2>

            {selectedPlayerIds.length === 0 ? (
              <p className="opacity-80">Bitte zuerst beteiligte Spieler auswählen.</p>
            ) : (
              <div className="space-y-3">
                {selectedPlayerIds.map((playerId) => {
                  const player = players.find((p) => p.id === playerId);
                  if (!player) return null;

                  return (
                    <div key={playerId} className="space-y-2">
                      <label className="block font-medium">{player.display_name}</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={scores[playerId] || ""}
                        onChange={(e) => updateScore(playerId, e.target.value)}
                        className="w-full rounded-xl border bg-transparent p-3"
                        placeholder="Leer = 0"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="border rounded-2xl p-5 space-y-4">
            <h2 className="text-xl font-semibold">Notiz</h2>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full rounded-xl border bg-transparent p-3"
              placeholder="Optional"
            />
          </section>

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl border px-5 py-3 font-medium hover:bg-white hover:text-black transition disabled:opacity-50"
          >
            {saving ? "Speichere..." : "Änderungen speichern"}
          </button>
        </form>
      )}
    </main>
  );
}

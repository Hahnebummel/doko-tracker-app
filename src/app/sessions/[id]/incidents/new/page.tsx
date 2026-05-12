"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Save,
  StickyNote,
  Target,
  Users,
} from "lucide-react";
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

type ExistingEvent = {
  sequence_number: number;
};

type ScoreMap = Record<string, string>;

const inputBase =
  "w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-neutral-50 placeholder:text-neutral-500 focus:border-amber-400/50 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition";

function labelForIncidentType(value: string) {
  if (value === "wedding_penalty") return "Hochzeit-Störfall";
  if (value === "misdeal") return "Vergeben";
  if (value === "misplay") return "Falsch bedient";
  return value;
}

export default function NewIncidentPage() {
  const params = useParams();
  const router = useRouter();

  const sessionId = useMemo(() => {
    const rawId = params?.id;
    if (typeof rawId === "string") return rawId;
    if (Array.isArray(rawId)) return rawId[0];
    return null;
  }, [params]);

  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [scores, setScores] = useState<ScoreMap>({});

  const [incidentType, setIncidentType] = useState("wedding_penalty");
  const [notes, setNotes] = useState("");
  const [nextSequenceNumber, setNextSequenceNumber] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!sessionId) {
        setError("Keine gültige Session-ID gefunden.");
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
        .select("sequence_number")
        .eq("session_id", sessionId)
        .order("sequence_number", { ascending: false });

      if (eventError) {
        setError(eventError.message);
        setLoading(false);
        return;
      }

      const existingEvents = (eventData || []) as ExistingEvent[];

      const maxSequence =
        existingEvents.length > 0
          ? Math.max(...existingEvents.map((event) => event.sequence_number || 0))
          : 0;

      setPlayers(sortedPlayers);
      setNextSequenceNumber(maxSequence + 1);
      setLoading(false);
    }

    loadData();
  }, [sessionId]);

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

    if (!sessionId) {
      setError("Keine gültige Session-ID gefunden.");
      return;
    }

    if (!nextSequenceNumber) {
      setError("Nächste Ereignisnummer konnte nicht ermittelt werden.");
      return;
    }

    if (selectedPlayerIds.length === 0) {
      setError("Bitte mindestens einen beteiligten Spieler auswählen.");
      return;
    }

    setSaving(true);

    const { data: insertedEvent, error: eventError } = await supabase
      .from("session_events")
      .insert({
        session_id: sessionId,
        sequence_number: nextSequenceNumber,
        event_type: "incident",
        game_number: null,
        game_kind: null,
        solo_type: null,
        solo_player_id: null,
        bock_level: "none",
        special_round_type: "none",
        incident_type: incidentType,
        notes: notes.trim() || null,
      })
      .select("id")
      .single();

    if (eventError || !insertedEvent) {
      setSaving(false);
      setError(eventError?.message || "Inzidenz konnte nicht gespeichert werden.");
      return;
    }

    const eventId = insertedEvent.id;

    const participantRows = selectedPlayerIds.map((playerId) => ({
      event_id: eventId,
      player_id: playerId,
    }));

    const { error: participantInsertError } = await supabase
      .from("event_participants")
      .insert(participantRows);

    if (participantInsertError) {
      setSaving(false);
      setError(participantInsertError.message);
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

    const { error: resultInsertError } = await supabase
      .from("event_results")
      .insert(resultRows);

    setSaving(false);

    if (resultInsertError) {
      setError(resultInsertError.message);
      return;
    }

    router.push(`/sessions/${sessionId}`);
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-400/80">
                Neue Inzidenz
              </p>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Inzidenz erfassen
            </h1>
            <p className="mt-2 text-neutral-400">
              Störfall mit Beteiligten und Strafpunkten festhalten.
            </p>
          </div>

          <Link
            href={sessionId ? `/sessions/${sessionId}` : "/"}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-neutral-700 px-4 py-3 font-medium text-center hover:border-neutral-500 hover:bg-neutral-900 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Zurück
          </Link>
        </div>

        {loading && (
          <div className="rounded-3xl border border-neutral-800 p-5 text-neutral-400">
            Lade Daten...
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-3xl border border-red-800/60 bg-red-950/40 p-4 text-red-300">
            {error}
          </div>
        )}

        {!loading && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <section className="rounded-3xl border border-neutral-800 bg-neutral-900/30 p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400/80" />
                <h2 className="text-xl font-semibold">Inzidenz</h2>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-300">Inzidenz-Typ</label>
                <select
                  value={incidentType}
                  onChange={(e) => setIncidentType(e.target.value)}
                  className={inputBase}
                >
                  <option value="wedding_penalty">Hochzeit-Störfall</option>
                  <option value="misdeal">Vergeben</option>
                  <option value="misplay">Falsch bedient</option>
                </select>
              </div>

              <p className="text-sm text-neutral-400">
                Gewählt: <span className="text-amber-300 font-medium">{labelForIncidentType(incidentType)}</span>
              </p>
            </section>

            <section className="rounded-3xl border border-neutral-800 bg-neutral-900/30 p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-400/80" />
                  <h2 className="text-xl font-semibold">Beteiligte Spieler</h2>
                </div>
                <span className="text-sm text-neutral-400 tabular-nums">
                  {selectedPlayerIds.length} ausgewählt
                </span>
              </div>

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
            </section>

            <section className="rounded-3xl border border-neutral-800 bg-neutral-900/30 p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-400/80" />
                <h2 className="text-xl font-semibold">Strafpunkte</h2>
              </div>

              {selectedPlayerIds.length === 0 ? (
                <p className="text-neutral-400">Bitte zuerst beteiligte Spieler auswählen.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedPlayerIds.map((playerId) => {
                    const player = players.find((p) => p.id === playerId);
                    if (!player) return null;

                    return (
                      <div key={playerId} className="space-y-2">
                        <label className="block text-sm font-medium text-neutral-300">
                          {player.display_name}
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={scores[playerId] || ""}
                          onChange={(e) => updateScore(playerId, e.target.value)}
                          className={`${inputBase} tabular-nums`}
                          placeholder="Leer = 0"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-neutral-800 bg-neutral-900/30 p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2">
                <StickyNote className="w-5 h-5 text-amber-400/80" />
                <h2 className="text-xl font-semibold">Notiz</h2>
              </div>

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className={`${inputBase} resize-none`}
                placeholder="Optional"
              />
            </section>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl bg-amber-400 text-neutral-950 px-5 py-3 font-semibold hover:bg-amber-300 transition shadow-lg shadow-amber-400/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? "Speichere..." : "Inzidenz speichern"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

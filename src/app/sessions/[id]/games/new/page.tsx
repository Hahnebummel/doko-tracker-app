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

type ExistingEvent = {
  sequence_number: number;
  game_number: number | null;
};

type ScoreMap = Record<string, string>;

export default function NewGamePage() {
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

  const [gameKind, setGameKind] = useState("normal");
  const [soloType, setSoloType] = useState("");
  const [soloPlayerId, setSoloPlayerId] = useState("");
  const [bockLevel, setBockLevel] = useState("none");
  const [specialRoundType, setSpecialRoundType] = useState("none");
  const [notes, setNotes] = useState("");

  const [nextSequenceNumber, setNextSequenceNumber] = useState<number | null>(null);
  const [nextGameNumber, setNextGameNumber] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSolo = gameKind === "solo";

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
        .select("sequence_number, game_number")
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

      const existingGameNumbers = existingEvents
        .map((event) => event.game_number)
        .filter((value): value is number => typeof value === "number");

      const maxGameNumber =
        existingGameNumbers.length > 0 ? Math.max(...existingGameNumbers) : 0;

      setPlayers(sortedPlayers);
      setNextSequenceNumber(maxSequence + 1);
      setNextGameNumber(maxGameNumber + 1);
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
        if (soloPlayerId === playerId) {
          setSoloPlayerId("");
        }
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

    if (!nextSequenceNumber || !nextGameNumber) {
      setError("Nächste Ereignisnummer konnte nicht ermittelt werden.");
      return;
    }

    if (selectedPlayerIds.length < 4) {
      setError("Bitte mindestens 4 beteiligte Spieler auswählen.");
      return;
    }

    if (gameKind === "solo") {
      if (!soloType) {
        setError("Bitte eine Solo-Art auswählen.");
        return;
      }

      if (!soloPlayerId) {
        setError("Bitte den Solo-Spieler auswählen.");
        return;
      }

      if (!selectedPlayerIds.includes(soloPlayerId)) {
        setError("Der Solo-Spieler muss unter den beteiligten Spielern sein.");
        return;
      }
    }

    setSaving(true);

    const { data: insertedEvent, error: eventError } = await supabase
      .from("session_events")
      .insert({
        session_id: sessionId,
        sequence_number: nextSequenceNumber,
        event_type: "game",
        game_number: nextGameNumber,
        game_kind: gameKind,
        solo_type: gameKind === "solo" ? soloType : null,
        solo_player_id: gameKind === "solo" ? soloPlayerId : null,
        bock_level: bockLevel,
        special_round_type: specialRoundType,
        incident_type: null,
        notes: notes.trim() || null,
      })
      .select("id")
      .single();

    if (eventError || !insertedEvent) {
      setSaving(false);
      setError(eventError?.message || "Spiel konnte nicht gespeichert werden.");
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
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold">Spiel erfassen</h1>
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

            <p className="text-sm opacity-80">
              Ausgewählt: {selectedPlayerIds.length}
            </p>
          </section>

          <section className="border rounded-2xl p-5 space-y-4">
            <h2 className="text-xl font-semibold">Spieldaten</h2>

            <div className="space-y-2">
              <label className="block font-medium">Spielart</label>
              <select
                value={gameKind}
                onChange={(e) => {
                  const value = e.target.value;
                  setGameKind(value);
                  if (value !== "solo") {
                    setSoloType("");
                    setSoloPlayerId("");
                  }
                }}
                className="w-full rounded-xl border bg-transparent p-3"
              >
                <option value="normal">Normalspiel</option>
                <option value="solo">Solo</option>
                <option value="wedding_game">Hochzeitsspiel</option>
              </select>
            </div>

            {isSolo && (
              <>
                <div className="space-y-2">
                  <label className="block font-medium">Solo-Art</label>
                  <select
                    value={soloType}
                    onChange={(e) => setSoloType(e.target.value)}
                    className="w-full rounded-xl border bg-transparent p-3"
                  >
                    <option value="">Bitte wählen</option>
                    <option value="bubensolo">Bubensolo</option>
                    <option value="damensolo">Damensolo</option>
                    <option value="silent_wedding">Stille Hochzeit</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block font-medium">Solo-Spieler</label>
                  <select
                    value={soloPlayerId}
                    onChange={(e) => setSoloPlayerId(e.target.value)}
                    className="w-full rounded-xl border bg-transparent p-3"
                  >
                    <option value="">Bitte wählen</option>
                    {selectedPlayerIds.map((playerId) => {
                      const player = players.find((p) => p.id === playerId);
                      if (!player) return null;
                      return (
                        <option key={player.id} value={player.id}>
                          {player.display_name}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="block font-medium">Bock-Stufe</label>
              <select
                value={bockLevel}
                onChange={(e) => setBockLevel(e.target.value)}
                className="w-full rounded-xl border bg-transparent p-3"
              >
                <option value="none">Keine</option>
                <option value="bock">Bock</option>
                <option value="double_bock">Doppelbock</option>
                <option value="triple_bock">Triplebock</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block font-medium">Special Round</label>
              <select
                value={specialRoundType}
                onChange={(e) => setSpecialRoundType(e.target.value)}
                className="w-full rounded-xl border bg-transparent p-3"
              >
                <option value="none">Keine</option>
                <option value="devils_round">Teufelsrunde</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block font-medium">Notiz</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full rounded-xl border bg-transparent p-3"
                placeholder="Optional"
              />
            </div>
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
                      <label className="block font-medium">
                        {player.display_name}
                      </label>
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

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl border px-5 py-3 font-medium hover:bg-white hover:text-black transition disabled:opacity-50"
          >
            {saving ? "Speichere..." : "Spiel speichern"}
          </button>
        </form>
      )}
    </main>
  );
}

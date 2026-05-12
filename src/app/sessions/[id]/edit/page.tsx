"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Lock,
  MapPin,
  Pencil,
  Save,
  StickyNote,
  Users,
} from "lucide-react";
import { supabase } from "@/utils/supabase/client";

type Player = {
  id: string;
  display_name: string;
};

type SessionRow = {
  id: string;
  session_date: string;
  location: string;
  notes: string | null;
};

type SessionParticipantRow = {
  player_id: string;
  players: { id: string; display_name: string } | null;
};

type SessionEventRow = {
  id: string;
};

type EventParticipantRow = {
  player_id: string;
};

const inputBase =
  "w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-neutral-50 placeholder:text-neutral-500 focus:border-amber-400/50 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition";

function toInputValue(dateString: string) {
  // Supabase liefert Datum als "YYYY-MM-DD" — das passt direkt.
  // Sicherheitshalber auf die ersten 10 Zeichen kürzen, falls ein Zeitstempel mitkommt.
  return dateString.slice(0, 10);
}

export default function EditSessionPage() {
  const params = useParams();
  const router = useRouter();

  const sessionId = useMemo(() => {
    const rawId = params?.id;
    if (typeof rawId === "string") return rawId;
    if (Array.isArray(rawId)) return rawId[0];
    return null;
  }, [params]);

  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [lockedPlayerIds, setLockedPlayerIds] = useState<string[]>([]);
  const [originalParticipantIds, setOriginalParticipantIds] = useState<string[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);

  const [sessionDate, setSessionDate] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

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

      // 1. Den Spielabend selbst laden
      const { data: sessionData, error: sessionError } = await supabase
        .from("sessions")
        .select("id, session_date, location, notes")
        .eq("id", sessionId)
        .single();

      if (sessionError || !sessionData) {
        setError(sessionError?.message || "Spielabend nicht gefunden.");
        setLoading(false);
        return;
      }

      const currentSession = sessionData as SessionRow;

      // 2. Aktuelle Teilnehmer laden
      const { data: participantData, error: participantError } = await supabase
        .from("session_participants")
        .select("player_id, players(id, display_name)")
        .eq("session_id", sessionId);

      if (participantError) {
        setError(participantError.message);
        setLoading(false);
        return;
      }

      const participants = (participantData || []) as unknown as SessionParticipantRow[];
      const currentParticipantIds = participants.map((row) => row.player_id);

      // 3. Aktive Spieler aus dem Pool laden
      const { data: activePlayersData, error: activePlayersError } = await supabase
        .from("players")
        .select("id, display_name")
        .eq("is_active", true)
        .order("display_name", { ascending: true });

      if (activePlayersError) {
        setError(activePlayersError.message);
        setLoading(false);
        return;
      }

      const activePlayers = (activePlayersData || []) as Player[];

      // Aktive Spieler PLUS aktuelle Teilnehmer (falls jemand inaktiv geschaltet wurde, soll er trotzdem in der Liste auftauchen)
      const playerMap = new Map<string, Player>();
      activePlayers.forEach((p) => playerMap.set(p.id, p));
      participants.forEach((row) => {
        const player = Array.isArray(row.players)
          ? row.players[0]
          : row.players;
        if (player && !playerMap.has(player.id)) {
          playerMap.set(player.id, player);
        }
      });

      const mergedPlayers = Array.from(playerMap.values()).sort((a, b) =>
        a.display_name.localeCompare(b.display_name)
      );

      // 4. Ereignisse dieses Abends laden, um zu sehen, wer "festgeschrieben" ist
      const { data: eventData, error: eventError } = await supabase
        .from("session_events")
        .select("id")
        .eq("session_id", sessionId);

      if (eventError) {
        setError(eventError.message);
        setLoading(false);
        return;
      }

      const eventIds = ((eventData || []) as SessionEventRow[]).map((row) => row.id);

      let lockedIds: string[] = [];

      if (eventIds.length > 0) {
        const { data: eventParticipantsData, error: eventParticipantsError } = await supabase
          .from("event_participants")
          .select("player_id")
          .in("event_id", eventIds);

        if (eventParticipantsError) {
          setError(eventParticipantsError.message);
          setLoading(false);
          return;
        }

        const eventParticipants = (eventParticipantsData || []) as EventParticipantRow[];
        lockedIds = Array.from(new Set(eventParticipants.map((row) => row.player_id)));
      }

      // State setzen
      setAllPlayers(mergedPlayers);
      setLockedPlayerIds(lockedIds);
      setOriginalParticipantIds(currentParticipantIds);
      setSelectedPlayerIds(currentParticipantIds);
      setSessionDate(toInputValue(currentSession.session_date));
      setLocation(currentSession.location || "");
      setNotes(currentSession.notes || "");
      setLoading(false);
    }

    loadData();
  }, [sessionId]);

  function togglePlayer(playerId: string) {
    // Gesperrte Spieler (mit Ereignissen) können nicht abgewählt werden
    if (lockedPlayerIds.includes(playerId) && selectedPlayerIds.includes(playerId)) {
      return;
    }

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

    if (!sessionId) {
      setError("Keine gültige Session-ID gefunden.");
      return;
    }

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

    // Sicherheitsnetz: keiner der gesperrten darf entfernt worden sein
    const lockedRemoved = lockedPlayerIds.filter(
      (id) => originalParticipantIds.includes(id) && !selectedPlayerIds.includes(id)
    );
    if (lockedRemoved.length > 0) {
      setError(
        "Mindestens ein Spieler mit bereits erfassten Ereignissen wurde entfernt. Bitte zuerst dessen Ereignisse löschen."
      );
      return;
    }

    setSaving(true);

    // 1. Stammdaten aktualisieren
    const { error: updateError } = await supabase
      .from("sessions")
      .update({
        session_date: sessionDate,
        location: location.trim(),
        notes: notes.trim() || null,
      })
      .eq("id", sessionId);

    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }

    // 2. Teilnehmer-Diff bilden
    const originalSet = new Set(originalParticipantIds);
    const selectedSet = new Set(selectedPlayerIds);

    const toAdd = selectedPlayerIds.filter((id) => !originalSet.has(id));
    const toRemove = originalParticipantIds.filter((id) => !selectedSet.has(id));

    // 3. Neue Teilnehmer einfügen
    if (toAdd.length > 0) {
      const rows = toAdd.map((playerId) => ({
        session_id: sessionId,
        player_id: playerId,
      }));

      const { error: addError } = await supabase
        .from("session_participants")
        .insert(rows);

      if (addError) {
        setSaving(false);
        setError(addError.message);
        return;
      }
    }

    // 4. Entfernte Teilnehmer löschen
    if (toRemove.length > 0) {
      const { error: removeError } = await supabase
        .from("session_participants")
        .delete()
        .eq("session_id", sessionId)
        .in("player_id", toRemove);

      if (removeError) {
        setSaving(false);
        setError(removeError.message);
        return;
      }
    }

    setSaving(false);
    router.push(`/sessions/${sessionId}`);
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Pencil className="w-4 h-4 text-amber-400" />
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-400/80">
                Spielabend bearbeiten
              </p>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Spielabend anpassen
            </h1>
            <p className="mt-2 text-neutral-400">
              Datum, Ort, Notiz und Teilnehmer ändern.
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
            Lade Spielabend...
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
                  className={inputBase}
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
                  className={inputBase}
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
                  className={`${inputBase} resize-none`}
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

              {lockedPlayerIds.length > 0 && (
                <p className="text-sm text-neutral-400">
                  Spieler mit bereits erfassten Ereignissen sind gesperrt. Um sie zu
                  entfernen, müssen zuerst deren Ereignisse gelöscht werden.
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {allPlayers.map((player) => {
                  const checked = selectedPlayerIds.includes(player.id);
                  const isLocked =
                    lockedPlayerIds.includes(player.id) &&
                    originalParticipantIds.includes(player.id);

                  return (
                    <label
                      key={player.id}
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                        isLocked
                          ? "cursor-not-allowed border-amber-400/30 bg-amber-400/[0.04]"
                          : "cursor-pointer"
                      } ${
                        !isLocked && checked
                          ? "border-amber-400/40 bg-amber-400/[0.06]"
                          : !isLocked
                          ? "border-neutral-800 bg-neutral-950/40 hover:border-neutral-700"
                          : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isLocked}
                        onChange={() => togglePlayer(player.id)}
                        className="h-4 w-4 accent-amber-400 disabled:opacity-50"
                      />
                      <span className={checked || isLocked ? "text-amber-100 font-medium" : ""}>
                        {player.display_name}
                      </span>
                      {isLocked && (
                        <span className="ml-auto inline-flex items-center gap-1 text-xs text-amber-400/70">
                          <Lock className="w-3 h-3" />
                          Hat Ereignisse
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </section>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl bg-amber-400 text-neutral-950 px-5 py-3 font-semibold hover:bg-amber-300 transition shadow-lg shadow-amber-400/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? "Speichere..." : "Änderungen speichern"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

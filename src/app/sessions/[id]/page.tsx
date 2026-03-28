"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

type Session = {
  id: string;
  session_date: string;
  location: string;
  notes: string | null;
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
  sequence_number: number;
  event_type: "game" | "incident";
  game_number: number | null;
  game_kind: string | null;
  solo_type: string | null;
  solo_player_id: string | null;
  bock_level: string;
  special_round_type: string;
  incident_type: string | null;
  notes: string | null;
};

type EventParticipantRow = {
  event_id: string;
  player_id: string;
  players: {
    id: string;
    display_name: string;
  } | null;
};

type EventResultRow = {
  event_id: string;
  player_id: string;
  penalty_points: number;
  players: {
    id: string;
    display_name: string;
  } | null;
};

type ScoreEntry = {
  player_id: string;
  display_name: string;
  total_penalty_points: number;
};

function labelForGameKind(value: string | null) {
  if (value === "normal") return "Normalspiel";
  if (value === "solo") return "Solo";
  if (value === "wedding_game") return "Hochzeitsspiel";
  return "—";
}

function labelForSoloType(value: string | null) {
  if (value === "bubensolo") return "Bubensolo";
  if (value === "damensolo") return "Damensolo";
  if (value === "silent_wedding") return "Stille Hochzeit";
  return "—";
}

function labelForBockLevel(value: string | null) {
  if (value === "none") return "Keine";
  if (value === "bock") return "Bock";
  if (value === "double_bock") return "Doppelbock";
  if (value === "triple_bock") return "Triplebock";
  return "—";
}

function labelForSpecialRound(value: string | null) {
  if (value === "none") return "Keine";
  if (value === "devils_round") return "Teufelsrunde";
  return "—";
}

function labelForIncidentType(value: string | null) {
  if (value === "wedding_penalty") return "Hochzeit-Störfall";
  if (value === "misdeal") return "Vergeben";
  if (value === "misplay") return "Falsch bedient";
  return "—";
}

export default function SessionDetailPage() {
  const params = useParams();

  const sessionId = useMemo(() => {
    const rawId = params?.id;
    if (typeof rawId === "string") return rawId;
    if (Array.isArray(rawId)) return rawId[0];
    return null;
  }, [params]);

  const [session, setSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<SessionParticipantRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventParticipants, setEventParticipants] = useState<EventParticipantRow[]>([]);
  const [eventResults, setEventResults] = useState<EventResultRow[]>([]);
  const [scoreboard, setScoreboard] = useState<ScoreEntry[]>([]);

  const [loading, setLoading] = useState(true);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadSessionData() {
    if (!sessionId) {
      setError("Keine gültige Session-ID gefunden.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data: sessionData, error: sessionError } = await supabase
      .from("sessions")
      .select("id, session_date, location, notes")
      .eq("id", sessionId)
      .single();

    if (sessionError) {
      setError(sessionError.message);
      setLoading(false);
      return;
    }

    const { data: participantData, error: participantError } = await supabase
      .from("session_participants")
      .select("player_id, players(id, display_name)")
      .eq("session_id", sessionId);

    if (participantError) {
      setError(participantError.message);
      setLoading(false);
      return;
    }

    const { data: eventData, error: eventError } = await supabase
      .from("session_events")
      .select(
        "id, sequence_number, event_type, game_number, game_kind, solo_type, solo_player_id, bock_level, special_round_type, incident_type, notes"
      )
      .eq("session_id", sessionId)
      .order("sequence_number", { ascending: true });

    if (eventError) {
      setError(eventError.message);
      setLoading(false);
      return;
    }

    const loadedEvents = (eventData || []) as EventRow[];
    const eventIds = loadedEvents.map((event) => event.id);

    let loadedEventParticipants: EventParticipantRow[] = [];
    let loadedEventResults: EventResultRow[] = [];

    if (eventIds.length > 0) {
      const { data: eventParticipantData, error: eventParticipantError } = await supabase
        .from("event_participants")
        .select("event_id, player_id, players(id, display_name)")
        .in("event_id", eventIds);

      if (eventParticipantError) {
        setError(eventParticipantError.message);
        setLoading(false);
        return;
      }

      const { data: eventResultData, error: eventResultError } = await supabase
        .from("event_results")
        .select("event_id, player_id, penalty_points, players(id, display_name)")
        .in("event_id", eventIds);

      if (eventResultError) {
        setError(eventResultError.message);
        setLoading(false);
        return;
      }

      loadedEventParticipants = (eventParticipantData || []) as EventParticipantRow[];
      loadedEventResults = (eventResultData || []) as EventResultRow[];
    }

    const sortedParticipants = ((participantData as unknown as SessionParticipantRow[]) || []).sort(
      (a, b) => {
        const nameA = a.players?.display_name || "";
        const nameB = b.players?.display_name || "";
        return nameA.localeCompare(nameB);
      }
    );

    const totalsMap = new Map<string, ScoreEntry>();

    sortedParticipants.forEach((participant) => {
      const displayName = participant.players?.display_name || "Unbekannter Spieler";
      totalsMap.set(participant.player_id, {
        player_id: participant.player_id,
        display_name: displayName,
        total_penalty_points: 0,
      });
    });

    loadedEventResults.forEach((result) => {
      const existing = totalsMap.get(result.player_id);
      const displayName =
        result.players?.display_name || existing?.display_name || "Unbekannter Spieler";

      if (existing) {
        existing.total_penalty_points += result.penalty_points || 0;
      } else {
        totalsMap.set(result.player_id, {
          player_id: result.player_id,
          display_name: displayName,
          total_penalty_points: result.penalty_points || 0,
        });
      }
    });

    const sortedScoreboard = Array.from(totalsMap.values()).sort((a, b) => {
      if (a.total_penalty_points !== b.total_penalty_points) {
        return a.total_penalty_points - b.total_penalty_points;
      }
      return a.display_name.localeCompare(b.display_name);
    });

    setSession(sessionData);
    setParticipants(sortedParticipants);
    setEvents(loadedEvents);
    setEventParticipants(loadedEventParticipants);
    setEventResults(loadedEventResults);
    setScoreboard(sortedScoreboard);
    setLoading(false);
  }

  useEffect(() => {
    loadSessionData();
  }, [sessionId]);

  async function handleDeleteEvent(eventId: string) {
    const confirmed = window.confirm(
      "Möchtest du dieses Ereignis wirklich löschen? Die Strafpunkte und Beteiligungen werden ebenfalls entfernt."
    );

    if (!confirmed) return;

    setDeletingEventId(eventId);
    setError(null);

    const { error: deleteError } = await supabase
      .from("session_events")
      .delete()
      .eq("id", eventId);

    setDeletingEventId(null);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    await loadSessionData();
  }

  return (
    <main className="min-h-screen p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold">Spielabend</h1>
        <Link
          href="/"
          className="rounded-xl border px-4 py-2 font-medium hover:bg-white hover:text-black transition"
        >
          Zurück
        </Link>
      </div>

      {loading && <p>Lade Spielabend...</p>}

      {error && <p className="text-red-600">Fehler: {error}</p>}

      {!loading && !error && session && sessionId && (
        <div className="space-y-8">
          <section className="border rounded-2xl p-5">
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <h2 className="text-xl font-semibold">Basisdaten</h2>

              <div className="flex gap-3 flex-wrap">
                <Link
                  href={`/sessions/${sessionId}/games/new`}
                  className="rounded-xl border px-4 py-2 font-medium hover:bg-white hover:text-black transition"
                >
                  Spiel erfassen
                </Link>
                <Link
                  href={`/sessions/${sessionId}/incidents/new`}
                  className="rounded-xl border px-4 py-2 font-medium hover:bg-white hover:text-black transition"
                >
                  Inzidenz erfassen
                </Link>
              </div>
            </div>

            <div className="space-y-2">
              <p>
                <span className="font-medium">Datum:</span> {session.session_date}
              </p>
              <p>
                <span className="font-medium">Ort:</span> {session.location}
              </p>
              <p>
                <span className="font-medium">Notiz:</span>{" "}
                {session.notes && session.notes.trim() ? session.notes : "—"}
              </p>
            </div>
          </section>

          <section className="border rounded-2xl p-5">
            <h2 className="text-xl font-semibold mb-4">Anwesende Spieler</h2>

            {participants.length === 0 ? (
              <p>Keine Teilnehmer gefunden.</p>
            ) : (
              <ul className="space-y-2">
                {participants.map((participant) => (
                  <li key={participant.player_id} className="border rounded-xl p-3">
                    {participant.players?.display_name || "Unbekannter Spieler"}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="border rounded-2xl p-5">
            <h2 className="text-xl font-semibold mb-4">Tagesstand</h2>

            {scoreboard.length === 0 ? (
              <p>Keine Spieler gefunden.</p>
            ) : (
              <ul className="space-y-2">
                {scoreboard.map((entry) => (
                  <li
                    key={entry.player_id}
                    className="border rounded-xl p-3 flex items-center justify-between gap-4"
                  >
                    <span>{entry.display_name}</span>
                    <span className="font-semibold">{entry.total_penalty_points}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="border rounded-2xl p-5">
            <h2 className="text-xl font-semibold mb-4">Ereignisse</h2>

            {events.length === 0 ? (
              <p>Noch keine Ereignisse erfasst.</p>
            ) : (
              <div className="space-y-4">
                {events.map((event) => {
                  const participantsForEvent = eventParticipants
                    .filter((row) => row.event_id === event.id)
                    .sort((a, b) => {
                      const nameA = a.players?.display_name || "";
                      const nameB = b.players?.display_name || "";
                      return nameA.localeCompare(nameB);
                    });

                  const resultsForEvent = eventResults
                    .filter((row) => row.event_id === event.id)
                    .sort((a, b) => {
                      const nameA = a.players?.display_name || "";
                      const nameB = b.players?.display_name || "";
                      return nameA.localeCompare(nameB);
                    });

                  const soloPlayerName =
                    participants.find((p) => p.player_id === event.solo_player_id)?.players
                      ?.display_name || "—";

                  const editHref =
                    event.event_type === "game"
                      ? `/sessions/${sessionId}/games/${event.id}/edit`
                      : `/sessions/${sessionId}/incidents/${event.id}/edit`;

                  return (
                    <div key={event.id} className="border rounded-2xl p-4 space-y-4">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <p className="font-semibold">
                            Ereignis {event.sequence_number}
                            {event.event_type === "game" && event.game_number
                              ? ` · Spiel ${event.game_number}`
                              : ""}
                          </p>
                          <p className="opacity-80">
                            {event.event_type === "game"
                              ? labelForGameKind(event.game_kind)
                              : labelForIncidentType(event.incident_type)}
                          </p>
                        </div>

                        <div className="flex gap-3 flex-wrap">
                          <Link
                            href={editHref}
                            className="rounded-xl border px-4 py-2 font-medium hover:bg-white hover:text-black transition"
                          >
                            Bearbeiten
                          </Link>

                          <button
                            type="button"
                            onClick={() => handleDeleteEvent(event.id)}
                            disabled={deletingEventId === event.id}
                            className="rounded-xl border px-4 py-2 font-medium hover:bg-white hover:text-black transition disabled:opacity-50"
                          >
                            {deletingEventId === event.id ? "Lösche..." : "Löschen"}
                          </button>
                        </div>
                      </div>

                      {event.event_type === "game" && (
                        <div className="space-y-1 text-sm opacity-90">
                          <p>
                            <span className="font-medium">Bock-Stufe:</span>{" "}
                            {labelForBockLevel(event.bock_level)}
                          </p>
                          <p>
                            <span className="font-medium">Special Round:</span>{" "}
                            {labelForSpecialRound(event.special_round_type)}
                          </p>

                          {event.game_kind === "solo" && (
                            <>
                              <p>
                                <span className="font-medium">Solo-Art:</span>{" "}
                                {labelForSoloType(event.solo_type)}
                              </p>
                              <p>
                                <span className="font-medium">Solo-Spieler:</span>{" "}
                                {soloPlayerName}
                              </p>
                            </>
                          )}
                        </div>
                      )}

                      <div>
                        <p className="font-medium mb-2">Beteiligte Spieler</p>
                        {participantsForEvent.length === 0 ? (
                          <p className="opacity-80">Keine Beteiligten gefunden.</p>
                        ) : (
                          <ul className="space-y-2">
                            {participantsForEvent.map((participant) => (
                              <li
                                key={`${event.id}-${participant.player_id}`}
                                className="border rounded-xl p-3"
                              >
                                {participant.players?.display_name || "Unbekannter Spieler"}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div>
                        <p className="font-medium mb-2">Strafpunkte</p>
                        {resultsForEvent.length === 0 ? (
                          <p className="opacity-80">Keine Strafpunkte gefunden.</p>
                        ) : (
                          <ul className="space-y-2">
                            {resultsForEvent.map((result) => (
                              <li
                                key={`${event.id}-${result.player_id}`}
                                className="border rounded-xl p-3 flex items-center justify-between gap-4"
                              >
                                <span>{result.players?.display_name || "Unbekannter Spieler"}</span>
                                <span className="font-semibold">{result.penalty_points}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="text-sm opacity-80">
                        <span className="font-medium">Notiz:</span>{" "}
                        {event.notes && event.notes.trim() ? event.notes : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

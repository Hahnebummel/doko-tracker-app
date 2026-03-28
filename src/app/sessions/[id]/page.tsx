"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

type PlayerRelation =
  | { id: string; display_name: string }
  | { id: string; display_name: string }[]
  | null;

type Session = {
  id: string;
  session_date: string;
  location: string;
  notes: string | null;
};

type SessionParticipantRow = {
  player_id: string;
  players: PlayerRelation;
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
  players: PlayerRelation;
};

type EventResultRow = {
  event_id: string;
  player_id: string;
  penalty_points: number;
  players: PlayerRelation;
};

type ScoreEntry = {
  player_id: string;
  display_name: string;
  total_penalty_points: number;
};

function getPlayerName(players: PlayerRelation) {
  if (!players) return "Unbekannter Spieler";
  if (Array.isArray(players)) return players[0]?.display_name || "Unbekannter Spieler";
  return players.display_name || "Unbekannter Spieler";
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

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
  const router = useRouter();

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
  const [deletingSession, setDeletingSession] = useState(false);
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

      loadedEventParticipants = (eventParticipantData || []) as unknown as EventParticipantRow[];
      loadedEventResults = (eventResultData || []) as unknown as EventResultRow[];
    }

    const sortedParticipants = ((participantData as unknown as SessionParticipantRow[]) || []).sort(
      (a, b) => getPlayerName(a.players).localeCompare(getPlayerName(b.players))
    );

    const totalsMap = new Map<string, ScoreEntry>();

    sortedParticipants.forEach((participant) => {
      totalsMap.set(participant.player_id, {
        player_id: participant.player_id,
        display_name: getPlayerName(participant.players),
        total_penalty_points: 0,
      });
    });

    loadedEventResults.forEach((result) => {
      const existing = totalsMap.get(result.player_id);
      const displayName =
        getPlayerName(result.players) || existing?.display_name || "Unbekannter Spieler";

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

  async function handleDeleteSession() {
    if (!sessionId) {
      setError("Keine gültige Session-ID gefunden.");
      return;
    }

    const confirmed = window.confirm(
      "Möchtest du diesen Spielabend wirklich löschen? Alle Ereignisse, Beteiligungen und Strafpunkte dieses Abends werden ebenfalls dauerhaft entfernt."
    );

    if (!confirmed) return;

    setDeletingSession(true);
    setError(null);

    const eventIds = events.map((event) => event.id);

    if (eventIds.length > 0) {
      const { error: deleteEventResultsError } = await supabase
        .from("event_results")
        .delete()
        .in("event_id", eventIds);

      if (deleteEventResultsError) {
        setDeletingSession(false);
        setError(deleteEventResultsError.message);
        return;
      }

      const { error: deleteEventParticipantsError } = await supabase
        .from("event_participants")
        .delete()
        .in("event_id", eventIds);

      if (deleteEventParticipantsError) {
        setDeletingSession(false);
        setError(deleteEventParticipantsError.message);
        return;
      }

      const { error: deleteEventsError } = await supabase
        .from("session_events")
        .delete()
        .eq("session_id", sessionId);

      if (deleteEventsError) {
        setDeletingSession(false);
        setError(deleteEventsError.message);
        return;
      }
    }

    const { error: deleteSessionParticipantsError } = await supabase
      .from("session_participants")
      .delete()
      .eq("session_id", sessionId);

    if (deleteSessionParticipantsError) {
      setDeletingSession(false);
      setError(deleteSessionParticipantsError.message);
      return;
    }

    const { error: deleteSessionError } = await supabase
      .from("sessions")
      .delete()
      .eq("id", sessionId);

    setDeletingSession(false);

    if (deleteSessionError) {
      setError(deleteSessionError.message);
      return;
    }

    router.push("/");
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-neutral-400 mb-2">
              Spielabend
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold">
              {session ? formatDate(session.session_date) : "Spielabend"}
            </h1>
          </div>

          <Link
            href="/"
            className="rounded-2xl border border-neutral-700 px-4 py-3 font-medium text-center hover:bg-neutral-100 hover:text-neutral-900 transition"
          >
            Zurück
          </Link>
        </div>

        {loading && (
          <div className="rounded-3xl border border-neutral-800 p-5 text-neutral-400">
            Lade Spielabend...
          </div>
        )}

        {error && (
          <div className="rounded-3xl border border-red-800/60 bg-red-950/40 p-5 text-red-300">
            Fehler: {error}
          </div>
        )}

        {!loading && !error && session && sessionId && (
          <div className="space-y-6">
            <section className="rounded-3xl border border-neutral-800 p-5 sm:p-6">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold mb-1">Basisdaten</h2>
                  <p className="text-neutral-400">Rahmendaten dieses Spielabends.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href={`/sessions/${sessionId}/games/new`}
                    className="rounded-2xl border border-neutral-700 px-4 py-3 font-medium text-center hover:bg-neutral-100 hover:text-neutral-900 transition"
                  >
                    Spiel erfassen
                  </Link>
                  <Link
                    href={`/sessions/${sessionId}/incidents/new`}
                    className="rounded-2xl border border-neutral-700 px-4 py-3 font-medium text-center hover:bg-neutral-100 hover:text-neutral-900 transition"
                  >
                    Inzidenz erfassen
                  </Link>
                  <button
                    type="button"
                    onClick={handleDeleteSession}
                    disabled={deletingSession}
                    className="rounded-2xl border border-red-700 px-4 py-3 font-medium text-red-300 transition hover:bg-red-100 hover:text-red-900 disabled:opacity-50"
                  >
                    {deletingSession ? "Lösche Spielabend..." : "Spielabend löschen"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-neutral-800 p-4">
                  <p className="text-sm text-neutral-400 mb-1">Datum</p>
                  <p className="font-medium">{formatDate(session.session_date)}</p>
                </div>
                <div className="rounded-2xl border border-neutral-800 p-4">
                  <p className="text-sm text-neutral-400 mb-1">Ort</p>
                  <p className="font-medium">{session.location}</p>
                </div>
                <div className="rounded-2xl border border-neutral-800 p-4">
                  <p className="text-sm text-neutral-400 mb-1">Notiz</p>
                  <p className="font-medium">
                    {session.notes && session.notes.trim() ? session.notes : "—"}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-neutral-800 p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl sm:text-2xl font-semibold">Anwesende Spieler</h2>
                <span className="text-sm text-neutral-400">{participants.length} Spieler</span>
              </div>

              {participants.length === 0 ? (
                <p className="text-neutral-400">Keine Teilnehmer gefunden.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {participants.map((participant) => (
                    <div
                      key={participant.player_id}
                      className="rounded-2xl border border-neutral-800 px-4 py-4"
                    >
                      {getPlayerName(participant.players)}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-neutral-800 p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl sm:text-2xl font-semibold">Tagesstand</h2>
                <span className="text-sm text-neutral-400">
                  sortiert nach wenigsten Strafpunkten
                </span>
              </div>

              {scoreboard.length === 0 ? (
                <p className="text-neutral-400">Keine Spieler gefunden.</p>
              ) : (
                <div className="space-y-3">
                  {scoreboard.map((entry, index) => (
                    <div
                      key={entry.player_id}
                      className="rounded-2xl border border-neutral-800 px-4 py-4 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-sm text-neutral-400 w-6">{index + 1}.</span>
                        <span className="truncate">{entry.display_name}</span>
                      </div>
                      <span className="font-semibold text-lg">{entry.total_penalty_points}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-neutral-800 p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl sm:text-2xl font-semibold">Ereignisse</h2>
                <span className="text-sm text-neutral-400">{events.length} Einträge</span>
              </div>

              {events.length === 0 ? (
                <p className="text-neutral-400">Noch keine Ereignisse erfasst.</p>
              ) : (
                <div className="space-y-4">
                  {events.map((event) => {
                    const participantsForEvent = eventParticipants
                      .filter((row) => row.event_id === event.id)
                      .sort((a, b) => getPlayerName(a.players).localeCompare(getPlayerName(b.players)));

                    const resultsForEvent = eventResults
                      .filter((row) => row.event_id === event.id)
                      .sort((a, b) => getPlayerName(a.players).localeCompare(getPlayerName(b.players)));

                    const soloPlayerName =
                      participants.find((p) => p.player_id === event.solo_player_id)
                        ? getPlayerName(
                            participants.find((p) => p.player_id === event.solo_player_id)?.players || null
                          )
                        : "—";

                    const editHref =
                      event.event_type === "game"
                        ? `/sessions/${sessionId}/games/${event.id}/edit`
                        : `/sessions/${sessionId}/incidents/${event.id}/edit`;

                    return (
                      <div key={event.id} className="rounded-3xl border border-neutral-800 p-5 space-y-5">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                          <div>
                            <p className="font-semibold text-lg">
                              Ereignis {event.sequence_number}
                              {event.event_type === "game" && event.game_number
                                ? ` · Spiel ${event.game_number}`
                                : ""}
                            </p>
                            <p className="text-neutral-400 mt-1">
                              {event.event_type === "game"
                                ? labelForGameKind(event.game_kind)
                                : labelForIncidentType(event.incident_type)}
                            </p>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-3">
                            <Link
                              href={editHref}
                              className="rounded-2xl border border-neutral-700 px-4 py-3 font-medium text-center hover:bg-neutral-100 hover:text-neutral-900 transition"
                            >
                              Bearbeiten
                            </Link>

                            <button
                              type="button"
                              onClick={() => handleDeleteEvent(event.id)}
                              disabled={deletingEventId === event.id || deletingSession}
                              className="rounded-2xl border border-neutral-700 px-4 py-3 font-medium hover:bg-neutral-100 hover:text-neutral-900 transition disabled:opacity-50"
                            >
                              {deletingEventId === event.id ? "Lösche..." : "Löschen"}
                            </button>
                          </div>
                        </div>

                        {event.event_type === "game" && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                            <div className="rounded-2xl border border-neutral-800 p-4">
                              <p className="text-neutral-400 mb-1">Bock-Stufe</p>
                              <p>{labelForBockLevel(event.bock_level)}</p>
                            </div>
                            <div className="rounded-2xl border border-neutral-800 p-4">
                              <p className="text-neutral-400 mb-1">Special Round</p>
                              <p>{labelForSpecialRound(event.special_round_type)}</p>
                            </div>

                            {event.game_kind === "solo" && (
                              <>
                                <div className="rounded-2xl border border-neutral-800 p-4">
                                  <p className="text-neutral-400 mb-1">Solo-Art</p>
                                  <p>{labelForSoloType(event.solo_type)}</p>
                                </div>
                                <div className="rounded-2xl border border-neutral-800 p-4">
                                  <p className="text-neutral-400 mb-1">Solo-Spieler</p>
                                  <p>{soloPlayerName}</p>
                                </div>
                              </>
                            )}
                          </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div>
                            <p className="font-medium mb-3">Beteiligte Spieler</p>
                            {participantsForEvent.length === 0 ? (
                              <p className="text-neutral-400">Keine Beteiligten gefunden.</p>
                            ) : (
                              <div className="space-y-2">
                                {participantsForEvent.map((participant) => (
                                  <div
                                    key={`${event.id}-${participant.player_id}`}
                                    className="rounded-2xl border border-neutral-800 px-4 py-3"
                                  >
                                    {getPlayerName(participant.players)}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div>
                            <p className="font-medium mb-3">Strafpunkte</p>
                            {resultsForEvent.length === 0 ? (
                              <p className="text-neutral-400">Keine Strafpunkte gefunden.</p>
                            ) : (
                              <div className="space-y-2">
                                {resultsForEvent.map((result) => (
                                  <div
                                    key={`${event.id}-${result.player_id}`}
                                    className="rounded-2xl border border-neutral-800 px-4 py-3 flex items-center justify-between gap-4"
                                  >
                                    <span>{getPlayerName(result.players)}</span>
                                    <span className="font-semibold">{result.penalty_points}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-neutral-800 p-4 text-sm">
                          <p className="text-neutral-400 mb-1">Notiz</p>
                          <p>{event.notes && event.notes.trim() ? event.notes : "—"}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
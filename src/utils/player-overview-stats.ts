export type PlayerRow = {
  id: string;
  display_name: string | null;
};

export type SessionEventRow = {
  id: string;
  event_type: "game" | "incident" | string;
  game_kind: "normal" | "solo" | "wedding_game" | string | null;
  solo_type: string | null;
  solo_player_id: string | null;
};

export type EventParticipantRow = {
  event_id: string;
  player_id: string;
  players?:
    | { id?: string; display_name?: string | null }
    | { id?: string; display_name?: string | null }[]
    | null;
};

export type EventResultRow = {
  event_id: string;
  player_id: string;
  penalty_points: number | null;
};

export type PlayerOverviewStatsRow = {
  playerId: string;
  playerName: string;
  totalPenaltyPoints: number;
  gamesPlayed: number;
  avgPenaltyPerGame: number | null;
  solosPlayed: number;
  soloWins: number;
  soloWinRate: number | null;
};

function getPenaltyPoints(value: number | null | undefined): number {
  return typeof value === "number" ? value : 0;
}

function getPlayerName(
  player: PlayerRow,
  eventParticipants: EventParticipantRow[]
): string {
  if (player.display_name) return player.display_name;

  const participantWithRelation = eventParticipants.find(
    (entry) => entry.player_id === player.id && entry.players
  );

  if (!participantWithRelation?.players) {
    return "Unbekannter Spieler";
  }

  const relation = participantWithRelation.players;

  if (Array.isArray(relation)) {
    return relation[0]?.display_name || "Unbekannter Spieler";
  }

  return relation.display_name || "Unbekannter Spieler";
}

export function buildPlayerOverviewStats(params: {
  players: PlayerRow[];
  sessionEvents: SessionEventRow[];
  eventParticipants: EventParticipantRow[];
  eventResults: EventResultRow[];
}): PlayerOverviewStatsRow[] {
  const { players, sessionEvents, eventParticipants, eventResults } = params;

  const eventsById = new Map(sessionEvents.map((event) => [event.id, event]));

  const resultsByPlayerId = new Map<string, EventResultRow[]>();
  const resultsByEventId = new Map<string, EventResultRow[]>();
  const participantsByPlayerId = new Map<string, EventParticipantRow[]>();

  for (const result of eventResults) {
    const existingForPlayer = resultsByPlayerId.get(result.player_id) || [];
    existingForPlayer.push(result);
    resultsByPlayerId.set(result.player_id, existingForPlayer);

    const existingForEvent = resultsByEventId.get(result.event_id) || [];
    existingForEvent.push(result);
    resultsByEventId.set(result.event_id, existingForEvent);
  }

  for (const participant of eventParticipants) {
    const existing = participantsByPlayerId.get(participant.player_id) || [];
    existing.push(participant);
    participantsByPlayerId.set(participant.player_id, existing);
  }

  const rows = players.map((player) => {
    const playerName = getPlayerName(player, eventParticipants);

    const playerResults = resultsByPlayerId.get(player.id) || [];
    const playerParticipations = participantsByPlayerId.get(player.id) || [];

    const totalPenaltyPoints = playerResults.reduce(
      (sum, result) => sum + getPenaltyPoints(result.penalty_points),
      0
    );

    const gameParticipations = playerParticipations.filter((participant) => {
      const event = eventsById.get(participant.event_id);
      return event?.event_type === "game";
    });

    const gamesPlayed = gameParticipations.length;

    const gameEventIds = new Set(gameParticipations.map((entry) => entry.event_id));

    const gamePenaltyPoints = playerResults
      .filter((result) => gameEventIds.has(result.event_id))
      .reduce((sum, result) => sum + getPenaltyPoints(result.penalty_points), 0);

    const avgPenaltyPerGame =
      gamesPlayed > 0 ? gamePenaltyPoints / gamesPlayed : null;

    const soloEventsAsSoloPlayer = sessionEvents.filter(
      (event) =>
        event.event_type === "game" &&
        event.game_kind === "solo" &&
        event.solo_player_id === player.id
    );

    const solosPlayed = soloEventsAsSoloPlayer.length;

    let soloWins = 0;

    for (const soloEvent of soloEventsAsSoloPlayer) {
      const results = resultsByEventId.get(soloEvent.id) || [];
      const soloPlayerResult = results.find((result) => result.player_id === player.id);
      const soloPlayerPenaltyPoints = getPenaltyPoints(
        soloPlayerResult?.penalty_points
      );

      if (soloPlayerPenaltyPoints === 0) {
        soloWins += 1;
      }
    }

    const soloWinRate =
      solosPlayed > 0 ? (soloWins / solosPlayed) * 100 : null;

    return {
      playerId: player.id,
      playerName,
      totalPenaltyPoints,
      gamesPlayed,
      avgPenaltyPerGame,
      solosPlayed,
      soloWins,
      soloWinRate,
    };
  });

  rows.sort((a, b) => {
    if (a.totalPenaltyPoints !== b.totalPenaltyPoints) {
      return a.totalPenaltyPoints - b.totalPenaltyPoints;
    }

    const aAvg = a.avgPenaltyPerGame ?? Number.POSITIVE_INFINITY;
    const bAvg = b.avgPenaltyPerGame ?? Number.POSITIVE_INFINITY;

    if (aAvg !== bAvg) {
      return aAvg - bAvg;
    }

    return a.playerName.localeCompare(b.playerName, "de");
  });

  return rows;
}
export const fixtureConnectionContext = {
  schema_version: 'player.connection_context.private.v1',
  player: {player_id: 'PLAYER-LIVE-001', display_name: 'Builder'},
  github: {user_id: '700001', login: 'CipherCuttle'},
  states: {
    signed_in: 'SIGNED_IN',
    app_access: 'GRANTED',
    repository_authorized: 'AUTHORIZED',
    project_linked: 'LINKED',
    observing: 'OBSERVING',
  },
  source: {
    repository_id: '123',
    repository_full_name: 'CipherCuttle/weird-little-thing',
    visibility: 'PRIVATE',
    availability: 'AVAILABLE',
    last_observed_at: '2026-09-10T08:00:00Z',
  },
};

export function fixturePendingAssists(projectId: string) {
  return {schema_version: 'project.pending_assists.private.v1', project_id: projectId, assists: []};
}

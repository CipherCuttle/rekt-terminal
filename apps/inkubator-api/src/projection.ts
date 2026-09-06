import type {PlayerRow} from './database.js';

function toIso(value: Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function toPublicPlayer(player: PlayerRow) {
  return {
    schema_version: 'player.public.v1' as const,
    player_id: player.player_id,
    display_name: player.display_name,
  };
}

export function toPrivatePlayer(player: PlayerRow) {
  return {
    schema_version: 'player.private.v1' as const,
    player_id: player.player_id,
    display_name: player.display_name,
    created_at: toIso(player.created_at),
    updated_at: toIso(player.updated_at),
  };
}

import type {PlayerProfileRow, PlayerRow} from './database.js';

function toIso(value: Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function publicLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string').slice(0, 8);
}

export function toPublicPlayer(player: PlayerRow, profile: PlayerProfileRow | null = null) {
  return {
    schema_version: 'player.public.v2' as const,
    player_id: player.player_id,
    display_name: player.display_name,
    skills_needed: publicLabels(profile?.skills_needed),
    can_help_with: publicLabels(profile?.can_help_with),
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

export interface Actor {
  playerId: string;
}

export interface PlayerResource {
  kind: 'player';
  playerId: string;
}

export type Resource = PlayerResource;
export type KnownAction = 'player.read_private' | 'player.update';

export function authorize(actor: Actor | null, action: string, resource: Resource): boolean {
  if (!actor) return false;

  switch (action as KnownAction) {
    case 'player.read_private':
    case 'player.update':
      return resource.kind === 'player' && actor.playerId === resource.playerId;
    default:
      return false;
  }
}

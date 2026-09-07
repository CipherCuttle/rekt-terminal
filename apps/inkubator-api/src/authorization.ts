export interface Actor {
  playerId: string;
}

export interface PlayerResource {
  kind: 'player';
  playerId: string;
}

export interface ProjectResource {
  kind: 'project';
  ownerPlayerId: string;
}

export type Resource = PlayerResource | ProjectResource;
export type KnownAction =
  | 'player.read_private'
  | 'player.update'
  | 'project.read_private'
  | 'project.link_repository';

export function authorize(actor: Actor | null, action: string, resource: Resource): boolean {
  if (!actor) return false;

  switch (action as KnownAction) {
    case 'player.read_private':
    case 'player.update':
      return resource.kind === 'player' && actor.playerId === resource.playerId;
    case 'project.read_private':
    case 'project.link_repository':
      return resource.kind === 'project' && actor.playerId === resource.ownerPlayerId;
    default:
      return false;
  }
}

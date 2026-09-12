import type {Kysely} from 'kysely';
import type {DatabaseSchema, GitHubInstallationTable, GitHubRepositoryRow, PlayerRow} from './database.js';

type InstallationWithState = Pick<GitHubInstallationTable, 'revoked_at'>;
type RepositoryWithState = Pick<GitHubRepositoryRow, 'repository_id' | 'installation_id' | 'full_name' | 'private' | 'active'> & {installation_revoked_at: Date | null};

export type PrivateConnectionContext = {
  schema_version: 'player.connection_context.private.v1';
  player: {player_id: string; display_name: string};
  github: {user_id: string | null; login: string | null};
  states: {
    signed_in: 'SIGNED_IN';
    app_access: 'GRANTED' | 'NOT_GRANTED' | 'REVOKED';
    repository_authorized: 'AUTHORIZED' | 'NOT_AUTHORIZED' | 'REVOKED';
    project_linked: 'LINKED' | 'NOT_LINKED' | 'ACCESS_REVOKED';
    observing: 'OBSERVING' | 'NOT_OBSERVING' | 'UNAVAILABLE';
  };
  source: {
    repository_id: string | null;
    repository_full_name: string | null;
    visibility: 'NONE' | 'PUBLIC' | 'PRIVATE';
    availability: 'NONE' | 'AVAILABLE' | 'REVOKED';
    last_observed_at: string | null;
  };
};

function iso(value: Date | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

/**
 * Private, read-only context for the shared shell. Numeric provider IDs are
 * authority; login/full-name fields are verified display metadata only.
 */
export async function getPrivateConnectionContext(
  db: Kysely<DatabaseSchema>,
  player: PlayerRow,
): Promise<PrivateConnectionContext> {
  const installations = await db
    .selectFrom('github_installations')
    .select(['revoked_at'])
    .where('player_id', '=', player.player_id)
    .execute() as InstallationWithState[];

  const repositories = await db
    .selectFrom('github_repositories as repository')
    .innerJoin('github_installations as installation', 'installation.installation_id', 'repository.installation_id')
    .select([
      'repository.repository_id',
      'repository.installation_id',
      'repository.full_name',
      'repository.private',
      'repository.active',
      'installation.revoked_at as installation_revoked_at',
    ])
    .where('installation.player_id', '=', player.player_id)
    .execute() as RepositoryWithState[];

  const linkedProject = await db
    .selectFrom('projects')
    .leftJoin('github_repositories as repository', 'repository.repository_id', 'projects.repository_id')
    .leftJoin('github_installations as installation', 'installation.installation_id', 'repository.installation_id')
    .select([
      'projects.project_id',
      'projects.name',
      'projects.repository_id',
      'repository.full_name as repository_full_name',
      'repository.private as repository_private',
      'repository.active as repository_active',
      'installation.revoked_at as installation_revoked_at',
    ])
    .where('projects.owner_player_id', '=', player.player_id)
    .where('projects.repository_id', 'is not', null)
    .orderBy('projects.updated_at', 'desc')
    .executeTakeFirst();

  const latestObservation = linkedProject?.project_id
    ? await db
      .selectFrom('history_events')
      .select('occurred_at')
      .where('event_family', '=', 'evidence')
      .where('event_type', '=', 'project.github_repository_push.observed')
      .where('subject_type', '=', 'project')
      .where('subject_id', '=', linkedProject.project_id)
      .orderBy('occurred_at', 'desc')
      .executeTakeFirst()
    : undefined;

  const activeInstallations = installations.filter((installation) => !installation.revoked_at);
  const activeRepositories = repositories.filter((repository) => repository.active && !repository.installation_revoked_at);
  const hasRevokedSource = installations.some((installation) => Boolean(installation.revoked_at)) || repositories.some((repository) => !repository.active || Boolean(repository.installation_revoked_at));
  const linkedIsAvailable = Boolean(linkedProject?.repository_active && !linkedProject.installation_revoked_at);
  const appAccess = activeInstallations.length > 0
      ? 'GRANTED'
      : installations.length > 0
        ? 'REVOKED'
        : 'NOT_GRANTED';
  const repositoryAuthorized = activeRepositories.length > 0
      ? 'AUTHORIZED'
      : hasRevokedSource
        ? 'REVOKED'
        : 'NOT_AUTHORIZED';
  const projectLinked = !linkedProject
    ? 'NOT_LINKED'
    : linkedIsAvailable
      ? 'LINKED'
      : 'ACCESS_REVOKED';
  const observing = !linkedProject
    ? 'NOT_OBSERVING'
    : linkedIsAvailable
      ? 'OBSERVING'
      : 'UNAVAILABLE';

  return {
    schema_version: 'player.connection_context.private.v1',
    player: {player_id: player.player_id, display_name: player.display_name},
    github: {user_id: player.github_user_id ?? null, login: player.github_login ?? null},
    states: {
      signed_in: 'SIGNED_IN',
      app_access: appAccess,
      repository_authorized: repositoryAuthorized,
      project_linked: projectLinked,
      observing,
    },
    source: {
      repository_id: linkedProject?.repository_id ?? null,
      repository_full_name: linkedProject?.repository_full_name ?? null,
      visibility: linkedProject?.repository_id ? (linkedProject.repository_private ? 'PRIVATE' : 'PUBLIC') : 'NONE',
      availability: linkedProject?.repository_id ? (linkedIsAvailable ? 'AVAILABLE' : 'REVOKED') : 'NONE',
      last_observed_at: iso(latestObservation?.occurred_at),
    },
  };
}

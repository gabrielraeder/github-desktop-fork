import {
  Repository,
  ILocalRepositoryState,
  nameOf,
  isRepositoryWithGitHubRepository,
  RepositoryWithGitHubRepository,
  getRepositoryKey,
} from '../../models/repository'
import { CloningRepository } from '../../models/cloning-repository'
import { getHTMLURL } from '../../lib/api'
import { caseInsensitiveCompare, compare } from '../../lib/compare'
import { IFilterListGroup, IFilterListItem } from '../lib/filter-list'
import { IAheadBehind } from '../../models/branch'
import { assertNever } from '../../lib/fatal-error'
import { isDotCom } from '../../lib/endpoint-capabilities'
import { Owner } from '../../models/owner'
import {
  getCustomGroupFor,
  ICustomRepositoryGroups,
  NoCustomRepositoryGroups,
} from '../../models/custom-repository-group'

export type RepositoryListGroup =
  | {
      kind: 'favorite' | 'recent' | 'other'
    }
  | {
      kind: 'dotcom'
      owner: Owner
    }
  | {
      kind: 'enterprise'
      host: string
    }
  | {
      kind: 'custom'
      id: string
      name: string
    }

/**
 * Returns a unique grouping key (string) for a repository group. Except for
 * custom groups, it doubles as a case sensitive sorting key (see
 * `getGroupSortKey`).
 */
export const getGroupKey = (group: RepositoryListGroup) => {
  const { kind } = group
  switch (kind) {
    case 'favorite':
      return `0:favorite`
    case 'recent':
      return `0:recent`
    case 'custom':
      return `0:x-custom:${group.id}`
    case 'dotcom':
      return `1:dotcom:${group.owner.login}`
    case 'enterprise':
      return `2:enterprise:${group.host}`
    case 'other':
      return `3:other`
    default:
      assertNever(group, `Unknown repository group kind ${kind}`)
  }
}

/**
 * Returns a key whose case sensitive sort order is the order in which the
 * groups are displayed: favorites, recent, custom groups by name, GitHub.com
 * owners, Enterprise hosts and finally everything else.
 */
const getGroupSortKey = (group: RepositoryListGroup) =>
  group.kind === 'custom'
    ? `0:x-custom:${group.name.toLowerCase()}:${group.id}`
    : getGroupKey(group)

export type Repositoryish = Repository | CloningRepository

export interface IRepositoryListItem extends IFilterListItem {
  readonly text: ReadonlyArray<string>
  readonly id: string
  readonly repository: Repositoryish
  readonly needsDisambiguation: boolean
  readonly aheadBehind: IAheadBehind | null
  readonly changedFilesCount: number
}

const recentRepositoriesThreshold = 7

const getHostForRepository = (repo: RepositoryWithGitHubRepository) =>
  new URL(getHTMLURL(repo.gitHubRepository.endpoint)).host

const getGroupForRepository = (
  repo: Repositoryish,
  customGroups: ICustomRepositoryGroups
): RepositoryListGroup => {
  if (repo instanceof Repository) {
    const custom = getCustomGroupFor(customGroups, getRepositoryKey(repo))
    if (custom !== undefined) {
      return { kind: 'custom', id: custom.id, name: custom.name }
    }
  }

  if (repo instanceof Repository && isRepositoryWithGitHubRepository(repo)) {
    return isDotCom(repo.gitHubRepository.endpoint)
      ? { kind: 'dotcom', owner: repo.gitHubRepository.owner }
      : { kind: 'enterprise', host: getHostForRepository(repo) }
  }
  return { kind: 'other' }
}

type RepoGroupItem = { group: RepositoryListGroup; repos: Repositoryish[] }

export function groupRepositories(
  repositories: ReadonlyArray<Repositoryish>,
  localRepositoryStateLookup: ReadonlyMap<number, ILocalRepositoryState>,
  recentRepositories: ReadonlyArray<number>,
  favoriteRepositories: ReadonlyArray<string> = [],
  customGroups: ICustomRepositoryGroups = NoCustomRepositoryGroups
): ReadonlyArray<IFilterListGroup<IRepositoryListItem, RepositoryListGroup>> {
  const includeRecentGroup = repositories.length > recentRepositoriesThreshold
  const recentSet = includeRecentGroup ? new Set(recentRepositories) : undefined
  const favoriteSet = new Set(favoriteRepositories)
  const groups = new Map<string, RepoGroupItem>()

  const addToGroup = (group: RepositoryListGroup, repo: Repositoryish) => {
    const key = getGroupKey(group)
    let rg = groups.get(key)
    if (!rg) {
      rg = { group, repos: [] }
      groups.set(key, rg)
    }

    rg.repos.push(repo)
  }

  for (const repo of repositories) {
    if (repo instanceof Repository && favoriteSet.has(getRepositoryKey(repo))) {
      addToGroup({ kind: 'favorite' }, repo)
    }

    if (recentSet?.has(repo.id) && repo instanceof Repository) {
      addToGroup({ kind: 'recent' }, repo)
    }

    addToGroup(getGroupForRepository(repo, customGroups), repo)
  }

  return Array.from(groups.values())
    .sort((x, y) => compare(getGroupSortKey(x.group), getGroupSortKey(y.group)))
    .map(({ group, repos }) => ({
      identifier: group,
      items: toSortedListItems(
        group,
        repos,
        localRepositoryStateLookup,
        groups
      ),
    }))
}

// Returns the display title for a repository, which is either the alias
// (if available) or the name.
const getDisplayTitle = (r: Repositoryish) =>
  r instanceof Repository && r.alias != null ? r.alias : r.name

const toSortedListItems = (
  group: RepositoryListGroup,
  repositories: ReadonlyArray<Repositoryish>,
  localRepositoryStateLookup: ReadonlyMap<number, ILocalRepositoryState>,
  groups: Map<string, RepoGroupItem>
): IRepositoryListItem[] => {
  const groupNames = new Map<string, number>()
  const allNames = new Map<string, number>()

  for (const groupItem of groups.values()) {
    // All items in the recent and favorite groups are by definition present
    // in another group and therefore we don't want to count them.
    if (
      groupItem.group.kind === 'recent' ||
      groupItem.group.kind === 'favorite'
    ) {
      continue
    }

    for (const title of groupItem.repos.map(getDisplayTitle)) {
      allNames.set(title, (allNames.get(title) ?? 0) + 1)
      if (groupItem.group === group) {
        groupNames.set(title, (groupNames.get(title) ?? 0) + 1)
      }
    }
  }

  return repositories
    .map(r => {
      const repoState = localRepositoryStateLookup.get(r.id)
      const title = getDisplayTitle(r)

      return {
        text: r instanceof Repository ? [title, nameOf(r)] : [title],
        id: r.id.toString(),
        repository: r,
        needsDisambiguation:
          // If the repository is in the enterprise or a custom group and has a
          // duplicate name in the group, we need to disambiguate it. We don't
          // have to
          // disambiguate repositories in the 'dotcom' group because they are
          // already grouped by owner. If the repository is in the 'recent'
          // or 'favorite' group and has a duplicate name in any group, we need
          // to disambiguate it.
          ((groupNames.get(title) ?? 0) > 1 &&
            (group.kind === 'enterprise' || group.kind === 'custom')) ||
          ((allNames.get(title) ?? 0) > 1 &&
            (group.kind === 'recent' || group.kind === 'favorite')),
        aheadBehind: repoState?.aheadBehind ?? null,
        changedFilesCount: repoState?.changedFilesCount ?? 0,
      }
    })
    .sort(({ repository: x }, { repository: y }) =>
      caseInsensitiveCompare(getDisplayTitle(x), getDisplayTitle(y))
    )
}

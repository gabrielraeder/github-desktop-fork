/** A group the user created to organize their repositories. */
export interface ICustomRepositoryGroup {
  readonly id: string
  readonly name: string
}

/** The user's custom repository groups and which repositories are in them. */
export interface ICustomRepositoryGroups {
  readonly groups: ReadonlyArray<ICustomRepositoryGroup>

  /** Group id by repository, keyed by `getRepositoryKey` */
  readonly assignments: Readonly<Record<string, string>>
}

export const NoCustomRepositoryGroups: ICustomRepositoryGroups = {
  groups: [],
  assignments: {},
}

/**
 * Returns the custom group a repository has been assigned to, if the group
 * still exists.
 */
export function getCustomGroupFor(
  customGroups: ICustomRepositoryGroups,
  repositoryKey: string
): ICustomRepositoryGroup | undefined {
  const id = customGroups.assignments[repositoryKey]
  return id === undefined
    ? undefined
    : customGroups.groups.find(g => g.id === id)
}

/**
 * Parse custom groups from storage, dropping anything malformed rather than
 * failing.
 */
export function parseCustomRepositoryGroups(
  value: unknown
): ICustomRepositoryGroups {
  if (typeof value !== 'object' || value === null) {
    return NoCustomRepositoryGroups
  }

  const { groups, assignments } = value as Record<string, unknown>

  const validGroups = Array.isArray(groups)
    ? groups.filter(
        (g): g is ICustomRepositoryGroup =>
          typeof g === 'object' &&
          g !== null &&
          typeof g.id === 'string' &&
          typeof g.name === 'string'
      )
    : []

  const ids = new Set(validGroups.map(g => g.id))
  const validAssignments: Record<string, string> = {}

  if (typeof assignments === 'object' && assignments !== null) {
    for (const [key, id] of Object.entries(assignments)) {
      if (typeof id === 'string' && ids.has(id)) {
        validAssignments[key] = id
      }
    }
  }

  return { groups: validGroups, assignments: validAssignments }
}

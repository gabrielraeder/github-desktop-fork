import * as Path from 'path'

/**
 * Normalize a path for comparing it with another one. Windows paths are case
 * insensitive.
 */
export function normalizePathForComparison(
  path: string,
  platform: NodeJS.Platform = process.platform
): string {
  return platform === 'win32'
    ? Path.win32.normalize(path).toLowerCase()
    : Path.posix.normalize(path)
}

/** Whether the list contains the given path, see `normalizePathForComparison` */
export function containsPath(
  paths: ReadonlyArray<string>,
  path: string,
  platform: NodeJS.Platform = process.platform
): boolean {
  const needle = normalizePathForComparison(path, platform)
  return paths.some(p => normalizePathForComparison(p, platform) === needle)
}

/** Whether `child` is inside (but not equal to) the `parent` folder */
export function isPathInside(
  child: string,
  parent: string,
  platform: NodeJS.Platform = process.platform
): boolean {
  const path = platform === 'win32' ? Path.win32 : Path.posix
  const relative = path.relative(
    normalizePathForComparison(parent, platform),
    normalizePathForComparison(child, platform)
  )

  return (
    relative.length > 0 &&
    !relative.startsWith('..') &&
    !path.isAbsolute(relative)
  )
}

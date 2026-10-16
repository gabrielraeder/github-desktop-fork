import { readdir } from 'fs/promises'
import * as Path from 'path'

/** How many levels of subfolders to search below the chosen folder */
const DefaultMaxDepth = 4

/**
 * Folders that are very unlikely to contain repositories the user wants to
 * add, and which can be expensive to walk.
 */
const IgnoredDirectories = new Set([
  'node_modules',
  'bower_components',
  'vendor',
  '__pycache__',
  'venv',
])

/**
 * Find the Git repositories in a folder and its subfolders.
 *
 * A folder containing a `.git` entry (a directory, or a file for worktrees) is
 * considered a repository and isn't searched any further, so submodules and
 * other nested repositories aren't returned separately. Hidden folders,
 * symbolic links and well known dependency folders are skipped. Folders that
 * can't be read are ignored.
 *
 * @returns the paths of the repositories found, sorted
 */
export async function findRepositories(
  root: string,
  maxDepth: number = DefaultMaxDepth
): Promise<ReadonlyArray<string>> {
  const found = new Array<string>()

  const visit = async (dir: string, depth: number): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])

    if (entries.some(e => e.name === '.git')) {
      found.push(dir)
      return
    }

    if (depth >= maxDepth) {
      return
    }

    await Promise.all(
      entries
        .filter(
          e =>
            e.isDirectory() &&
            !e.name.startsWith('.') &&
            !IgnoredDirectories.has(e.name)
        )
        .map(e => visit(Path.join(dir, e.name), depth + 1))
    )
  }

  await visit(root, 0)

  return found.sort()
}

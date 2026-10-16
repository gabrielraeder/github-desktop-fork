import { stat } from 'fs/promises'
import * as Path from 'path'

/**
 * Whether a repository's folder is on disk.
 *
 *  - 'present' - the path exists
 *  - 'missing' - the path definitively doesn't exist, even though the volume
 *                it lives on (drive, network share, mounted disk) is reachable
 *  - 'unknown' - we couldn't tell, e.g. because of a permission error or
 *                because the volume itself is unavailable (an unplugged drive
 *                or a disconnected network share)
 */
export type RepositoryPathPresence = 'present' | 'missing' | 'unknown'

const isNotFoundError = (e: unknown) => {
  const code = (e as NodeJS.ErrnoException | undefined)?.code
  return code === 'ENOENT' || code === 'ENOTDIR'
}

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false
  )

/**
 * Returns the root of the volume the given path lives on. On Windows this is
 * the drive (`C:\`) or network share (`\\server\share\`). On macOS and Linux
 * this is the mount point for paths on removable or mounted volumes, and the
 * file system root otherwise.
 */
export function getVolumeRoot(
  path: string,
  platform: NodeJS.Platform = process.platform
): string {
  if (platform === 'win32') {
    return Path.win32.parse(path).root
  }

  const parts = Path.posix.normalize(path).split('/')

  if (platform === 'darwin' && parts[1] === 'Volumes' && parts.length > 2) {
    return parts.slice(0, 3).join('/')
  }

  if (platform === 'linux') {
    if (parts[1] === 'mnt' && parts.length > 2) {
      return parts.slice(0, 3).join('/')
    }

    if (parts[1] === 'media' && parts.length > 3) {
      return parts.slice(0, 4).join('/')
    }

    if (parts[1] === 'run' && parts[2] === 'media' && parts.length > 4) {
      return parts.slice(0, 5).join('/')
    }
  }

  return '/'
}

/** Determine whether a repository's folder still exists on disk. */
export async function getRepositoryPathPresence(
  path: string
): Promise<RepositoryPathPresence> {
  try {
    await stat(path)
    return 'present'
  } catch (e) {
    if (!isNotFoundError(e)) {
      return 'unknown'
    }
  }

  const root = getVolumeRoot(path)
  return root.length > 0 && (await exists(root)) ? 'missing' : 'unknown'
}

import { describe, it } from 'node:test'
import assert from 'node:assert'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import * as Path from 'path'
import {
  getRepositoryPathPresence,
  getVolumeRoot,
} from '../../src/lib/repository-path-presence'

describe('getRepositoryPathPresence', () => {
  it('reports an existing folder as present', async () => {
    const dir = await mkdtemp(Path.join(tmpdir(), 'repo-presence-'))
    try {
      assert.equal(await getRepositoryPathPresence(dir), 'present')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('reports a deleted folder as missing', async () => {
    const dir = await mkdtemp(Path.join(tmpdir(), 'repo-presence-'))
    await rm(dir, { recursive: true, force: true })
    assert.equal(await getRepositoryPathPresence(dir), 'missing')
  })

  it('reports a folder on an unavailable volume as unknown', async t => {
    if (process.platform !== 'win32') {
      t.skip('Windows only')
      return
    }

    const path = '\\\\desktop-nonexistent-server\\share\\repo'
    assert.equal(await getRepositoryPathPresence(path), 'unknown')
  })
})

describe('getVolumeRoot', () => {
  it('returns the drive or share on Windows', () => {
    assert.equal(getVolumeRoot('D:\\code\\repo', 'win32'), 'D:\\')
    assert.equal(
      getVolumeRoot('\\\\server\\share\\code\\repo', 'win32'),
      '\\\\server\\share\\'
    )
  })

  it('returns the mount point for mounted volumes on macOS', () => {
    assert.equal(
      getVolumeRoot('/Volumes/Ext/code/repo', 'darwin'),
      '/Volumes/Ext'
    )
    assert.equal(getVolumeRoot('/Users/me/code/repo', 'darwin'), '/')
  })

  it('returns the mount point for mounted volumes on Linux', () => {
    assert.equal(getVolumeRoot('/mnt/data/repo', 'linux'), '/mnt/data')
    assert.equal(getVolumeRoot('/media/me/usb/repo', 'linux'), '/media/me/usb')
    assert.equal(
      getVolumeRoot('/run/media/me/usb/repo', 'linux'),
      '/run/media/me/usb'
    )
    assert.equal(getVolumeRoot('/home/me/repo', 'linux'), '/')
  })
})

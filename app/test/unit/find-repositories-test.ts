import { describe, it } from 'node:test'
import assert from 'node:assert'
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import * as Path from 'path'
import { findRepositories } from '../../src/lib/find-repositories'

const makeDirs = async (root: string, ...dirs: string[]) => {
  for (const dir of dirs) {
    await mkdir(Path.join(root, dir), { recursive: true })
  }
}

describe('findRepositories', () => {
  it('finds repositories in nested folders', async () => {
    const root = await mkdtemp(Path.join(tmpdir(), 'find-repos-'))
    try {
      await makeDirs(
        root,
        'a/.git',
        'clients/b/.git',
        'clients/c/.git',
        'not-a-repo/src'
      )
      // Worktrees and submodules use a `.git` file rather than a folder
      await makeDirs(root, 'worktree')
      await writeFile(Path.join(root, 'worktree', '.git'), 'gitdir: x')

      assert.deepEqual(await findRepositories(root), [
        Path.join(root, 'a'),
        Path.join(root, 'clients', 'b'),
        Path.join(root, 'clients', 'c'),
        Path.join(root, 'worktree'),
      ])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('returns the folder itself when it is a repository', async () => {
    const root = await mkdtemp(Path.join(tmpdir(), 'find-repos-'))
    try {
      await makeDirs(root, '.git', 'nested/.git')
      assert.deepEqual(await findRepositories(root), [root])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('skips hidden and dependency folders and respects max depth', async () => {
    const root = await mkdtemp(Path.join(tmpdir(), 'find-repos-'))
    try {
      await makeDirs(
        root,
        '.cache/repo/.git',
        'node_modules/pkg/.git',
        'one/two/.git',
        'one/two-and/three/.git'
      )
      assert.deepEqual(await findRepositories(root, 2), [
        Path.join(root, 'one', 'two'),
      ])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('returns nothing for a folder that does not exist', async () => {
    const root = Path.join(tmpdir(), 'find-repos-does-not-exist')
    assert.deepEqual(await findRepositories(root), [])
  })
})

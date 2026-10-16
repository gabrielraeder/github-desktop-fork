import assert from 'node:assert'
import { after, before, describe, it, mock } from 'node:test'
import { mkdir, mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import * as Path from 'path'
import * as React from 'react'

import type { Dispatcher } from '../../../src/ui/dispatcher'
import { fireEvent, render, screen, waitFor } from '../../helpers/ui/render'

let root: string

before(async () => {
  mock.module('../../../src/lib/git/index.ts', {
    namedExports: {
      getRepositoryType: async () => ({ kind: 'missing' }),
      addSafeDirectory: async () => {},
    },
  })
  mock.module('../../../src/ui/main-process-proxy.ts', {
    namedExports: {
      sendDialogDidOpen: () => {},
      showOpenDialog: async () => null,
    },
  })

  root = await mkdtemp(Path.join(tmpdir(), 'add-repos-in-folder-'))
  for (const dir of ['alpha/.git', 'beta/.git', 'clients/gamma/.git']) {
    await mkdir(Path.join(root, dir), { recursive: true })
  }
})

after(async () => {
  await rm(root, { recursive: true, force: true })
})

function createDispatcher() {
  const addRepositories = mock.fn(async (_paths: ReadonlyArray<string>) => [])
  const addWatchedRepositoryFolder = mock.fn((_path: string) => {})

  return {
    addRepositories,
    addWatchedRepositoryFolder,
    dispatcher: {
      addRepositories,
      addWatchedRepositoryFolder,
    } as unknown as Dispatcher,
  }
}

describe('AddExistingRepository adding the repositories in a folder', () => {
  it('lets the user pick which of the repositories found to add', async () => {
    localStorage.clear()
    const { AddExistingRepository } = await import(
      '../../../src/ui/add-repository/add-existing-repository'
    )
    const { dispatcher, addRepositories, addWatchedRepositoryFolder } =
      createDispatcher()
    const onDismissed = mock.fn()

    render(
      <AddExistingRepository
        dispatcher={dispatcher}
        path={root}
        onDismissed={onDismissed}
        existingRepositoryPaths={[Path.join(root, 'alpha')]}
        watchedRepositoryFolders={[]}
      />
    )

    fireEvent.click(
      screen.getByLabelText('Add all repositories found inside this folder')
    )
    fireEvent.click(
      screen.getByRole('button', { name: /find repositories/i, hidden: true })
    )

    await screen.findByText(/Found 3 repositories \(1 already added\)/)

    const alpha = screen.getByLabelText<HTMLInputElement>(
      'alpha (already added)'
    )
    assert.equal(alpha.disabled, true)

    // Untick one of the two new repositories
    fireEvent.click(screen.getByLabelText(Path.join('clients', 'gamma')))
    fireEvent.click(
      screen.getByLabelText(
        'Keep watching this folder and add new repositories automatically'
      )
    )

    const add = screen.getByRole('button', {
      name: /add 1 repository/i,
      hidden: true,
    })
    fireEvent.click(add)

    await waitFor(() => assert.equal(addRepositories.mock.callCount(), 1))
    assert.deepEqual(addRepositories.mock.calls[0].arguments[0], [
      Path.join(root, 'beta'),
    ])
    assert.equal(addWatchedRepositoryFolder.mock.callCount(), 1)
    assert.equal(onDismissed.mock.callCount(), 1)
    assert.equal(localStorage.getItem('add-repositories-last-folder'), root)
  })
})

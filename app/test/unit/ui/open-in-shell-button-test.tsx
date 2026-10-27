import assert from 'node:assert'
import { before, describe, it, mock } from 'node:test'
import * as React from 'react'

import type { Dispatcher } from '../../../src/ui/dispatcher'
import type { IMenuItem } from '../../../src/lib/menu-item'
import { fireEvent, render, screen, waitFor } from '../../helpers/ui/render'

let shownMenu: ReadonlyArray<IMenuItem> = []

before(() => {
  mock.module('../../../src/lib/shells/index.ts', {
    namedExports: {
      getAvailableShells: async () => [
        { shell: 'PowerShell', path: 'powershell.exe' },
        { shell: 'Git Bash', path: 'bash.exe' },
        { shell: 'Command Prompt', path: 'cmd.exe' },
      ],
    },
  })
  mock.module('../../../src/lib/menu-item.ts', {
    namedExports: {
      showContextualMenu: async (items: ReadonlyArray<IMenuItem>) => {
        shownMenu = items
      },
    },
  })
})

function createDispatcher() {
  const openShell = mock.fn((_path: string) => Promise.resolve())
  const setShell = mock.fn((_shell: string) => Promise.resolve())
  const setUseCustomShell = mock.fn((_use: boolean) => {})

  return {
    openShell,
    setShell,
    setUseCustomShell,
    dispatcher: {
      openShell,
      setShell,
      setUseCustomShell,
      showPopup: () => {},
    } as unknown as Dispatcher,
  }
}

describe('OpenInShellButton', () => {
  it('opens the selected shell, or another one picked from the dropdown', async () => {
    const { OpenInShellButton } = await import(
      '../../../src/ui/repository-actions/open-in-shell-button'
    )
    const { dispatcher, openShell, setShell } = createDispatcher()

    render(
      <OpenInShellButton
        dispatcher={dispatcher}
        path={'C:\\code\\repo'}
        selectedShell={'PowerShell' as any}
        useCustomShell={false}
        customShell={null}
      />
    )

    fireEvent.click(screen.getByText('Open in PowerShell'))
    assert.equal(openShell.mock.callCount(), 1)
    assert.equal(openShell.mock.calls[0].arguments[0], 'C:\\code\\repo')

    // Wait for the installed shells to be listed in the dropdown
    await waitFor(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Choose a terminal', hidden: true })
      )
      assert(shownMenu.some(i => i.label === 'Git Bash'))
    })

    const powerShell = shownMenu.find(i => i.label === 'PowerShell')
    assert.equal(powerShell?.checked, true)

    shownMenu.find(i => i.label === 'Git Bash')?.action?.()

    await waitFor(() => assert.equal(openShell.mock.callCount(), 2))
    assert.equal(setShell.mock.callCount(), 1)
    assert.equal(setShell.mock.calls[0].arguments[0], 'Git Bash')
  })
})

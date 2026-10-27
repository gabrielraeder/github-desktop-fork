import * as React from 'react'
import classNames from 'classnames'
import { Dispatcher } from '../dispatcher'
import { Button } from '../lib/button'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { getAvailableShells, Shell } from '../../lib/shells'
import { ICustomIntegration } from '../../lib/custom-integration'
import { IMenuItem, showContextualMenu } from '../../lib/menu-item'
import { PopupType } from '../../models/popup'
import { PreferencesTab } from '../../models/preferences'

interface IOpenInShellButtonProps {
  readonly dispatcher: Dispatcher

  /** The folder to open the terminal in */
  readonly path: string

  readonly selectedShell: Shell
  readonly useCustomShell: boolean
  readonly customShell: ICustomIntegration | null

  readonly size?: 'normal' | 'small'
  readonly className?: string
}

interface IOpenInShellButtonState {
  /** The shells installed on this machine, once known */
  readonly availableShells: ReadonlyArray<Shell>
  readonly isMenuOpen: boolean
}

/**
 * A split button that opens a folder in the user's terminal, with a dropdown
 * to pick another installed terminal. Picking one makes it the default shell
 * (as set in Options > Integrations).
 */
export class OpenInShellButton extends React.Component<
  IOpenInShellButtonProps,
  IOpenInShellButtonState
> {
  private unmounted = false

  public constructor(props: IOpenInShellButtonProps) {
    super(props)
    this.state = { availableShells: [], isMenuOpen: false }
  }

  public async componentDidMount() {
    const shells = await getAvailableShells().catch(() => [])
    if (!this.unmounted) {
      this.setState({ availableShells: shells.map(s => s.shell) })
    }
  }

  public componentWillUnmount() {
    this.unmounted = true
  }

  private get label() {
    const { useCustomShell, customShell, selectedShell } = this.props
    return useCustomShell && customShell !== null
      ? __DARWIN__
        ? 'Open in Terminal'
        : 'Open in terminal'
      : `Open in ${selectedShell}`
  }

  private onOpen = () => {
    this.props.dispatcher.openShell(this.props.path)
  }

  private openWith = async (shell: Shell) => {
    const { dispatcher, path } = this.props

    if (this.props.useCustomShell) {
      dispatcher.setUseCustomShell(false)
    }

    await dispatcher.setShell(shell)
    dispatcher.openShell(path)
  }

  private openWithCustomShell = () => {
    this.props.dispatcher.setUseCustomShell(true)
    this.props.dispatcher.openShell(this.props.path)
  }

  private openShellPreferences = () => {
    this.props.dispatcher.showPopup({
      type: PopupType.Preferences,
      initialSelectedTab: PreferencesTab.Integrations,
    })
  }

  private onShowMenu = async () => {
    const { useCustomShell, customShell, selectedShell } = this.props

    const items: Array<IMenuItem> = this.state.availableShells.map(shell => ({
      label: shell,
      type: 'checkbox',
      checked: !useCustomShell && shell === selectedShell,
      action: () => this.openWith(shell),
    }))

    if (customShell !== null) {
      items.push(
        { type: 'separator' },
        {
          label: __DARWIN__ ? 'Custom Shell' : 'Custom shell',
          type: 'checkbox',
          checked: useCustomShell,
          action: this.openWithCustomShell,
        }
      )
    }

    items.push(
      { type: 'separator' },
      {
        label: __DARWIN__ ? 'Shell Settings…' : 'Shell options…',
        action: this.openShellPreferences,
      }
    )

    this.setState({ isMenuOpen: true })
    await showContextualMenu(items)
    if (!this.unmounted) {
      this.setState({ isMenuOpen: false })
    }
  }

  public render() {
    return (
      <div className={classNames('open-in-shell-button', this.props.className)}>
        <Button
          className="open-in-shell-main"
          size={this.props.size}
          onClick={this.onOpen}
        >
          <Octicon symbol={octicons.terminal} />
          {this.label}
        </Button>
        <Button
          className="open-in-shell-dropdown"
          size={this.props.size}
          onClick={this.onShowMenu}
          ariaLabel="Choose a terminal"
          ariaHaspopup="menu"
          ariaExpanded={this.state.isMenuOpen}
          tooltip="Choose a terminal"
        >
          <Octicon symbol={octicons.triangleDown} />
        </Button>
      </div>
    )
  }
}

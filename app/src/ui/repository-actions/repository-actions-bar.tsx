import * as React from 'react'
import { Dispatcher } from '../dispatcher'
import { Repository } from '../../models/repository'
import { Button } from '../lib/button'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { Shell } from '../../lib/shells'
import { ICustomIntegration } from '../../lib/custom-integration'
import {
  DefaultEditorLabel,
  RevealInFileManagerLabel,
} from '../lib/context-menu'
import { OpenInShellButton } from './open-in-shell-button'

interface IRepositoryActionsBarProps {
  readonly dispatcher: Dispatcher
  readonly repository: Repository

  /**
   * The width of the sidebar, so that the actions line up with the content
   * next to it (and the branch dropdown in the toolbar above).
   */
  readonly sidebarWidth: number

  readonly isExternalEditorAvailable: boolean
  /** The name of the user's editor, if known */
  readonly externalEditorLabel?: string

  readonly selectedShell: Shell
  readonly useCustomShell: boolean
  readonly customShell: ICustomIntegration | null

  readonly onOpenInExternalEditor: (repository: Repository) => void
  readonly onShowRepository: (repository: Repository) => void
  readonly onViewOnGitHub: (repository: Repository) => void
}

/**
 * Quick actions for the selected repository, shown below the toolbar while
 * the "No local changes" suggestions, which offer the same actions, aren't.
 */
export class RepositoryActionsBar extends React.Component<IRepositoryActionsBarProps> {
  private onOpenInExternalEditor = () =>
    this.props.onOpenInExternalEditor(this.props.repository)

  private onShowRepository = () =>
    this.props.onShowRepository(this.props.repository)

  private onViewOnGitHub = () =>
    this.props.onViewOnGitHub(this.props.repository)

  public render() {
    const { repository, externalEditorLabel } = this.props

    return (
      <div
        className="repository-actions-bar"
        style={{
          paddingLeft: `calc(${this.props.sidebarWidth}px + var(--spacing))`,
        }}
        role="toolbar"
        aria-label="Repository actions"
      >
        {this.props.isExternalEditorAvailable && (
          <Button size="small" onClick={this.onOpenInExternalEditor}>
            <Octicon symbol={octicons.code} />
            {externalEditorLabel
              ? `Open in ${externalEditorLabel}`
              : DefaultEditorLabel}
          </Button>
        )}
        <Button size="small" onClick={this.onShowRepository}>
          <Octicon symbol={octicons.fileDirectory} />
          {RevealInFileManagerLabel}
        </Button>
        {repository.gitHubRepository !== null && (
          <Button size="small" onClick={this.onViewOnGitHub}>
            <Octicon symbol={octicons.markGithub} />
            View on GitHub
          </Button>
        )}
        <OpenInShellButton
          size="small"
          dispatcher={this.props.dispatcher}
          path={repository.path}
          selectedShell={this.props.selectedShell}
          useCustomShell={this.props.useCustomShell}
          customShell={this.props.customShell}
        />
      </div>
    )
  }
}

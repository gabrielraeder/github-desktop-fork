import * as React from 'react'
import * as Path from 'path'
import { SuccessBanner } from './success-banner'

/** How many repository names to list before summarizing the rest */
const MaxNamesShown = 3

interface IRemovedMissingRepositoriesProps {
  /** Paths of the repositories that were removed */
  readonly paths: ReadonlyArray<string>
  readonly onDismissed: () => void
  readonly onUndo: () => void
}

/**
 * Tells the user that repositories whose folder has been deleted were removed
 * from the repository list, and lets them undo it.
 */
export class RemovedMissingRepositories extends React.Component<IRemovedMissingRepositoriesProps> {
  public render() {
    const { paths, onDismissed, onUndo } = this.props
    const names = paths.slice(0, MaxNamesShown).map(p => Path.basename(p))
    const more = paths.length - names.length
    const noun = paths.length === 1 ? 'repository' : 'repositories'
    const folders =
      paths.length === 1 ? 'folder no longer exists' : 'folders no longer exist'

    return (
      <SuccessBanner timeout={15000} onDismissed={onDismissed} onUndo={onUndo}>
        Removed {paths.length} {noun} whose {folders}:{' '}
        <strong>{names.join(', ')}</strong>
        {more > 0 && ` and ${more} more`}.
      </SuccessBanner>
    )
  }
}

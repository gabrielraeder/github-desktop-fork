import * as React from 'react'
import { LinkButton } from '../lib/link-button'
import { Ref } from '../lib/ref'

interface IWatchedFolderProps {
  readonly path: string
  readonly onStopWatching: (path: string) => void
}

/** A folder watched for new repositories, which the user can stop watching. */
export class WatchedFolder extends React.Component<IWatchedFolderProps> {
  private onStopWatching = () => {
    this.props.onStopWatching(this.props.path)
  }

  public render() {
    return (
      <li className="watched-folder">
        <Ref>{this.props.path}</Ref>
        <LinkButton onClick={this.onStopWatching}>Stop watching</LinkButton>
      </li>
    )
  }
}

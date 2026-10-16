import * as React from 'react'

import { Dispatcher } from '../dispatcher'
import { nameOf, Repository } from '../../models/repository'
import { ICustomRepositoryGroup } from '../../models/custom-repository-group'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { TextBox } from '../lib/text-box'

interface IRepositoryGroupNameDialogProps {
  readonly dispatcher: Dispatcher
  readonly onDismissed: () => void

  /** The group to rename, or undefined to create a new group */
  readonly group?: ICustomRepositoryGroup

  /** A repository to move into the new group */
  readonly repository?: Repository
}

interface IRepositoryGroupNameDialogState {
  readonly name: string
}

/** Asks for the name of a new custom repository group, or for a new name. */
export class RepositoryGroupNameDialog extends React.Component<
  IRepositoryGroupNameDialogProps,
  IRepositoryGroupNameDialogState
> {
  public constructor(props: IRepositoryGroupNameDialogProps) {
    super(props)

    this.state = { name: props.group?.name ?? '' }
  }

  public render() {
    const { group, repository } = this.props
    const isRename = group !== undefined
    const title = isRename
      ? __DARWIN__
        ? 'Rename Group'
        : 'Rename group'
      : __DARWIN__
      ? 'New Group'
      : 'New group'

    const description = isRename
      ? `Choose a new name for the group "${group.name}".`
      : repository !== undefined
      ? `Choose a name for the new group. "${nameOf(
          repository
        )}" will be moved into it.`
      : 'Choose a name for the new group.'

    return (
      <Dialog
        id="repository-group-name"
        title={title}
        ariaDescribedBy="repository-group-name-description"
        onDismissed={this.props.onDismissed}
        onSubmit={this.onSubmit}
      >
        <DialogContent>
          <p id="repository-group-name-description">{description}</p>
          <p>
            <TextBox
              ariaLabel="Group name"
              placeholder="e.g. a client or project"
              value={this.state.name}
              onValueChanged={this.onNameChanged}
            />
          </p>
        </DialogContent>

        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={
              isRename
                ? __DARWIN__
                  ? 'Rename Group'
                  : 'Rename group'
                : __DARWIN__
                ? 'Create Group'
                : 'Create group'
            }
            okButtonDisabled={this.state.name.trim().length === 0}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private onNameChanged = (name: string) => {
    this.setState({ name })
  }

  private onSubmit = () => {
    const { dispatcher, group, repository } = this.props
    const name = this.state.name.trim()

    if (name.length === 0) {
      return
    }

    if (group !== undefined) {
      dispatcher.renameRepositoryGroup(group.id, name)
    } else {
      dispatcher.createRepositoryGroup(name, repository)
    }

    this.props.onDismissed()
  }
}

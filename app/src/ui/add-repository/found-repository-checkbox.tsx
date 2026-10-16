import * as React from 'react'
import { Checkbox, CheckboxValue } from '../lib/checkbox'

interface IFoundRepositoryCheckboxProps {
  /** The full path of the repository found */
  readonly path: string

  /** The text to show, e.g. the path relative to the searched folder */
  readonly label: string

  readonly checked: boolean

  /** Repositories already in the list can't be selected */
  readonly alreadyAdded: boolean

  readonly onChange: (path: string, checked: boolean) => void
}

/** A repository found when searching a folder, which can be (de)selected. */
export class FoundRepositoryCheckbox extends React.Component<IFoundRepositoryCheckboxProps> {
  private onChange = (event: React.FormEvent<HTMLInputElement>) => {
    this.props.onChange(this.props.path, event.currentTarget.checked)
  }

  public render() {
    const { label, checked, alreadyAdded } = this.props

    return (
      <Checkbox
        className="found-repository"
        label={alreadyAdded ? `${label} (already added)` : label}
        value={checked ? CheckboxValue.On : CheckboxValue.Off}
        disabled={alreadyAdded}
        onChange={this.onChange}
      />
    )
  }
}

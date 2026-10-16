import * as React from 'react'
import * as Path from 'path'
import { Dispatcher } from '../dispatcher'
import { addSafeDirectory, getRepositoryType } from '../../lib/git'
import { Button } from '../lib/button'
import { TextBox } from '../lib/text-box'
import { Row } from '../lib/row'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { LinkButton } from '../lib/link-button'
import { PopupType } from '../../models/popup'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { FoldoutType } from '../../lib/app-state'

import untildify from 'untildify'
import { showOpenDialog } from '../main-process-proxy'
import { Ref } from '../lib/ref'
import { InputError } from '../lib/input-description/input-error'
import { IAccessibleMessage } from '../../models/accessible-message'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { findRepositories } from '../../lib/find-repositories'
import { containsPath } from '../../lib/path-comparison'
import { getBoolean, setBoolean } from '../../lib/local-storage'
import { FoundRepositoryCheckbox } from './found-repository-checkbox'

/** Whether the user last chose to add the repositories inside a folder */
const SearchSubfoldersKey = 'add-repositories-search-subfolders'

/** The folder the user last added the repositories inside of */
const LastSearchedFolderKey = 'add-repositories-last-folder'

interface IAddExistingRepositoryProps {
  readonly dispatcher: Dispatcher
  readonly onDismissed: () => void

  /** An optional path to prefill the path text box with.
   * Defaults to the empty string if not defined.
   */
  readonly path?: string

  /** Paths of the repositories already in the repository list */
  readonly existingRepositoryPaths: ReadonlyArray<string>

  /** Folders already watched for new repositories */
  readonly watchedRepositoryFolders: ReadonlyArray<string>
}

/** The repositories found by searching a folder */
interface IFolderSearchResult {
  /** The path as entered when the folder was searched */
  readonly path: string
  readonly repositoryPaths: ReadonlyArray<string>
}

interface IAddExistingRepositoryState {
  readonly path: string

  /**
   * Indicates whether or not to render a warning message about the entered path
   * not containing a valid Git repository. This value differs from `isGitRepository` in that it holds
   * its value when the path changes until we've gotten a definitive answer from the asynchronous
   * method that the path is, or isn't, a valid repository path. Separating the two means that
   * we don't toggle visibility of the warning message until it's really necessary, preventing
   * flickering for our users as they type in a path.
   */
  readonly showNonGitRepositoryWarning: boolean
  readonly isRepositoryBare: boolean
  readonly isRepositoryUnsafe: boolean
  readonly repositoryUnsafePath?: string
  readonly isTrustingRepository: boolean

  /**
   * Whether to add all the repositories found inside the chosen folder rather
   * than the folder itself.
   */
  readonly searchSubfolders: boolean
  readonly isSearchingSubfolders: boolean

  /** Shown when searching the chosen folder didn't find any repositories */
  readonly noRepositoriesFoundPath?: string

  /** The repositories found inside the folder, to choose from */
  readonly searchResult?: IFolderSearchResult
  readonly selectedRepositoryPaths: ReadonlySet<string>

  /** Whether to keep adding new repositories that appear in the folder */
  readonly watchFolder: boolean
}

/** The component for adding an existing local repository. */
export class AddExistingRepository extends React.Component<
  IAddExistingRepositoryProps,
  IAddExistingRepositoryState
> {
  private pathTextBoxRef = React.createRef<TextBox>()

  public constructor(props: IAddExistingRepositoryProps) {
    super(props)

    // Pick up where the user left off when adding the repositories in a
    // folder, unless we've been given a path to add.
    const searchSubfolders =
      !this.props.path && getBoolean(SearchSubfoldersKey, false)
    const path = this.props.path
      ? this.props.path
      : searchSubfolders
      ? localStorage.getItem(LastSearchedFolderKey) ?? ''
      : ''

    this.state = {
      path,
      showNonGitRepositoryWarning: false,
      isRepositoryBare: false,
      isRepositoryUnsafe: false,
      isTrustingRepository: false,
      searchSubfolders,
      isSearchingSubfolders: false,
      selectedRepositoryPaths: new Set(),
      watchFolder: this.isWatched(path),
    }
  }

  private onTrustDirectory = async () => {
    this.setState({ isTrustingRepository: true })
    const { repositoryUnsafePath, path } = this.state
    try {
      if (repositoryUnsafePath) {
        await addSafeDirectory(repositoryUnsafePath)
      }
      await this.validatePath(path)
    } catch (error) {
      this.props.dispatcher.postError(error)
    } finally {
      this.setState({ isTrustingRepository: false })
    }
  }

  private async updatePath(path: string) {
    this.setState({
      path,
      noRepositoriesFoundPath: undefined,
      searchResult: undefined,
      watchFolder: this.isWatched(path),
    })
  }

  private isWatched(path: string) {
    return (
      path.length > 0 &&
      containsPath(this.props.watchedRepositoryFolders, this.resolvedPath(path))
    )
  }

  private isAlreadyAdded = (path: string) =>
    containsPath(this.props.existingRepositoryPaths, path)

  /** The search result for the path currently entered, if any */
  private getSearchResult() {
    const { searchResult, path } = this.state
    return searchResult !== undefined && searchResult.path === path
      ? searchResult
      : undefined
  }

  private async validatePath(path: string): Promise<boolean> {
    if (path.length === 0) {
      this.setState({
        isRepositoryBare: false,
        showNonGitRepositoryWarning: false,
      })
      return false
    }

    const type = await getRepositoryType(path)

    const isRepository = type.kind !== 'missing' && type.kind !== 'unsafe'
    const isRepositoryUnsafe = type.kind === 'unsafe'
    const isRepositoryBare = type.kind === 'bare'
    const showNonGitRepositoryWarning = !isRepository || isRepositoryBare
    const repositoryUnsafePath = type.kind === 'unsafe' ? type.path : undefined

    this.setState(state =>
      path === state.path
        ? {
            isRepositoryBare,
            isRepositoryUnsafe,
            showNonGitRepositoryWarning,
            repositoryUnsafePath,
          }
        : null
    )

    return path.length > 0 && isRepository && !isRepositoryBare
  }

  private buildBareRepositoryError() {
    if (
      !this.state.path.length ||
      !this.state.showNonGitRepositoryWarning ||
      !this.state.isRepositoryBare
    ) {
      return null
    }

    const msg =
      'This directory appears to be a bare repository. Bare repositories are not currently supported.'

    return { screenReaderMessage: msg, displayedMessage: msg }
  }

  private buildRepositoryUnsafeError() {
    const { repositoryUnsafePath, path } = this.state
    if (
      !this.state.path.length ||
      !this.state.showNonGitRepositoryWarning ||
      !this.state.isRepositoryUnsafe ||
      repositoryUnsafePath === undefined
    ) {
      return null
    }

    // Git for Windows will replace backslashes with slashes in the error
    // message so we'll do the same to not show "the repo at path c:/repo"
    // when the entered path is `c:\repo`.
    const convertedPath = __WIN32__ ? path.replaceAll('\\', '/') : path

    const displayedMessage = (
      <>
        <p>
          The Git repository
          {repositoryUnsafePath !== convertedPath && (
            <>
              {' at '}
              <Ref>{repositoryUnsafePath}</Ref>
            </>
          )}{' '}
          appears to be owned by another user on your machine. Adding untrusted
          repositories may automatically execute files in the repository.
        </p>
        <p>
          If you trust the owner of the directory you can
          <LinkButton onClick={this.onTrustDirectory}>
            {' '}
            add an exception for this directory
          </LinkButton>{' '}
          in order to continue.
        </p>
      </>
    )

    const screenReaderMessage = `The Git repository appears to be owned by another user on your machine.
      Adding untrusted repositories may automatically execute files in the repository.
      If you trust the owner of the directory you can add an exception for this directory in order to continue.`

    return { screenReaderMessage, displayedMessage }
  }

  private buildNotAGitRepositoryError(): IAccessibleMessage | null {
    if (!this.state.path.length || !this.state.showNonGitRepositoryWarning) {
      return null
    }

    const displayedMessage = (
      <>
        <p>This directory does not appear to be a Git repository.</p>
        <p>
          Would you like to{' '}
          <LinkButton onClick={this.onCreateRepositoryClicked}>
            create a repository
          </LinkButton>{' '}
          here, or{' '}
          <LinkButton onClick={this.onSearchSubfoldersClicked}>
            add the repositories inside it
          </LinkButton>{' '}
          instead?
        </p>
      </>
    )

    const screenReaderMessage =
      'This directory does not appear to be a Git repository. Would you like to create a repository here, or add the repositories inside it instead?'

    return { screenReaderMessage, displayedMessage }
  }

  private buildNoRepositoriesFoundError(): IAccessibleMessage | null {
    const { noRepositoriesFoundPath, path } = this.state
    if (
      noRepositoriesFoundPath === undefined ||
      noRepositoriesFoundPath !== path
    ) {
      return null
    }

    const msg = 'No Git repositories were found inside this directory.'
    return { screenReaderMessage: msg, displayedMessage: msg }
  }

  private renderErrors() {
    if (this.state.searchSubfolders) {
      return this.renderMessage(this.buildNoRepositoriesFoundError())
    }

    return this.renderMessage(
      this.buildBareRepositoryError() ??
        this.buildRepositoryUnsafeError() ??
        this.buildNotAGitRepositoryError()
    )
  }

  private renderMessage(msg: IAccessibleMessage | null) {
    if (msg === null) {
      return null
    }

    return (
      <Row>
        <InputError
          id="add-existing-repository-path-error"
          ariaLiveMessage={msg.screenReaderMessage}
        >
          {msg.displayedMessage}
        </InputError>
      </Row>
    )
  }

  public render() {
    return (
      <Dialog
        id="add-existing-repository"
        title={__DARWIN__ ? 'Add Local Repository' : 'Add local repository'}
        onSubmit={this.addRepository}
        onDismissed={this.props.onDismissed}
        loading={
          this.state.isTrustingRepository || this.state.isSearchingSubfolders
        }
      >
        <DialogContent>
          <Row>
            <TextBox
              ref={this.pathTextBoxRef}
              value={this.state.path}
              label={__DARWIN__ ? 'Local Path' : 'Local path'}
              placeholder="repository path"
              onValueChanged={this.onPathChanged}
              ariaDescribedBy="add-existing-repository-path-error"
            />
            <Button onClick={this.showFilePicker}>Choose…</Button>
          </Row>
          <Row>
            <Checkbox
              label="Add all repositories found inside this folder"
              value={
                this.state.searchSubfolders
                  ? CheckboxValue.On
                  : CheckboxValue.Off
              }
              onChange={this.onSearchSubfoldersChanged}
            />
          </Row>
          {this.state.searchSubfolders && (
            <Row>
              <Checkbox
                label="Keep watching this folder and add new repositories automatically"
                value={
                  this.state.watchFolder ? CheckboxValue.On : CheckboxValue.Off
                }
                onChange={this.onWatchFolderChanged}
              />
            </Row>
          )}
          {this.state.searchSubfolders && this.renderSearchResult()}
          {this.renderErrors()}
        </DialogContent>

        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={this.getOkButtonText()}
            okButtonDisabled={this.isOkButtonDisabled()}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private getSelectedRepositoryPaths() {
    const result = this.getSearchResult()
    return result === undefined
      ? []
      : result.repositoryPaths.filter(
          p =>
            this.state.selectedRepositoryPaths.has(p) && !this.isAlreadyAdded(p)
        )
  }

  private getOkButtonText() {
    if (!this.state.searchSubfolders) {
      return __DARWIN__ ? 'Add Repository' : 'Add repository'
    }

    if (this.getSearchResult() === undefined) {
      return __DARWIN__ ? 'Find Repositories' : 'Find repositories'
    }

    const count = this.getSelectedRepositoryPaths().length
    if (count === 0 && this.state.watchFolder) {
      return __DARWIN__ ? 'Watch Folder' : 'Watch folder'
    }

    const noun = count === 1 ? 'Repository' : 'Repositories'
    return `Add ${count} ${__DARWIN__ ? noun : noun.toLowerCase()}`
  }

  private isOkButtonDisabled() {
    return (
      this.state.searchSubfolders &&
      this.getSearchResult() !== undefined &&
      this.getSelectedRepositoryPaths().length === 0 &&
      !this.state.watchFolder
    )
  }

  private renderSearchResult() {
    const result = this.getSearchResult()
    if (result === undefined) {
      return null
    }

    const root = this.resolvedPath(result.path)
    const { repositoryPaths } = result
    const alreadyAdded = repositoryPaths.filter(this.isAlreadyAdded).length
    const noun = repositoryPaths.length === 1 ? 'repository' : 'repositories'

    return (
      <div className="found-repositories">
        <div className="found-repositories-header">
          <span>
            Found {repositoryPaths.length} {noun}
            {alreadyAdded > 0 && ` (${alreadyAdded} already added)`}
          </span>
          <span>
            <LinkButton onClick={this.onSelectAllFound}>Select all</LinkButton>
            {' · '}
            <LinkButton onClick={this.onSelectNoneFound}>None</LinkButton>
          </span>
        </div>
        <div className="found-repositories-list">
          {repositoryPaths.map(p => (
            <FoundRepositoryCheckbox
              key={p}
              path={p}
              label={Path.relative(root, p) || Path.basename(p)}
              checked={
                this.state.selectedRepositoryPaths.has(p) &&
                !this.isAlreadyAdded(p)
              }
              alreadyAdded={this.isAlreadyAdded(p)}
              onChange={this.onFoundRepositoryChanged}
            />
          ))}
        </div>
      </div>
    )
  }

  private onFoundRepositoryChanged = (path: string, checked: boolean) => {
    const selectedRepositoryPaths = new Set(this.state.selectedRepositoryPaths)
    if (checked) {
      selectedRepositoryPaths.add(path)
    } else {
      selectedRepositoryPaths.delete(path)
    }
    this.setState({ selectedRepositoryPaths })
  }

  private onSelectAllFound = () => {
    const result = this.getSearchResult()
    this.setState({
      selectedRepositoryPaths: new Set(result?.repositoryPaths ?? []),
    })
  }

  private onSelectNoneFound = () => {
    this.setState({ selectedRepositoryPaths: new Set() })
  }

  private onWatchFolderChanged = (event: React.FormEvent<HTMLInputElement>) => {
    this.setState({ watchFolder: event.currentTarget.checked })
  }

  private onSearchSubfoldersChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    const searchSubfolders = event.currentTarget.checked
    setBoolean(SearchSubfoldersKey, searchSubfolders)
    this.setState({ searchSubfolders })
  }

  private onSearchSubfoldersClicked = () => {
    setBoolean(SearchSubfoldersKey, true)
    this.setState({ searchSubfolders: true })
  }

  private onPathChanged = async (path: string) => {
    if (this.state.path !== path) {
      this.updatePath(path)
    }
  }

  private showFilePicker = async () => {
    const defaultPath =
      this.state.path.length > 0
        ? this.resolvedPath(this.state.path)
        : localStorage.getItem(LastSearchedFolderKey) ?? undefined

    const path = await showOpenDialog({
      properties: ['createDirectory', 'openDirectory'],
      defaultPath,
    })

    if (path === null) {
      return
    }

    this.updatePath(path)
  }

  private resolvedPath(path: string): string {
    return Path.resolve('/', untildify(path))
  }

  private addRepository = async () => {
    if (this.state.searchSubfolders) {
      return this.addRepositoriesInFolder()
    }

    const { path } = this.state
    const isValidPath = await this.validatePath(path)

    if (!isValidPath) {
      this.pathTextBoxRef.current?.focus()
      return
    }

    this.props.onDismissed()
    const { dispatcher } = this.props

    const resolvedPath = this.resolvedPath(path)
    const repositories = await dispatcher.addRepositories([resolvedPath])

    if (repositories.length > 0) {
      dispatcher.closeFoldout(FoldoutType.Repository)
      dispatcher.selectRepository(repositories[0])
      dispatcher.recordAddExistingRepository()
    }
  }

  private addRepositoriesInFolder = async () => {
    const { path } = this.state

    if (path.length === 0) {
      this.pathTextBoxRef.current?.focus()
      return
    }

    const resolvedPath = this.resolvedPath(path)

    // The first step is to search the folder and let the user pick which of
    // the repositories found to add.
    if (this.getSearchResult() === undefined) {
      this.setState({ isSearchingSubfolders: true })
      const repositoryPaths = await findRepositories(resolvedPath)
      this.setState({ isSearchingSubfolders: false })

      if (repositoryPaths.length === 0) {
        this.setState({ noRepositoriesFoundPath: path })
        this.pathTextBoxRef.current?.focus()
        return
      }

      this.setState({
        searchResult: { path, repositoryPaths },
        selectedRepositoryPaths: new Set(
          repositoryPaths.filter(p => !this.isAlreadyAdded(p))
        ),
      })
      return
    }

    const paths = this.getSelectedRepositoryPaths()
    if (paths.length === 0 && !this.state.watchFolder) {
      return
    }

    localStorage.setItem(LastSearchedFolderKey, resolvedPath)
    this.props.onDismissed()
    const { dispatcher } = this.props

    if (this.state.watchFolder) {
      dispatcher.addWatchedRepositoryFolder(resolvedPath)
    }

    if (paths.length === 0) {
      return
    }

    const repositories = await dispatcher.addRepositories(paths)

    if (repositories.length > 0) {
      dispatcher.selectRepository(repositories[0])
      dispatcher.showFoldout({ type: FoldoutType.Repository })
      dispatcher.recordAddExistingRepository()
    }
  }

  private onCreateRepositoryClicked = () => {
    this.props.onDismissed()

    const resolvedPath = this.resolvedPath(this.state.path)

    return this.props.dispatcher.showPopup({
      type: PopupType.CreateRepository,
      path: resolvedPath,
    })
  }
}

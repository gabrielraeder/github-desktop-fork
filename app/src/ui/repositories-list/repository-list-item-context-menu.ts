import { Repository } from '../../models/repository'
import { ICustomRepositoryGroup } from '../../models/custom-repository-group'
import { caseInsensitiveCompare } from '../../lib/compare'
import { IMenuItem } from '../../lib/menu-item'
import { Repositoryish } from './group-repositories'
import { writeClipboardText } from '../main-process-proxy'
import {
  RevealInFileManagerLabel,
  DefaultEditorLabel,
  DefaultShellLabel,
} from '../lib/context-menu'

interface IRepositoryListItemContextMenuConfig {
  repository: Repositoryish
  shellLabel: string | undefined
  externalEditorLabel: string | undefined
  askForConfirmationOnRemoveRepository: boolean
  onViewOnGitHub: (repository: Repositoryish) => void
  onOpenInShell: (repository: Repositoryish) => void
  onShowRepository: (repository: Repositoryish) => void
  onOpenInExternalEditor: (repository: Repositoryish) => void
  onRemoveRepository: (repository: Repositoryish) => void
  onChangeRepositoryAlias: (repository: Repository) => void
  onRemoveRepositoryAlias: (repository: Repository) => void
  isFavorite: boolean
  onSetRepositoryFavorite: (repository: Repository, favorite: boolean) => void
  customGroups: ReadonlyArray<ICustomRepositoryGroup>
  /** The id of the custom group the repository is in, if any */
  currentGroupId: string | undefined
  onMoveToGroup: (repository: Repository, groupId: string | null) => void
  onCreateGroup: (repository: Repository) => void
  onCreateWorktree?: (repository: Repository) => void
  onShowWorktrees?: (repository: Repository) => void
}

export const generateRepositoryListContextMenu = (
  config: IRepositoryListItemContextMenuConfig
) => {
  const { repository } = config
  const missing = repository instanceof Repository && repository.missing
  const github =
    repository instanceof Repository && repository.gitHubRepository != null
  const openInExternalEditor = config.externalEditorLabel
    ? `Open in ${config.externalEditorLabel}`
    : DefaultEditorLabel
  const openInShell = config.shellLabel
    ? `Open in ${config.shellLabel}`
    : DefaultShellLabel

  const items: ReadonlyArray<IMenuItem> = [
    ...buildFavoriteMenuItems(config),
    ...buildGroupMenuItems(config),
    ...buildAliasMenuItems(config),
    ...buildWorktreeMenuItems(config),
    {
      label: __DARWIN__ ? 'Copy Repo Name' : 'Copy repo name',
      action: () => writeClipboardText(repository.name),
    },
    {
      label: __DARWIN__ ? 'Copy Repo Path' : 'Copy repo path',
      action: () => writeClipboardText(repository.path),
    },
    { type: 'separator' },
    {
      label: 'View on GitHub',
      action: () => config.onViewOnGitHub(repository),
      enabled: github,
    },
    {
      label: openInShell,
      action: () => config.onOpenInShell(repository),
      enabled: !missing,
    },
    {
      label: RevealInFileManagerLabel,
      action: () => config.onShowRepository(repository),
      enabled: !missing,
    },
    {
      label: openInExternalEditor,
      action: () => config.onOpenInExternalEditor(repository),
      enabled: !missing,
    },
    { type: 'separator' },
    {
      label: config.askForConfirmationOnRemoveRepository ? 'Remove…' : 'Remove',
      action: () => config.onRemoveRepository(repository),
    },
  ]

  return items
}

const buildFavoriteMenuItems = (
  config: IRepositoryListItemContextMenuConfig
): ReadonlyArray<IMenuItem> => {
  const { repository, isFavorite } = config

  if (!(repository instanceof Repository)) {
    return []
  }

  const label = isFavorite
    ? __DARWIN__
      ? 'Remove from Favorites'
      : 'Remove from favorites'
    : __DARWIN__
    ? 'Add to Favorites'
    : 'Add to favorites'

  return [
    {
      label,
      action: () => config.onSetRepositoryFavorite(repository, !isFavorite),
    },
  ]
}

/** Ampersands mark access keys in menu labels, so they must be doubled */
const escapeMenuLabel = (label: string) => label.replaceAll('&', '&&')

const buildGroupMenuItems = (
  config: IRepositoryListItemContextMenuConfig
): ReadonlyArray<IMenuItem> => {
  const { repository, customGroups, currentGroupId } = config

  if (!(repository instanceof Repository)) {
    return []
  }

  const groupItems: ReadonlyArray<IMenuItem> = [...customGroups]
    .sort((x, y) => caseInsensitiveCompare(x.name, y.name))
    .map(group => ({
      label: escapeMenuLabel(group.name),
      type: 'checkbox',
      checked: group.id === currentGroupId,
      action: () =>
        config.onMoveToGroup(
          repository,
          group.id === currentGroupId ? null : group.id
        ),
    }))

  const submenu: Array<IMenuItem> = [...groupItems]

  if (groupItems.length > 0) {
    submenu.push({ type: 'separator' })
  }

  submenu.push({
    label: __DARWIN__ ? 'New Group…' : 'New group…',
    action: () => config.onCreateGroup(repository),
  })

  if (currentGroupId !== undefined) {
    submenu.push({
      label: __DARWIN__ ? 'Remove from Group' : 'Remove from group',
      action: () => config.onMoveToGroup(repository, null),
    })
  }

  return [{ label: __DARWIN__ ? 'Move to Group' : 'Move to group', submenu }]
}

const buildAliasMenuItems = (
  config: IRepositoryListItemContextMenuConfig
): ReadonlyArray<IMenuItem> => {
  const { repository } = config

  if (!(repository instanceof Repository)) {
    return []
  }

  const verb = repository.alias == null ? 'Create' : 'Change'
  const items: Array<IMenuItem> = [
    {
      label: __DARWIN__ ? `${verb} Alias` : `${verb} alias`,
      action: () => config.onChangeRepositoryAlias(repository),
    },
  ]

  if (repository.alias !== null) {
    items.push({
      label: __DARWIN__ ? 'Remove Alias' : 'Remove alias',
      action: () => config.onRemoveRepositoryAlias(repository),
    })
  }

  return items
}

const buildWorktreeMenuItems = (
  config: IRepositoryListItemContextMenuConfig
): ReadonlyArray<IMenuItem> => {
  const { repository, onCreateWorktree, onShowWorktrees } = config

  if (!(repository instanceof Repository)) {
    return []
  }

  if (onCreateWorktree === undefined && onShowWorktrees === undefined) {
    return []
  }

  const items: Array<IMenuItem> = []

  if (onShowWorktrees !== undefined) {
    items.push({
      label: __DARWIN__ ? 'Show Worktrees' : 'Show worktrees',
      action: () => onShowWorktrees(repository),
    })
  }

  if (onCreateWorktree !== undefined) {
    items.push({
      label: __DARWIN__ ? 'New Worktree…' : 'New worktree…',
      action: () => onCreateWorktree(repository),
    })
  }

  return items
}

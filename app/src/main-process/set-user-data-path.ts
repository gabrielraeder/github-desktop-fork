import { app } from 'electron'
import { join } from 'path'

/**
 * Give this fork its own user data directory (`<appData>/GitHub Desktop Fork`)
 * instead of sharing the one used by the official GitHub Desktop.
 *
 * The two apps can ship different Electron versions, and Chromium doesn't
 * support opening storage written by a newer version of itself. Sharing the
 * directory lost the repository database when switching between the two.
 *
 * This module must be imported before anything reads the `userData` path.
 */
app.setPath('userData', join(app.getPath('appData'), `${app.getName()} Fork`))

import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  containsPath,
  isPathInside,
  normalizePathForComparison,
} from '../../src/lib/path-comparison'

describe('path comparison', () => {
  it('compares Windows paths case insensitively', () => {
    assert.equal(
      normalizePathForComparison('C:\\Code\\Repo\\', 'win32'),
      normalizePathForComparison('c:\\code\\repo\\', 'win32')
    )
    assert(containsPath(['C:\\Code\\Repo'], 'c:\\code\\repo', 'win32'))
    assert(!containsPath(['/code/Repo'], '/code/repo', 'linux'))
  })

  it('checks whether a path is inside a folder', () => {
    assert(isPathInside('C:\\code\\a\\repo', 'c:\\Code', 'win32'))
    assert(!isPathInside('C:\\code', 'C:\\code', 'win32'))
    assert(!isPathInside('C:\\codebase\\repo', 'C:\\code', 'win32'))
    assert(!isPathInside('D:\\code\\repo', 'C:\\code', 'win32'))
    assert(isPathInside('/home/me/code/repo', '/home/me/code', 'linux'))
    assert(!isPathInside('/home/me/other', '/home/me/code', 'linux'))
  })
})

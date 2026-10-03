/**
 * Unit tests: the settings menu's shape (src/pages/Watch/settingsMenu.ts).
 * Run: npm test
 *
 * The failure these guard against is a stranded screen: a page name that no
 * parent points at, or a level nobody can back out of, and the only way to
 * find out is on a device with the menu open.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  ALL_PAGES,
  SETTINGS_GROUPS,
  SETTINGS_LEAVES,
  groupOf,
  pageDepth,
  parentPage,
  type SettingsPage,
} from '../src/pages/Watch/settingsMenu.ts'

test('every page has a parent, and the root has none', () => {
  for (const page of ALL_PAGES) {
    if (page === 'root') {
      assert.equal(parentPage(page), null)
      continue
    }
    const parent = parentPage(page)
    assert.ok(parent, `${page} has no parent`)
    assert.notEqual(parent, page, `${page} is its own parent`)
  }
})

test('every page is reachable from the root by going back up', () => {
  for (const page of ALL_PAGES) {
    const seen: SettingsPage[] = [page]
    let current = parentPage(page)
    while (current !== null) {
      assert.ok(!seen.includes(current), `cycle: ${seen.join(' -> ')} -> ${current}`)
      seen.push(current)
      current = parentPage(current)
    }
    assert.deepEqual(seen.at(-1), 'root', `${page} does not end at the root`)
  }
})

test('nothing is more than two taps from the root', () => {
  for (const page of ALL_PAGES) {
    const depth = pageDepth(page)
    assert.ok(depth <= 2, `${page} is ${depth} taps deep`)
    assert.ok(Number.isFinite(depth), `${page} is in a cycle`)
  }
})

test('the two groups sit at depth 1 and their value lists at depth 2', () => {
  assert.equal(pageDepth('root'), 0)
  for (const group of SETTINGS_GROUPS) assert.equal(pageDepth(group), 1)
  for (const leaf of SETTINGS_LEAVES) assert.equal(pageDepth(leaf), 2)
})

test('a value list belongs to a group, and nothing else claims one', () => {
  for (const leaf of SETTINGS_LEAVES) {
    assert.ok(groupOf(leaf), `${leaf} belongs to no group`)
    assert.equal(groupOf(leaf), parentPage(leaf))
  }
  assert.equal(groupOf('root'), null)
  for (const group of SETTINGS_GROUPS) assert.equal(groupOf(group), null)
})

test('the page list is exactly root + groups + value lists', () => {
  assert.equal(ALL_PAGES.length, 1 + SETTINGS_GROUPS.length + SETTINGS_LEAVES.length)
  assert.equal(new Set(ALL_PAGES).size, ALL_PAGES.length, 'a page name is repeated')
  assert.ok(ALL_PAGES.includes('root'))
})

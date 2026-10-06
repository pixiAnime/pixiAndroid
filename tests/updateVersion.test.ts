/**
 * Unit tests: release comparison + APK asset pick for the in-app updater
 * (src/api/update/latest.ts).
 * Run: npm test
 *
 * These two decide whether the header shows the update button at all, so they
 * are pinned without a network: every shape the GitHub releases API can take
 * has to leave the button's presence or absence correct.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isNewerVersion, normalizeVersion, pickApkAsset } from '../src/api/update/latest.ts'

test('normalizes a "v" tag onto versionName form', () => {
  assert.equal(normalizeVersion('v0.1.36'), '0.1.36')
  assert.equal(normalizeVersion('  0.1.36 '), '0.1.36')
  assert.equal(normalizeVersion('V2.0'), '2.0')
})

test('a higher release is newer, a stale tag is not', () => {
  assert.equal(isNewerVersion('0.1.37', '0.1.36'), true)
  assert.equal(isNewerVersion('0.1.36', '0.1.36'), false)
  assert.equal(isNewerVersion('0.1.35', '0.1.36'), false)
})

test('compares numerically, not as strings', () => {
  // String order would call "0.1.9" the newer one and hide a real update.
  assert.equal(isNewerVersion('0.1.9', '0.1.36'), false)
  assert.equal(isNewerVersion('0.2.0', '0.1.36'), true)
  // Missing segments are zero, extra ones count when they differ.
  assert.equal(isNewerVersion('0.2', '0.2.0'), false)
  assert.equal(isNewerVersion('0.2.1', '0.2'), true)
})

test('garbage versions never claim an update', () => {
  assert.equal(isNewerVersion('not-a-version', '0.1.36'), false)
  assert.equal(isNewerVersion('', '0.1.36'), false)
  assert.equal(isNewerVersion('v0.1.37', 'build-abc'), true)
})

test('picks the APK asset and ignores the rest', () => {
  const apk = 'https://github.com/x/y/releases/download/v0.1.37/pixiAndroid-v0.1.37.apk'
  assert.equal(
    pickApkAsset([
      { name: 'source.zip', browser_download_url: 'https://x/source.zip' },
      { name: 'pixiAndroid-v0.1.37.apk', browser_download_url: apk },
    ]),
    apk,
  )
  // No APK (or no URL behind one) means no update to offer, not a crash.
  assert.equal(pickApkAsset([]), null)
  assert.equal(pickApkAsset([{ name: 'notes.md' }]), null)
  assert.equal(pickApkAsset([{ name: 'app.apk' }]), null)
})

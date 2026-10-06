/**
 * Release check for the in-app updater.
 *
 * The single source of truth is this repo's GitHub Releases: each tag carries
 * the built APK (`pixiAndroid-v0.1.36.apk`), and `versionName` in
 * `android/app/build.gradle` is what the installed app reports. So an update
 * exists exactly when the newest tag is numerically newer than the installed
 * version *and* that release actually has an APK attached.
 *
 * The comparison and the asset pick are pure on purpose — they are the two
 * decisions that decide whether the update button exists, and they are pinned
 * by `tests/updateVersion.test.ts` without a network.
 *
 * GitHub's API is public for a public repo, so no token, no auth header, and
 * no proxy: the app calls it directly. The check itself lives in
 * `src/hooks/useAppUpdate.ts`.
 */

export interface UpdateInfo {
  /** Newest release version, normalized without a leading "v" — "0.1.36". */
  version: string
  /** Direct APK download URL (the release's asset). */
  apkUrl: string
}

const RELEASES_URL = 'https://api.github.com/repos/pixiAnime/pixiAndroid/releases/latest'

interface ReleaseAsset {
  name?: unknown
  browser_download_url?: unknown
}

interface ReleasePayload {
  tag_name?: unknown
  assets?: unknown
}

/** Tags are written `v0.1.36`; `versionName` is `0.1.36`. One form, one truth. */
export function normalizeVersion(raw: string): string {
  return raw.trim().replace(/^v/i, '')
}

/**
 * Numeric release comparison, so `0.2` beats `0.1.36` and `0.1.9` does not —
 * string order would get both of those wrong. Missing segments count as zero,
 * and anything unparseable is zero rather than an exception: a malformed tag
 * must not be able to crash the header that renders on every screen.
 */
export function isNewerVersion(latest: string, current: string): boolean {
  const parts = normalizeVersion(latest).split('.')
  const installed = normalizeVersion(current).split('.')
  const length = Math.max(parts.length, installed.length)
  for (let index = 0; index < length; index += 1) {
    const incoming = parseSegment(parts[index])
    const local = parseSegment(installed[index])
    if (incoming !== local) return incoming > local
  }
  return false
}

function parseSegment(segment: string | undefined): number {
  const value = Number.parseInt(segment ?? '', 10)
  return Number.isFinite(value) ? value : 0
}

/** The release's APK asset — first entry GitHub calls an APK, if any. */
export function pickApkAsset(assets: ReleaseAsset[]): string | null {
  for (const asset of assets) {
    const name = typeof asset.name === 'string' ? asset.name.toLowerCase() : ''
    const url = typeof asset.browser_download_url === 'string' ? asset.browser_download_url : ''
    if (name.endsWith('.apk') && url.startsWith('http')) return url
  }
  return null
}

/**
 * The published APK newer than `current`, or `null` when there is nothing to
 * do (up to date, a tag without an APK, or a release whose asset never
 * finished uploading). Network and payload problems are thrown — the caller
 * decides that a failed check simply means "no button", never an error shown
 * over the header.
 */
export async function fetchLatestUpdate(
  current: string,
  signal?: AbortSignal,
): Promise<UpdateInfo | null> {
  const res = await fetch(RELEASES_URL, {
    signal,
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (!res.ok) throw new Error(`release check failed: ${res.status}`)

  const payload = (await res.json()) as ReleasePayload
  const version =
    typeof payload.tag_name === 'string' ? normalizeVersion(payload.tag_name) : ''
  const apkUrl = pickApkAsset(Array.isArray(payload.assets) ? payload.assets : [])
  if (!version || !apkUrl) return null

  return isNewerVersion(version, current) ? { version, apkUrl } : null
}

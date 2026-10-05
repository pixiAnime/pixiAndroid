/**
 * Repository manifest shapes — the CloudStream-style "one URL, many providers"
 * layer on top of the extension system.
 *
 * Mobile-owned: a repository is a JSON document listing extension module URLs.
 * It is NOT a synced pixiWeb file, and it never executes anything — every
 * provider it offers is still downloaded and validated by the existing
 * `inspectExtension` flow before it is installed.
 */

/** One provider a repository points at — an extension module URL + display metadata. */
export interface RepoProvider {
  /** Stable provider id (also the extension manifest id once installed). */
  id: string
  name: string
  author: string
  /** Dotted version, e.g. "1.1.0"; empty when the manifest does not say. */
  version: string
  /** Extension API version the provider targets ("1"). */
  apiVersion?: string
  description?: string
  /** https:// icon shown in the provider list. */
  icon?: string
  /** The extension module URL the installer fetches. */
  url: string
}

/** The parsed, validated repository manifest. */
export interface RepoManifest {
  name: string
  author?: string
  /** Repo manifest format version ("1"). */
  version?: string
  providers: RepoProvider[]
}

/** A repository the user has added — persisted record. */
export interface RepoRecord {
  /** The manifest URL itself (unique, stable). */
  id: string
  /** Canonical manifest URL — the refresh channel. */
  url: string
  manifest: RepoManifest
  addedAt: number
  updatedAt: number
}

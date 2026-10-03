/**
 * Route names and parameters for the stack navigator.
 *
 * The web maps these 1:1 onto URLs (see the `path` field on each screen):
 *
 * | screen          | web path              |
 * |-----------------|-----------------------|
 * | Home            | `/`                   |
 * | Browse          | `/browse?...`         |
 * | Search          | `/search?q=`          |
 * | AnimeDetail     | `/anime/:id`          |
 * | Watch           | `/watch/:id/:episode` |
 * | History         | `/history`            |
 * | MyList          | `/my-list`            |
 * | Extensions      | `/extensions`         |
 * | Settings        | `/settings`           |
 * | NotFound        | `*`                   |
 * | Dev             | (mobile-only M0 spikes, `__DEV__` only)
 *
 * There are no guards on the web either — every route is reachable directly.
 */
export type RootStackParamList = {
  Home: undefined
  /**
   * Browse is query-string state on the web
   * (`?genres=&type=&status=&season=&year=&rating=&order_by=&sort=&page=`),
   * so its params mirror that exactly — that's what makes "View all →"
   * deep-links from Home behave identically on both platforms.
   */
  Browse:
    | {
        genres?: string
        type?: string
        status?: string
        season?: string
        year?: string
        rating?: string
        order_by?: string
        sort?: string
        page?: number
        q?: string
      }
    | undefined
  Search: { q?: string } | undefined
  AnimeDetail: { malId: number }
  Watch: { malId: number; episode: number }
  History: undefined
  MyList: undefined
  Extensions: undefined
  Settings: undefined
  NotFound: undefined
  Dev: undefined
}

export type RootRouteName = keyof RootStackParamList

/** Declaration merging for the typed `navigation` prop inside screens. */
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

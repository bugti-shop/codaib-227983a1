/**
 * Route prefetching — preloads lazy route chunks on hover/touch/idle.
 * Maps route paths to their dynamic import() so the chunk loads before navigation.
 */

const prefetchedRoutes = new Set<string>();
const prefetchPromises = new Map<string, Promise<void>>();

const ROUTE_IMPORTS: Record<string, () => Promise<any>> = {
  '/notes': () => import('@/pages/Notes'),
  '/notesdashboard': () => import('@/pages/Index'),
  '/calendar': () => import('@/pages/NotesCalendar'),
  '/profile': () => import('@/pages/Profile'),
  '/settings': () => import('@/pages/Settings'),
  '/todo/today': () => import('@/pages/todo/Today'),
  '/todo/progress': () => import('@/pages/todo/Progress'),
  '/todo/calendar': () => import('@/pages/todo/TodoCalendar'),
  '/todo/settings': () => import('@/pages/todo/TodoSettings'),
  '/': () => import('@/pages/todo/Today'),
};

/** Prefetch a single route chunk (idempotent, no-op if already loaded) */
export function prefetchRoute(path: string): Promise<void> {
  if (prefetchedRoutes.has(path)) return Promise.resolve();
  const existingPromise = prefetchPromises.get(path);
  if (existingPromise) return existingPromise;
  const loader = ROUTE_IMPORTS[path];
  if (!loader) return Promise.resolve();

  const promise = loader()
    .then(() => {
      prefetchedRoutes.add(path);
      prefetchPromises.delete(path);
    })
    .catch(() => {
      prefetchPromises.delete(path);
      prefetchedRoutes.delete(path);
    });

  prefetchPromises.set(path, promise);
  return promise;
}

/** Prefetch all lazy routes — bottom nav tabs immediately, rest on idle */
export function prefetchAllOnIdle(): void {
  // Prefetch bottom-nav tabs immediately for instant switching
  const bottomNavRoutes = ['/notes', '/notesdashboard', '/profile', '/settings', '/calendar'];
  bottomNavRoutes.forEach((path) => {
    void prefetchRoute(path);
  });

  // Prefetch remaining routes on idle
  const prefetchRest = () => {
    Object.keys(ROUTE_IMPORTS).forEach((path) => {
      void prefetchRoute(path);
    });
  };

  if ('requestIdleCallback' in window) {
    requestIdleCallback(prefetchRest, { timeout: 5000 });
  } else {
    setTimeout(prefetchRest, 1500);
  }
}

/** onPointerEnter / onTouchStart handler factory for nav items */
export function createPrefetchHandler(path: string) {
  return () => prefetchRoute(path);
}

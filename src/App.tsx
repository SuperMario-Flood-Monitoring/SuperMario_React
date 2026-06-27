import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import {
  getInitialAppSurface,
  subscribeAppSurfaceChange,
  type AppSurface,
} from './app/deviceSurface'
import { loginWithPassword, logoutFromServer } from './services/auth/authApi'
import {
  clearAuthState,
  loadAuthSession,
  setAuthFailureHandler,
  type AuthSession,
} from './services/auth/authState'

const MobileDrainageWorkbench = lazy(() => import('./mobile/layout/DrainageWorkbench').then((module) => ({
  default: module.DrainageWorkbench,
})))
const MobileLoginPage = lazy(() => import('./mobile/auth/LoginPage').then((module) => ({
  default: module.LoginPage,
})))
const WebDrainageWorkbench = lazy(() => import('./web/layout/DrainageWorkbench').then((module) => ({
  default: module.DrainageWorkbench,
})))
const WebLoginPage = lazy(() => import('./web/auth/LoginPage').then((module) => ({
  default: module.LoginPage,
})))

type WorkbenchMode = 'simulation' | 'editor'
type AppRoute = 'login' | WorkbenchMode | 'simulationFullscreen'
const ROUTE_PATHS: Record<AppRoute, string> = {
  login: '/login',
  simulation: '/simulation',
  simulationFullscreen: '/simulation/fullscreen',
  editor: '/editor',
}

function routeUsesBrowserFullscreen(route: AppRoute) {
  return route === 'editor' || route === 'simulationFullscreen'
}

function requestBrowserFullscreen() {
  if (typeof document === 'undefined') {
    return
  }

  if (!document.fullscreenEnabled || document.fullscreenElement) {
    return
  }

  document.documentElement.requestFullscreen().catch(() => undefined)
}

function exitBrowserFullscreen() {
  if (typeof document === 'undefined') {
    return
  }

  if (!document.fullscreenElement) {
    return
  }

  document.exitFullscreen().catch(() => undefined)
}

function syncBrowserFullscreenForRoute(route: AppRoute) {
  if (routeUsesBrowserFullscreen(route)) {
    requestBrowserFullscreen()
    return
  }

  exitBrowserFullscreen()
}

function routeFromPathname(pathname: string): AppRoute {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/'

  if (normalizedPath === ROUTE_PATHS.editor) {
    return 'editor'
  }

  if (normalizedPath === ROUTE_PATHS.simulation) {
    return 'simulation'
  }

  if (normalizedPath === ROUTE_PATHS.simulationFullscreen) {
    return 'simulationFullscreen'
  }

  return 'login'
}

function getInitialRoute() {
  const initialRoute = routeFromPathname(window.location.pathname)
  return loadAuthSession() && initialRoute === 'login' ? 'simulation' : initialRoute
}

function App() {
  const [route, setRoute] = useState<AppRoute>(() => getInitialRoute())
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => loadAuthSession())
  const [surface, setSurface] = useState<AppSurface>(() => getInitialAppSurface())

  const navigate = useCallback((nextRoute: AppRoute, options?: { replace?: boolean }) => {
    const nextPath = ROUTE_PATHS[nextRoute]
    const shouldReplace = options?.replace ?? false

    if (window.location.pathname !== nextPath) {
      if (shouldReplace) {
        window.history.replaceState({ route: nextRoute }, '', nextPath)
      } else {
        window.history.pushState({ route: nextRoute }, '', nextPath)
      }
    }

    setRoute(nextRoute)
    syncBrowserFullscreenForRoute(nextRoute)
  }, [])

  useEffect(() => {
    return subscribeAppSurfaceChange(setSurface)
  }, [])

  useEffect(() => {
    const syncRouteFromHistory = () => {
      const nextRoute = routeFromPathname(window.location.pathname)

      if (authSession && nextRoute === 'login') {
        window.history.replaceState({ route: 'simulation' }, '', ROUTE_PATHS.simulation)
        setRoute('simulation')
        syncBrowserFullscreenForRoute('simulation')
        return
      }

      setRoute(nextRoute)
      syncBrowserFullscreenForRoute(nextRoute)
    }

    window.addEventListener('popstate', syncRouteFromHistory)
    return () => window.removeEventListener('popstate', syncRouteFromHistory)
  }, [authSession])

  useEffect(() => {
    const syncRouteFromBrowserFullscreen = () => {
      if (!document.fullscreenElement && route === 'simulationFullscreen') {
        navigate('simulation', { replace: true })
      }
    }

    document.addEventListener('fullscreenchange', syncRouteFromBrowserFullscreen)
    return () => document.removeEventListener('fullscreenchange', syncRouteFromBrowserFullscreen)
  }, [navigate, route])

  useEffect(() => {
    return setAuthFailureHandler(() => {
      setAuthSession(null)
      navigate('login', { replace: true })
    })
  }, [navigate])

  useEffect(() => {
    if (authSession && route === 'simulation' && window.location.pathname === ROUTE_PATHS.login) {
      window.history.replaceState({ route: 'simulation' }, '', ROUTE_PATHS.simulation)
    }
  }, [authSession, route])

  const handleLogin = async (username: string, password: string) => {
    const nextSession = await loginWithPassword(username, password)
    setAuthSession(nextSession)
    navigate('simulation', { replace: true })
  }

  const handleLogout = () => {
    logoutFromServer().catch(() => clearAuthState({ clearRefreshCookies: true }))
    setAuthSession(null)
    navigate('login', { replace: true })
  }

  const LoginPage = surface === 'mobile' ? MobileLoginPage : WebLoginPage
  const DrainageWorkbench = surface === 'mobile' ? MobileDrainageWorkbench : WebDrainageWorkbench

  if (!authSession) {
    return (
      <Suspense fallback={null}>
        <LoginPage onLogin={handleLogin} />
      </Suspense>
    )
  }

  return (
    <Suspense fallback={null}>
      <DrainageWorkbench
        mode={route === 'editor' ? 'editor' : 'simulation'}
        onModeChange={(nextMode) => navigate(nextMode)}
        simulationFullscreenActive={route === 'simulationFullscreen'}
        onSimulationFullscreenChange={(active) => navigate(
          active ? 'simulationFullscreen' : 'simulation',
          active ? undefined : { replace: true },
        )}
        onLogout={handleLogout}
      />
    </Suspense>
  )
}

export default App

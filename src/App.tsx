import { DrainageWorkbench } from './components/layout/DrainageWorkbench'
import type { WorkbenchMode } from './components/layout/DrainageWorkbench'
import { LoginPage } from './components/auth/LoginPage'
import { useCallback, useEffect, useState } from 'react'
import { loginWithPassword, logoutFromServer } from './services/auth/authApi'
import {
  clearAuthState,
  loadAuthSession,
  setAuthFailureHandler,
  type AuthSession,
} from './services/auth/authState'

type AppRoute = 'login' | WorkbenchMode
const ROUTE_PATHS: Record<AppRoute, string> = {
  login: '/login',
  simulation: '/simulation',
  editor: '/editor',
}

function routeFromPathname(pathname: string): AppRoute {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/'

  if (normalizedPath === ROUTE_PATHS.editor) {
    return 'editor'
  }

  if (normalizedPath === ROUTE_PATHS.simulation) {
    return 'simulation'
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
  }, [])

  useEffect(() => {
    const syncRouteFromHistory = () => {
      const nextRoute = routeFromPathname(window.location.pathname)

      if (authSession && nextRoute === 'login') {
        window.history.replaceState({ route: 'simulation' }, '', ROUTE_PATHS.simulation)
        setRoute('simulation')
        return
      }

      setRoute(nextRoute)
    }

    window.addEventListener('popstate', syncRouteFromHistory)
    return () => window.removeEventListener('popstate', syncRouteFromHistory)
  }, [authSession])

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

  if (!authSession) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <DrainageWorkbench
      mode={route === 'editor' ? 'editor' : 'simulation'}
      onModeChange={(nextMode) => navigate(nextMode)}
      onLogout={handleLogout}
    />
  )
}

export default App

import { useEffect, useState } from 'react'
import { isAdmin, isLoggedIn, logout } from './api'
import { Link, navigate, usePath } from './nav'
import AdminPage from './pages/Admin'
import AuthForm from './pages/Auth'
import CabinetPage from './pages/Cabinet'
import OwnTobaccosPage from './pages/OwnTobaccos'
import RoulettePage from './pages/Roulette'
import { HeaderActions, MenuDrawer, Toast } from './shell'

function App() {
  const path = usePath()
  const [auth, setAuth] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [toast, setToast] = useState('')
  const loggedIn = isLoggedIn()
  const admin = isAdmin()
  const refreshAuth = () => setAuth((value) => value + 1)

  useEffect(() => {
    if (!toast) {
      return
    }
    const timer = window.setTimeout(() => setToast(''), 2200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        setFiltersOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function closeOverlays() {
    setMenuOpen(false)
    setFiltersOpen(false)
  }

  function handleFilters() {
    if (path !== '/') {
      navigate('/')
      return
    }
    setFiltersOpen((open) => !open)
    setMenuOpen(false)
  }

  function handleLogout() {
    logout()
    refreshAuth()
    navigate('/')
  }

  let page = (
    <RoulettePage
      loggedIn={loggedIn}
      filtersOpen={filtersOpen}
      onFiltersOpenChange={setFiltersOpen}
      onToast={setToast}
    />
  )
  if (path === '/login' || path === '/register') {
    page = (
      <AuthForm
        mode={path === '/register' ? 'register' : 'login'}
        onAuthed={refreshAuth}
      />
    )
  } else if (path === '/cabinet') {
    page = <CabinetPage />
  } else if (path === '/own') {
    page = <OwnTobaccosPage />
  } else if (path === '/admin') {
    page = <AdminPage />
  }

  return (
    <div className="stage" data-auth={auth} data-filters-open={filtersOpen || undefined}>
      <div className="phone">
        <header className="topnav">
          <Link href="/" className="logo">
            Забивка
          </Link>
          <HeaderActions onFilters={handleFilters} onMenu={() => setMenuOpen(true)} />
        </header>
        <main>{page}</main>
        <button
          type="button"
          className={`scrim${menuOpen ? ' is-on' : ''}`}
          aria-hidden={!menuOpen}
          tabIndex={menuOpen ? 0 : -1}
          onClick={closeOverlays}
        />
        <MenuDrawer
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          loggedIn={loggedIn}
          admin={admin}
          onFilters={handleFilters}
          onLogout={handleLogout}
        />
        <Toast message={toast} />
      </div>
    </div>
  )
}

export default App

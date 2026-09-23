import { useState } from 'react'
import { isAdmin, isLoggedIn, logout } from './api'
import { Link, navigate, usePath } from './nav'
import AdminPage from './pages/Admin'
import AuthForm from './pages/Auth'
import CabinetPage from './pages/Cabinet'
import RoulettePage from './pages/Roulette'

function App() {
  const path = usePath()
  const [auth, setAuth] = useState(0)
  const loggedIn = isLoggedIn()
  const admin = isAdmin()
  const refreshAuth = () => setAuth((value) => value + 1)

  return (
    <div className="page" data-auth={auth}>
      <header className="top">
        <Link href="/">Забивка</Link>
        <nav>
          <Link href="/">Рулетка</Link>
          {loggedIn ? (
            <>
              <Link href="/cabinet">Кабинет</Link>
              {admin ? <Link href="/admin">Админка</Link> : null}
              <button
                type="button"
                onClick={() => {
                  logout()
                  refreshAuth()
                  navigate('/')
                }}
              >
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link href="/login">Вход</Link>
              <Link href="/register">Регистрация</Link>
            </>
          )}
        </nav>
      </header>
      <main>
        {path === '/login' ? (
          <AuthForm mode="login" onAuthed={refreshAuth} />
        ) : path === '/register' ? (
          <AuthForm mode="register" onAuthed={refreshAuth} />
        ) : path === '/cabinet' ? (
          <CabinetPage />
        ) : path === '/admin' ? (
          <AdminPage />
        ) : (
          <RoulettePage loggedIn={loggedIn} />
        )}
      </main>
    </div>
  )
}

export default App

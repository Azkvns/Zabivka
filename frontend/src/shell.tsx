import { navigate } from './nav'

function FiltersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M5 7h14M5 12h14M5 17h14" />
    </svg>
  )
}

export function HeaderActions({
  onFilters,
  onMenu,
}: {
  onFilters: () => void
  onMenu: () => void
}) {
  return (
    <div className="row">
      <button type="button" className="icon-btn" aria-label="Фильтры" onClick={onFilters}>
        <FiltersIcon />
      </button>
      <button type="button" className="icon-btn" aria-label="Меню" onClick={onMenu}>
        <MenuIcon />
      </button>
    </div>
  )
}

export function MenuDrawer({
  open,
  onClose,
  loggedIn,
  admin,
  onFilters,
  onLogout,
}: {
  open: boolean
  onClose: () => void
  loggedIn: boolean
  admin: boolean
  onFilters: () => void
  onLogout: () => void
}) {
  function go(path: string) {
    navigate(path)
    onClose()
  }

  function shelfPath() {
    go(loggedIn ? '/cabinet' : '/login')
  }

  function ownPath() {
    go(loggedIn ? '/own' : '/login')
  }

  return (
    <nav
      className={`menu-drawer${open ? ' is-open' : ''}`}
      aria-label="Разделы"
      aria-hidden={!open}
    >
      <div className="row-between">
        <h2>Меню</h2>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Закрыть
        </button>
      </div>
      <button type="button" className="menu-link" onClick={() => go('/')}>
        Рулетка
      </button>
      <button
        type="button"
        className="menu-link"
        onClick={() => {
          onFilters()
          onClose()
        }}
      >
        Фильтры
      </button>
      <button type="button" className="menu-link" onClick={shelfPath}>
        Моя полка
      </button>
      <button type="button" className="menu-link" onClick={ownPath}>
        Свои табаки
      </button>
      {admin ? (
        <button type="button" className="menu-link" onClick={() => go('/admin')}>
          Админка
        </button>
      ) : null}
      {loggedIn ? (
        <button
          type="button"
          className="menu-link"
          onClick={() => {
            onLogout()
            onClose()
          }}
        >
          Выйти
        </button>
      ) : (
        <button type="button" className="menu-link" onClick={() => go('/login')}>
          Вход / регистрация
        </button>
      )}
      <p className="meta" style={{ marginTop: 'auto' }}>
        {loggedIn ? 'Вы вошли' : 'Гость · каталог открыт'}
      </p>
    </nav>
  )
}

export function Toast({ message }: { message: string }) {
  return (
    <div className={`toast${message ? ' is-on' : ''}`} role="status">
      {message}
    </div>
  )
}

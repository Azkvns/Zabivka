import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  ApiError,
  type Mix,
  type Source,
  type SpinMode,
  type SpinResult,
  type Tobacco,
  type TobaccoIn,
  clearCatalog,
  createAdminTobacco,
  createShelf,
  deleteShelf,
  importCatalog,
  isAdmin,
  isLoggedIn,
  listMixes,
  listTobaccos,
  login,
  logout,
  patchMix,
  patchShelf,
  register,
  saveMix,
  spin,
} from './api'

const FLAVORS = [
  'ягоды',
  'цитрус',
  'фрукты',
  'десерт',
  'мята',
  'специи',
  'напитки',
  'классика',
  'холодок',
] as const

const STRENGTHS = ['лёгкая', 'средняя', 'крепкая'] as const

const MODES: { value: SpinMode; label: string }[] = [
  { value: 'random', label: 'Случайно' },
  { value: 'different_flavors', label: 'Разные вкусы' },
  { value: 'softer', label: 'Мягче' },
  { value: 'stronger', label: 'Крепче' },
]

function navigate(path: string): void {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function usePath(): string {
  const [path, setPath] = useState(window.location.pathname)
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  return path
}

function Link({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault()
        navigate(href)
      }}
    >
      {children}
    </a>
  )
}

function emptyTobacco(): TobaccoIn {
  return { brand: '', name: '', strength: 'средняя', flavors: ['мята'] }
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'ошибка запроса'
}

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

function RoulettePage({ loggedIn }: { loggedIn: boolean }) {
  const [count, setCount] = useState<2 | 3 | 4>(2)
  const [brand, setBrand] = useState('')
  const [flavor, setFlavor] = useState('')
  const [strength, setStrength] = useState('')
  const [source, setSource] = useState<Source>('catalog')
  const [mode, setMode] = useState<SpinMode>('random')
  const [result, setResult] = useState<SpinResult | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSpin(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSaved('')
    setResult(null)
    setBusy(true)
    try {
      const out = await spin({
        count,
        mode,
        brand: brand.trim() || null,
        flavor: flavor || null,
        strength: strength || null,
        source: loggedIn ? source : 'catalog',
      })
      setResult(out)
    } catch (err) {
      setError(messageFrom(err))
    } finally {
      setBusy(false)
    }
  }

  async function onSave() {
    if (!result) {
      return
    }
    setBusy(true)
    setError('')
    try {
      await saveMix(result.mode as SpinMode, result.items.map((item) => item.id))
      setSaved('Смесь сохранена')
    } catch (err) {
      setError(messageFrom(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h1>Рулетка</h1>
      <form className="card" onSubmit={onSpin}>
        <fieldset>
          <legend>Число</legend>
          {([2, 3, 4] as const).map((value) => (
            <label key={value}>
              <input
                type="radio"
                name="count"
                value={value}
                checked={count === value}
                onChange={() => setCount(value)}
              />
              {value}
            </label>
          ))}
        </fieldset>
        <label>
          Бренд
          <input value={brand} onChange={(event) => setBrand(event.target.value)} />
        </label>
        <label>
          Вкус
          <select value={flavor} onChange={(event) => setFlavor(event.target.value)}>
            <option value="">любой</option>
            {FLAVORS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          Крепость
          <select value={strength} onChange={(event) => setStrength(event.target.value)}>
            <option value="">любая</option>
            {STRENGTHS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        {loggedIn ? (
          <label>
            Источник
            <select
              value={source}
              onChange={(event) => setSource(event.target.value as Source)}
            >
              <option value="catalog">каталог</option>
              <option value="both">каталог и полка</option>
              <option value="shelf">полка</option>
            </select>
          </label>
        ) : null}
        <label>
          Режим
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as SpinMode)}
          >
            {MODES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={busy}>
          Крутить
        </button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {result ? (
        <div className="card">
          <ul aria-label="Состав">
            {result.items.map((item) => (
              <li key={item.id}>
                {item.brand} — {item.name}
                <span className="muted">
                  {' '}
                  {item.strength}, {item.flavors.join(', ')}
                </span>
              </li>
            ))}
          </ul>
          {loggedIn ? (
            <button type="button" onClick={onSave} disabled={busy}>
              Сохранить
            </button>
          ) : null}
          {saved ? <p>{saved}</p> : null}
        </div>
      ) : null}
    </section>
  )
}

function AuthForm({
  mode,
  onAuthed,
}: {
  mode: 'login' | 'register'
  onAuthed: () => void
}) {
  const [loginName, setLoginName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'register') {
        await register(loginName, password)
      }
      await login(loginName, password)
      onAuthed()
      navigate('/')
    } catch (err) {
      setError(messageFrom(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h1>{mode === 'login' ? 'Вход' : 'Регистрация'}</h1>
      <form className="card" onSubmit={onSubmit}>
        <label>
          Логин
          <input
            value={loginName}
            autoComplete="username"
            onChange={(event) => setLoginName(event.target.value)}
          />
        </label>
        <label>
          Пароль
          <input
            type="password"
            value={password}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button type="submit" disabled={busy}>
          {mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
        </button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      <p>
        {mode === 'login' ? (
          <Link href="/register">Регистрация</Link>
        ) : (
          <Link href="/login">Вход</Link>
        )}
      </p>
    </section>
  )
}

function CabinetPage() {
  const [mixes, setMixes] = useState<Mix[]>([])
  const [shelf, setShelf] = useState<Tobacco[]>([])
  const [error, setError] = useState('')
  const [form, setForm] = useState<TobaccoIn>(emptyTobacco)
  const [editingId, setEditingId] = useState<number | null>(null)

  async function reload() {
    const [mixRows, shelfRows] = await Promise.all([
      listMixes(),
      listTobaccos({ source: 'shelf' }),
    ])
    setMixes(mixRows)
    setShelf(shelfRows)
  }

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/login')
      return
    }
    reload().catch((err) => {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/login')
        return
      }
      setError(messageFrom(err))
    })
  }, [])

  async function onSaveMixMeta(mix: Mix, note: string, rating: number | null) {
    try {
      const updated = await patchMix(mix.id, { note, rating })
      setMixes((rows) => rows.map((row) => (row.id === updated.id ? updated : row)))
    } catch (err) {
      setError(messageFrom(err))
    }
  }

  async function onShelfSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      if (editingId === null) {
        await createShelf(form)
      } else {
        await patchShelf(editingId, form)
      }
      setForm(emptyTobacco())
      setEditingId(null)
      await reload()
    } catch (err) {
      setError(messageFrom(err))
    }
  }

  async function onDelete(id: number) {
    setError('')
    try {
      await deleteShelf(id)
      await reload()
    } catch (err) {
      setError(messageFrom(err))
    }
  }

  return (
    <section>
      <h1>Кабинет</h1>
      {error ? <p className="error">{error}</p> : null}
      <h2>История</h2>
      {mixes.length === 0 ? <p className="muted">Пока нет сохранённых смесей</p> : null}
      {mixes.map((mix) => (
        <MixCard key={mix.id} mix={mix} onSave={onSaveMixMeta} />
      ))}
      <h2>Полка</h2>
      <ul>
        {shelf.map((item) => (
          <li key={item.id}>
            {item.brand} — {item.name} ({item.strength}, {item.flavors.join(', ')})
            {item.retired ? <span> снят с каталога</span> : null}
            <button
              type="button"
              onClick={() => {
                setEditingId(item.id)
                setForm({
                  brand: item.brand,
                  name: item.name,
                  strength: item.strength,
                  flavors: item.flavors,
                })
              }}
            >
              Править
            </button>
            <button type="button" onClick={() => onDelete(item.id)}>
              Удалить
            </button>
          </li>
        ))}
      </ul>
      <TobaccoForm
        title={editingId === null ? 'Добавить на полку' : 'Править табак'}
        value={form}
        onChange={setForm}
        onSubmit={onShelfSubmit}
        submitLabel={editingId === null ? 'Добавить' : 'Сохранить правку'}
      />
    </section>
  )
}

function MixCard({
  mix,
  onSave,
}: {
  mix: Mix
  onSave: (mix: Mix, note: string, rating: number | null) => Promise<void>
}) {
  const [note, setNote] = useState(mix.note ?? '')
  const [rating, setRating] = useState(mix.rating ? String(mix.rating) : '')

  return (
    <article className="card">
      <p>
        {mix.mode}, {mix.size} табака
      </p>
      <ul>
        {mix.items.map((item) => (
          <li key={`${mix.id}-${item.position}`}>
            {item.name}
            {item.retired ? ' — снят с каталога' : ''}
          </li>
        ))}
      </ul>
      <label>
        Заметка
        <input value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <label>
        Оценка
        <select value={rating} onChange={(event) => setRating(event.target.value)}>
          <option value="">нет</option>
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => onSave(mix, note, rating === '' ? null : Number(rating))}
      >
        Записать оценку
      </button>
    </article>
  )
}

function AdminPage() {
  const admin = isAdmin()
  const [rows, setRows] = useState<Tobacco[]>([])
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [form, setForm] = useState<TobaccoIn>(emptyTobacco)

  async function reload() {
    setRows(await listTobaccos({ include_retired: true }))
  }

  useEffect(() => {
    if (!admin) {
      return
    }
    reload().catch((err) => setError(messageFrom(err)))
  }, [admin])

  if (!admin) {
    return (
      <section>
        <h1>Админка</h1>
        <p className="muted">Недостаточно прав для действий с каталогом.</p>
      </section>
    )
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      await createAdminTobacco(form)
      setForm(emptyTobacco())
      await reload()
    } catch (err) {
      setError(messageFrom(err))
    }
  }

  async function onClear() {
    if (!window.confirm('Снять общие табаки с каталога?')) {
      return
    }
    setError('')
    try {
      const count = await clearCatalog()
      setInfo(`Снято: ${count}`)
      await reload()
    } catch (err) {
      setError(messageFrom(err))
    }
  }

  async function onImport(file: File | undefined) {
    if (!file) {
      return
    }
    setError('')
    setInfo('')
    try {
      const out = await importCatalog(file)
      setInfo(`Импортировано: ${out.imported}`)
      await reload()
    } catch (err) {
      if (err instanceof ApiError && err.line !== undefined) {
        setError(`Строка ${err.line}: ${err.message}`)
      } else {
        setError(messageFrom(err))
      }
    }
  }

  return (
    <section>
      <h1>Админка</h1>
      {error ? <p className="error">{error}</p> : null}
      {info ? <p>{info}</p> : null}
      <ul>
        {rows.map((item) => (
          <li key={item.id}>
            {item.brand} — {item.name} ({item.strength}, {item.flavors.join(', ')})
            {item.retired ? ' — снят с каталога' : ''}
          </li>
        ))}
      </ul>
      <TobaccoForm
        title="Новый общий табак"
        value={form}
        onChange={setForm}
        onSubmit={onCreate}
        submitLabel="Добавить в каталог"
      />
      <div className="card">
        <button type="button" onClick={onClear}>
          Очистить каталог
        </button>
        <label>
          CSV
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => onImport(event.target.files?.[0])}
          />
        </label>
      </div>
    </section>
  )
}

function TobaccoForm({
  title,
  value,
  onChange,
  onSubmit,
  submitLabel,
}: {
  title: string
  value: TobaccoIn
  onChange: (next: TobaccoIn) => void
  onSubmit: (event: FormEvent) => void
  submitLabel: string
}) {
  function toggleFlavor(flavor: string) {
    const has = value.flavors.includes(flavor)
    onChange({
      ...value,
      flavors: has ? value.flavors.filter((item) => item !== flavor) : [...value.flavors, flavor],
    })
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      <h3>{title}</h3>
      <label>
        Бренд
        <input
          value={value.brand}
          onChange={(event) => onChange({ ...value, brand: event.target.value })}
        />
      </label>
      <label>
        Название
        <input
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
        />
      </label>
      <label>
        Крепость
        <select
          value={value.strength}
          onChange={(event) => onChange({ ...value, strength: event.target.value })}
        >
          {STRENGTHS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>Вкусы</legend>
        {FLAVORS.map((flavor) => (
          <label key={flavor}>
            <input
              type="checkbox"
              checked={value.flavors.includes(flavor)}
              onChange={() => toggleFlavor(flavor)}
            />
            {flavor}
          </label>
        ))}
      </fieldset>
      <button type="submit">{submitLabel}</button>
    </form>
  )
}

export default App

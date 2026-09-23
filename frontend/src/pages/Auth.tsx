import { useState, type FormEvent } from 'react'
import { login, register } from '../api'
import { Link, navigate } from '../nav'
import { messageFrom } from './shared'

export default function AuthForm({
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
    <section className="stack" aria-labelledby="auth-title">
      <div>
        <h1 id="auth-title">Войди, чтобы копить полку</h1>
        <p className="lead">Гость крутит каталог. Сохранённые смеси живут после входа.</p>
      </div>
      <div className="tabs" role="tablist" aria-label="Режим входа">
        <button
          type="button"
          role="tab"
          className={mode === 'login' ? 'tab is-on' : 'tab'}
          aria-selected={mode === 'login'}
          onClick={() => navigate('/login')}
        >
          Вход
        </button>
        <button
          type="button"
          role="tab"
          className={mode === 'register' ? 'tab is-on' : 'tab'}
          aria-selected={mode === 'register'}
          onClick={() => navigate('/register')}
        >
          Регистрация
        </button>
      </div>
      <form className="stack card" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="auth-login">Логин</label>
          <input
            id="auth-login"
            className="input"
            value={loginName}
            autoComplete="username"
            onChange={(event) => setLoginName(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="auth-pass">Пароль</label>
          <input
            id="auth-pass"
            className="input"
            type="password"
            value={password}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <p className="meta">Логин и пароль уходят на сервер.</p>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
        </button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      <Link href="/" className="btn btn-ghost">
        ← К рулетке
      </Link>
    </section>
  )
}

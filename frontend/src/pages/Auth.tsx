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

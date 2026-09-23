import { useState, type FormEvent } from 'react'
import { type Source, type SpinMode, type SpinResult, saveMix, spin } from '../api'
import { FLAVORS, STRENGTHS, messageFrom } from './shared'

const MODES: { value: SpinMode; label: string }[] = [
  { value: 'random', label: 'Случайно' },
  { value: 'different_flavors', label: 'Разные вкусы' },
  { value: 'softer', label: 'Мягче' },
  { value: 'stronger', label: 'Крепче' },
]

export default function RoulettePage({ loggedIn }: { loggedIn: boolean }) {
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

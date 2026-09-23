import { useEffect, useState, type FormEvent } from 'react'
import {
  ApiError,
  type Tobacco,
  type TobaccoIn,
  clearCatalog,
  createAdminTobacco,
  importCatalog,
  isAdmin,
  listTobaccos,
} from '../api'
import { TobaccoForm, emptyTobacco, messageFrom } from './shared'

export default function AdminPage() {
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
      <section className="stack" aria-labelledby="admin-title">
        <h1 id="admin-title">Админка</h1>
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
    <section className="stack" aria-labelledby="admin-title">
      <h1 id="admin-title">Админка</h1>
      {error ? <p className="error">{error}</p> : null}
      {info ? <p className="meta">{info}</p> : null}
      <article className="card">
        <ul>
          {rows.map((item) => (
            <li key={item.id}>
              {item.brand} — {item.name} ({item.strength}, {item.flavors.join(', ')})
              {item.retired ? ' — снят с каталога' : ''}
            </li>
          ))}
        </ul>
      </article>
      <TobaccoForm
        title="Новый общий табак"
        value={form}
        onChange={setForm}
        onSubmit={onCreate}
        submitLabel="Добавить в каталог"
      />
      <div className="card stack">
        <button type="button" className="btn btn-secondary" onClick={onClear}>
          Очистить каталог
        </button>
        <div className="field">
          <label htmlFor="admin-csv-import">CSV</label>
          <input
            id="admin-csv-import"
            className="input"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => onImport(event.target.files?.[0])}
          />
        </div>
      </div>
    </section>
  )
}

import { useEffect, useState, type FormEvent } from 'react'
import {
  ApiError,
  type Tobacco,
  type TobaccoIn,
  createShelf,
  deleteShelf,
  isLoggedIn,
  listTobaccos,
  patchShelf,
} from '../api'
import { navigate } from '../nav'
import { TobaccoForm, emptyTobacco, messageFrom } from './shared'

export default function OwnTobaccosPage() {
  const [shelf, setShelf] = useState<Tobacco[]>([])
  const [error, setError] = useState('')
  const [form, setForm] = useState<TobaccoIn>(emptyTobacco)
  const [editingId, setEditingId] = useState<number | null>(null)

  async function reload() {
    const shelfRows = await listTobaccos({ source: 'shelf' })
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
    <section className="stack" aria-labelledby="own-title">
      <h1 id="own-title">Свои табаки</h1>
      {error ? <p className="error">{error}</p> : null}
      <article className="card">
        <ul>
          {shelf.map((item) => (
            <li key={item.id}>
              {item.brand} — {item.name} ({item.strength}, {item.flavors.join(', ')})
              {item.retired ? <span> снят с каталога</span> : null}
              <button
                type="button"
                className="btn btn-secondary"
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
              <button type="button" className="btn btn-secondary" onClick={() => onDelete(item.id)}>
                Удалить
              </button>
            </li>
          ))}
        </ul>
      </article>
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

import { useEffect, useState, type FormEvent } from 'react'
import {
  ApiError,
  type Mix,
  type Tobacco,
  type TobaccoIn,
  createShelf,
  deleteShelf,
  isLoggedIn,
  listMixes,
  listTobaccos,
  patchMix,
  patchShelf,
} from '../api'
import { navigate } from '../nav'
import { TobaccoForm, emptyTobacco, messageFrom } from './shared'

export default function CabinetPage() {
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

import { useEffect, useMemo, useState } from 'react'
import {
  ApiError,
  type Mix,
  type Tobacco,
  isLoggedIn,
  listMixes,
  listTobaccos,
  patchMix,
} from '../api'
import {
  formatMixCreatedAt,
  mixHeadingNames,
  mixItemComposition,
  tobaccoByIdFrom,
} from '../mixDisplay'
import { navigate } from '../nav'
import { messageFrom } from './shared'

export default function CabinetPage() {
  const [mixes, setMixes] = useState<Mix[]>([])
  const [tobaccos, setTobaccos] = useState<Tobacco[]>([])
  const [error, setError] = useState('')

  const tobaccoMap = useMemo(() => tobaccoByIdFrom(tobaccos), [tobaccos])

  async function reload() {
    const [mixRows, tobaccoRows] = await Promise.all([
      listMixes(),
      listTobaccos({ source: 'both' }),
    ])
    setMixes(mixRows)
    setTobaccos(tobaccoRows)
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

  return (
    <section className="stack" aria-labelledby="shelf-title">
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div>
          <p className="eyebrow">Кабинет</p>
          <h1 id="shelf-title">Моя полка</h1>
        </div>
        <span className="meta">{mixes.length}</span>
      </div>
      <p className="lead">Сохранённые смеси из рулетки.</p>
      {error ? <p className="error">{error}</p> : null}
      {mixes.length === 0 ? (
        <div className="shelf-empty card">
          <p>Пока пусто.</p>
          <p className="meta" style={{ marginTop: 8 }}>
            Крутани рулетку и сохрани на полку.
          </p>
        </div>
      ) : (
        mixes.map((mix) => (
          <MixCard
            key={mix.id}
            mix={mix}
            tobaccoById={tobaccoMap}
            onSave={onSaveMixMeta}
          />
        ))
      )}
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
          Крутить ещё
        </button>
      </div>
    </section>
  )
}

function MixCard({
  mix,
  tobaccoById,
  onSave,
}: {
  mix: Mix
  tobaccoById: ReadonlyMap<number, Tobacco>
  onSave: (mix: Mix, note: string, rating: number | null) => Promise<void>
}) {
  const [note, setNote] = useState(mix.note ?? '')
  const [rating, setRating] = useState(mix.rating ? String(mix.rating) : '')

  return (
    <article className="card shelf-card">
      <div className="row-between">
        <strong>{mixHeadingNames(mix.items)}</strong>
        <span className="pill">{mix.size}</span>
      </div>
      <ul style={{ listStyle: 'none', padding: '8px 0 0', margin: 0 }}>
        {mix.items.map((item) => (
          <li key={`${mix.id}-${item.position}`} className="meta" style={{ margin: '4px 0' }}>
            {mixItemComposition(item, tobaccoById)}
            {item.retired ? ' — снят с каталога' : ''}
          </li>
        ))}
      </ul>
      <p className="meta" style={{ marginTop: 10 }}>
        {formatMixCreatedAt(mix.created_at)}
      </p>
      <div className="field">
        <label htmlFor={`mix-${mix.id}-note`}>Заметка</label>
        <input
          id={`mix-${mix.id}-note`}
          className="input"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={`mix-${mix.id}-rating`}>Оценка</label>
        <select
          id={`mix-${mix.id}-rating`}
          className="input"
          value={rating}
          onChange={(event) => setRating(event.target.value)}
        >
          <option value="">нет</option>
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => onSave(mix, note, rating === '' ? null : Number(rating))}
      >
        Записать оценку
      </button>
    </article>
  )
}

import { useEffect, useState } from 'react'
import { type SpinMode, type SpinResult, listTobaccos, saveMix, spin } from '../api'
import {
  FiltersSheet,
  type LoungeFilters,
} from './FiltersSheet'
import { SPIN_MODE_OPTIONS, messageFrom } from './shared'
import { Wheel } from './Wheel'

export const DEFAULT_LOUNGE_FILTERS: LoungeFilters = {
  count: 2,
  mode: 'random',
  brand: '',
  flavor: '',
  strength: '',
  source: 'catalog',
}

function modeLabel(mode: string): string {
  return SPIN_MODE_OPTIONS.find((item) => item.value === mode)?.label ?? mode
}

function filterSummaryTags(filters: LoungeFilters): string[] {
  const tags: string[] = []
  if (filters.flavor) {
    tags.push(filters.flavor)
  }
  if (filters.brand) {
    tags.push(filters.brand)
  }
  if (filters.strength) {
    tags.push(filters.strength)
  }
  return tags
}

function hasActiveFilters(filters: LoungeFilters): boolean {
  return Boolean(filters.brand || filters.flavor || filters.strength)
}

export default function RoulettePage({
  loggedIn,
  filtersOpen,
  onFiltersOpenChange,
  onToast,
}: {
  loggedIn: boolean
  filtersOpen: boolean
  onFiltersOpenChange: (open: boolean) => void
  onToast: (message: string) => void
}) {
  const [filters, setFilters] = useState<LoungeFilters>(DEFAULT_LOUNGE_FILTERS)
  const [draft, setDraft] = useState<LoungeFilters>(DEFAULT_LOUNGE_FILTERS)
  const [brands, setBrands] = useState<string[]>([])
  const [result, setResult] = useState<SpinResult | null>(null)
  const [error, setError] = useState('')
  const [spinning, setSpinning] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    listTobaccos()
      .then((items) => {
        if (cancelled) {
          return
        }
        const unique = [...new Set(items.map((item) => item.brand))]
        unique.sort((a, b) => a.localeCompare(b, 'ru'))
        setBrands(unique)
      })
      .catch(() => {
        if (!cancelled) {
          setBrands([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (filtersOpen) {
      setDraft(filters)
    }
  }, [filtersOpen, filters])

  async function onSpin() {
    setError('')
    setResult(null)
    setSpinning(true)
    setBusy(true)
    try {
      const out = await spin({
        count: filters.count,
        mode: filters.mode,
        brand: filters.brand.trim() || null,
        flavor: filters.flavor || null,
        strength: filters.strength || null,
        source: loggedIn ? filters.source : 'catalog',
      })
      setResult(out)
    } catch (err) {
      setError(messageFrom(err))
    } finally {
      setSpinning(false)
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
      onToast('Смесь на полке')
    } catch (err) {
      setError(messageFrom(err))
    } finally {
      setBusy(false)
    }
  }

  function applyFilters() {
    setFilters(draft)
    onToast('Фильтры на каталоге')
    onFiltersOpenChange(false)
  }

  function resetDraft() {
    setDraft(DEFAULT_LOUNGE_FILTERS)
  }

  const summaryTags = filterSummaryTags(filters)

  return (
    <section className="view is-active" aria-labelledby="home-title">
      <p className="eyebrow">Лаунж · рулетка</p>
      <h1 id="home-title">Крути вкус вечера</h1>
      <p className="lead">Одна крутка — готовая смесь из двух-трёх нот каталога.</p>

      <Wheel spinning={spinning} />

      <div className="filter-summary" aria-live="polite">
        {!hasActiveFilters(filters) ? (
          <span className="meta">Каталог без фильтров</span>
        ) : (
          summaryTags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))
        )}
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className={`result card${result ? ' is-visible' : ''}`} aria-live="polite">
        {result ? (
          <>
            <div className="row-between">
              <span className="pill">Смесь · {result.count}</span>
              <span className="meta">режим: {modeLabel(result.mode)}</span>
            </div>
            <ul className="blend-list" aria-label="Состав смеси">
              {result.items.map((item) => (
                <li key={item.id} className="blend-item">
                  <span>
                    {item.brand} — {item.name}
                  </span>
                  <span className="meta">
                    {item.strength} · {item.flavors.join(', ')}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      <div className="actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={onSpin}>
          Крутить
        </button>
        <div className="actions-row">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onFiltersOpenChange(true)}
          >
            Фильтры
          </button>
          {loggedIn ? (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!result || busy}
              onClick={onSave}
            >
              Сохранить на полку
            </button>
          ) : null}
        </div>
      </div>

      <FiltersSheet
        open={filtersOpen}
        draft={draft}
        brands={brands}
        loggedIn={loggedIn}
        onChange={setDraft}
        onClose={() => onFiltersOpenChange(false)}
        onApply={applyFilters}
        onReset={resetDraft}
      />
    </section>
  )
}

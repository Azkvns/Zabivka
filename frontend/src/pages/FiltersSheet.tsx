import { type ReactNode } from 'react'
import { type Source, type SpinMode } from '../api'
import { FLAVORS, SOURCE_OPTIONS, SPIN_MODE_OPTIONS, STRENGTHS } from './shared'

export type LoungeFilters = {
  count: 2 | 3 | 4
  mode: SpinMode
  brand: string
  flavor: string
  strength: string
  source: Source
}

type FiltersSheetProps = {
  open: boolean
  draft: LoungeFilters
  brands: string[]
  loggedIn: boolean
  onChange: (next: LoungeFilters) => void
  onClose: () => void
  onApply: () => void
  onReset: () => void
}

function FilterGroup({
  label,
  groupLabel,
  children,
}: {
  label: string
  groupLabel?: string
  children: ReactNode
}) {
  return (
    <div>
      <p className="meta" style={{ marginBottom: 8 }}>
        {label}
      </p>
      <div className="chip-row" role="group" aria-label={groupLabel ?? label}>
        {children}
      </div>
    </div>
  )
}

function ToggleChip({
  name,
  selected,
  onSelect,
  onClear,
}: {
  name: string
  selected: boolean
  onSelect: () => void
  onClear: () => void
}) {
  return (
    <button
      type="button"
      className={`chip${selected ? ' is-on' : ''}`}
      aria-pressed={selected}
      onClick={() => (selected ? onClear() : onSelect())}
    >
      {name}
    </button>
  )
}

function SingleChip({
  name,
  selected,
  onPick,
}: {
  name: string
  selected: boolean
  onPick: () => void
}) {
  return (
    <button
      type="button"
      className={`chip${selected ? ' is-on' : ''}`}
      aria-pressed={selected}
      onClick={onPick}
    >
      {name}
    </button>
  )
}

export function FiltersSheet({
  open,
  draft,
  brands,
  loggedIn,
  onChange,
  onClose,
  onApply,
  onReset,
}: FiltersSheetProps) {
  function patch(next: Partial<LoungeFilters>) {
    onChange({ ...draft, ...next })
  }

  return (
    <aside
      className={`sheet${open ? ' is-open' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="filters-title"
      hidden={!open}
    >
      <div className="sheet-handle" aria-hidden="true" />
      <div className="row-between">
        <h2 id="filters-title">Фильтры каталога</h2>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Закрыть
        </button>
      </div>
      <div className="stack">
        <FilterGroup label="Вкус / ноты">
          {FLAVORS.map((item) => (
            <ToggleChip
              key={item}
              name={item}
              selected={draft.flavor === item}
              onSelect={() => patch({ flavor: item })}
              onClear={() => patch({ flavor: '' })}
            />
          ))}
        </FilterGroup>
        <FilterGroup label="Бренд">
          {brands.map((item) => (
            <ToggleChip
              key={item}
              name={item}
              selected={draft.brand === item}
              onSelect={() => patch({ brand: item })}
              onClear={() => patch({ brand: '' })}
            />
          ))}
        </FilterGroup>
        <FilterGroup label="Крепость">
          {STRENGTHS.map((item) => (
            <ToggleChip
              key={item}
              name={item}
              selected={draft.strength === item}
              onSelect={() => patch({ strength: item })}
              onClear={() => patch({ strength: '' })}
            />
          ))}
        </FilterGroup>
        <FilterGroup label="Число">
          {([2, 3, 4] as const).map((value) => (
            <SingleChip
              key={value}
              name={String(value)}
              selected={draft.count === value}
              onPick={() => patch({ count: value })}
            />
          ))}
        </FilterGroup>
        <FilterGroup label="Режим">
          {SPIN_MODE_OPTIONS.map((item) => (
            <SingleChip
              key={item.value}
              name={item.label}
              selected={draft.mode === item.value}
              onPick={() => patch({ mode: item.value })}
            />
          ))}
        </FilterGroup>
        {loggedIn ? (
          <FilterGroup label="Источник" groupLabel="Источник">
            {SOURCE_OPTIONS.map((item) => (
              <SingleChip
                key={item.value}
                name={item.label}
                selected={draft.source === item.value}
                onPick={() => patch({ source: item.value })}
              />
            ))}
          </FilterGroup>
        ) : null}
      </div>
      <div className="actions-row">
        <button type="button" className="btn btn-secondary" onClick={onReset}>
          Сбросить
        </button>
        <button type="button" className="btn btn-primary" onClick={onApply}>
          Применить
        </button>
      </div>
    </aside>
  )
}

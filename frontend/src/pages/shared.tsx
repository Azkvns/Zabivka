import { type FormEvent } from 'react'
import { type Source, type SpinMode, type TobaccoIn } from '../api'

export const SPIN_MODE_OPTIONS: { value: SpinMode; label: string }[] = [
  { value: 'random', label: 'Случайно' },
  { value: 'different_flavors', label: 'Разные вкусы' },
  { value: 'softer', label: 'Мягче' },
  { value: 'stronger', label: 'Крепче' },
]

export const SOURCE_OPTIONS: { value: Source; label: string }[] = [
  { value: 'catalog', label: 'каталог' },
  { value: 'both', label: 'каталог и полка' },
  { value: 'shelf', label: 'полка' },
]

export const FLAVORS = [
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

export const STRENGTHS = ['лёгкая', 'средняя', 'крепкая'] as const

export function emptyTobacco(): TobaccoIn {
  return { brand: '', name: '', strength: 'средняя', flavors: ['мята'] }
}

export function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'ошибка запроса'
}

export function TobaccoForm({
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

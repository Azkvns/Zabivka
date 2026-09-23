import type { MixItem, Tobacco } from './api'

export function mixHeadingNames(items: MixItem[]): string {
  return items.map((item) => item.name).join(' + ')
}

export function mixItemComposition(
  item: MixItem,
  tobaccoById: ReadonlyMap<number, Tobacco>,
): string {
  const tobacco = tobaccoById.get(item.tobacco_id)
  if (tobacco) {
    return `${tobacco.brand} — ${tobacco.name} · ${tobacco.strength}`
  }
  return item.name
}

export function formatMixCreatedAt(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU')
}

export function tobaccoByIdFrom(rows: Tobacco[]): Map<number, Tobacco> {
  return new Map(rows.map((row) => [row.id, row]))
}

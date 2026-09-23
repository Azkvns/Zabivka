import { describe, expect, it } from 'vitest'
import type { MixItem, Tobacco } from './api'
import { mixHeadingNames, mixItemComposition } from './mixDisplay'

const item = (overrides: Partial<MixItem> & Pick<MixItem, 'position'>): MixItem => ({
  tobacco_id: 1,
  name: 'Fallback',
  retired: false,
  ...overrides,
})

describe('mixDisplay', () => {
  it('joins mix item names for the card title', () => {
    const items = [
      item({ position: 0, name: 'Мята' }),
      item({ position: 1, name: 'Ягода' }),
    ]
    expect(mixHeadingNames(items)).toBe('Мята + Ягода')
  })

  it('shows tobacco brand, name, and strength when id is known', () => {
    const map = new Map<number, Tobacco>([
      [
        5,
        {
          id: 5,
          brand: 'Darkside',
          name: 'Supernova',
          strength: 'крепкая',
          flavors: ['мята'],
          retired: false,
          owner_id: null,
        },
      ],
    ])
    expect(
      mixItemComposition(item({ position: 0, tobacco_id: 5, name: 'Supernova' }), map),
    ).toBe('Darkside — Supernova · крепкая')
  })

  it('falls back to mix item name when tobacco is not loaded', () => {
    expect(
      mixItemComposition(item({ position: 0, tobacco_id: 99, name: 'Старый вкус' }), new Map()),
    ).toBe('Старый вкус')
  })
})

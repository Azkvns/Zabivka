import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { type LoungeFilters, FiltersSheet } from './FiltersSheet'

const baseDraft: LoungeFilters = {
  count: 2,
  mode: 'random',
  brand: '',
  flavor: '',
  strength: '',
  source: 'catalog',
}

function renderSheet(
  overrides: Partial<Parameters<typeof FiltersSheet>[0]> = {},
) {
  const onChange = vi.fn()
  const props = {
    open: true,
    draft: baseDraft,
    brands: ['Darkside', 'Element'],
    loggedIn: false,
    onChange,
    onClose: vi.fn(),
    onApply: vi.fn(),
    onReset: vi.fn(),
    ...overrides,
  }
  render(<FiltersSheet {...props} />)
  return props
}

describe('FiltersSheet', () => {
  it('is hidden when closed', () => {
    renderSheet({ open: false })
    expect(screen.getByRole('dialog', { hidden: true })).toHaveAttribute('hidden')
  })

  it('clears flavor when the selected chip is pressed again', async () => {
    const { onChange } = renderSheet({ draft: { ...baseDraft, flavor: 'мята' } })
    await userEvent.click(screen.getByRole('button', { name: 'мята' }))
    expect(onChange).toHaveBeenCalledWith({ ...baseDraft, flavor: '' })
  })

  it('keeps a single count value when another count chip is chosen', async () => {
    function Controlled() {
      const [draft, setDraft] = useState(baseDraft)
      return (
        <FiltersSheet
          open
          draft={draft}
          brands={[]}
          loggedIn={false}
          onChange={setDraft}
          onClose={vi.fn()}
          onApply={vi.fn()}
          onReset={vi.fn()}
        />
      )
    }
    render(<Controlled />)
    await userEvent.click(screen.getByRole('button', { name: '3' }))
    expect(screen.getByRole('button', { name: '3' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: '4' }))
    expect(screen.getByRole('button', { name: '4' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '3' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('omits the source group for guests and shows it when logged in', () => {
    const { rerender } = render(
      <FiltersSheet
        open
        draft={baseDraft}
        brands={[]}
        loggedIn={false}
        onChange={vi.fn()}
        onClose={vi.fn()}
        onApply={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    expect(screen.queryByRole('group', { name: 'Источник' })).toBeNull()

    rerender(
      <FiltersSheet
        open
        draft={baseDraft}
        brands={[]}
        loggedIn
        onChange={vi.fn()}
        onClose={vi.fn()}
        onApply={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    expect(screen.getByRole('group', { name: 'Источник' })).toBeVisible()
  })
})

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { setToken } from './api'

function fakeJwt(role: string): string {
  const header = btoa(JSON.stringify({ alg: 'none' }))
  const payload = btoa(JSON.stringify({ sub: '1', role }))
  return `${header}.${payload}.sig`
}

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.pushState({}, '', '/')
})

describe('shell', () => {
  it('shows the lounge logo and header icon controls', () => {
    render(<App />)

    expect(screen.getByRole('link', { name: 'Забивка' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Фильтры' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Меню' })).toBeVisible()
  })
})

describe('roulette', () => {
  it('hides source for guests and sends catalog', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        mode: 'random',
        count: 2,
        items: [
          { id: 1, brand: 'Туман', name: 'Мята', strength: 'лёгкая', flavors: ['мята'] },
          { id: 2, brand: 'Туман', name: 'Ягода', strength: 'средняя', flavors: ['ягоды'] },
        ],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)

    expect(screen.queryByLabelText('Источник')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Крутить' }))
    await screen.findByText('Туман — Мята')

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as { source: string }
    expect(body.source).toBe('catalog')
    expect(screen.queryByRole('button', { name: 'Сохранить' })).toBeNull()
  })

  it('shows the exact narrow phrase and does not render a composition', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ detail: { reason: 'Выборка слишком узкая' } }, 422),
      ),
    )
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'Крутить' }))
    await screen.findByText('Выборка слишком узкая')
    expect(screen.queryByRole('list', { name: 'Состав' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Сохранить' })).toBeNull()
  })

  it('lets a signed-in user choose source and save a mix', async () => {
    setToken(fakeJwt('user'))
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          mode: 'random',
          count: 2,
          items: [
            { id: 1, brand: 'Туман', name: 'Мята', strength: 'лёгкая', flavors: ['мята'] },
            { id: 2, brand: 'Поляна', name: 'Чай', strength: 'лёгкая', flavors: ['напитки'] },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 9,
          mode: 'random',
          size: 2,
          note: null,
          rating: null,
          created_at: '2026-01-01T00:00:00Z',
          items: [],
        }, 201),
      )
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)

    expect(screen.getByLabelText('Источник')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Крутить' }))
    const save = await screen.findByRole('button', { name: 'Сохранить' })
    await userEvent.click(save)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const saveBody = JSON.parse(fetchMock.mock.calls[1][1].body as string) as {
      tobacco_ids: number[]
    }
    expect(saveBody.tobacco_ids).toEqual([1, 2])
  })
})

describe('admin route', () => {
  it('hides actions when the role is not admin', async () => {
    setToken(fakeJwt('user'))
    window.history.pushState({}, '', '/admin')
    render(<App />)

    expect(screen.queryByRole('button', { name: 'Очистить каталог' })).toBeNull()
    expect(screen.queryByLabelText('CSV')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Добавить в каталог' })).toBeNull()
  })
})

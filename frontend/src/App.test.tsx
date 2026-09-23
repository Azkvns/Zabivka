import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import App from './App'
import { setToken } from './api'

const indexCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'index.css'),
  'utf8',
)

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
    const { container } = render(<App />)
    const topnav = container.querySelector('.topnav')
    expect(topnav).not.toBeNull()

    expect(screen.getByRole('link', { name: 'Забивка' })).toBeVisible()
    expect(within(topnav as HTMLElement).getByRole('button', { name: 'Фильтры' })).toBeVisible()
    expect(within(topnav as HTMLElement).getByRole('button', { name: 'Меню' })).toBeVisible()
  })

  it('marks the closed menu drawer inert and aria-hidden', () => {
    const { container } = render(<App />)

    const drawer = container.querySelector('nav.menu-drawer')
    expect(drawer).not.toBeNull()
    expect(drawer).toHaveAttribute('inert')
    expect(drawer).toHaveAttribute('aria-hidden', 'true')
  })

  it('clears inert on the open menu drawer', async () => {
    const { container } = render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'Меню' }))
    const drawer = container.querySelector('nav.menu-drawer')
    expect(drawer).not.toBeNull()
    expect(drawer).not.toHaveAttribute('inert')
    expect(drawer).toHaveAttribute('aria-hidden', 'false')
  })

  it('chip control meets 44px touch target', () => {
    const chipBlock = indexCss.match(/\.chip\s*\{([^}]+)\}/)?.[1] ?? ''
    expect(chipBlock).toContain('min-height: 44px')
    expect(chipBlock).toContain('min-width: 44px')
  })

  it('disables mix-card rise when reduced motion is preferred', () => {
    const reducedMotionBlock =
      indexCss.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/)?.[1] ?? ''
    expect(reducedMotionBlock).toContain('.result.is-visible')
    expect(reducedMotionBlock).toContain('animation: none')
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

    const spinCall = fetchMock.mock.calls.find(
      (call) => call[1] && typeof call[1] === 'object' && 'body' in call[1],
    )
    expect(spinCall).toBeDefined()
    const body = JSON.parse(spinCall![1].body as string) as { source: string }
    expect(body.source).toBe('catalog')
    expect(screen.queryByRole('button', { name: 'Сохранить на полку' })).toBeNull()
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
    expect(screen.queryByRole('list', { name: 'Состав смеси' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Сохранить на полку' })).toBeNull()
  })

  it('lets a signed-in user choose source and save a mix', async () => {
    setToken(fakeJwt('user'))
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
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

    await userEvent.click(screen.getAllByRole('button', { name: 'Фильтры' })[0])
    expect(screen.getByRole('group', { name: 'Источник' })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Крутить' }))
    const save = await screen.findByRole('button', { name: 'Сохранить на полку' })
    await userEvent.click(save)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    const saveBody = JSON.parse(fetchMock.mock.calls[2][1].body as string) as {
      tobacco_ids: number[]
    }
    expect(saveBody.tobacco_ids).toEqual([1, 2])
  })
})

describe('auth tabs', () => {
  it('shows lounge copy and login tab on /login', () => {
    window.history.pushState({}, '', '/login')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Войди, чтобы копить полку' })).toBeVisible()
    expect(screen.getByText('Гость крутит каталог. Сохранённые смеси живут после входа.')).toBeVisible()
    expect(screen.getByRole('tablist', { name: 'Режим входа' })).toBeVisible()
    expect(screen.getByRole('tab', { name: 'Вход' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'Войти' })).toBeVisible()
    expect(screen.getByText('Логин и пароль уходят на сервер.')).toBeVisible()
    expect(screen.getByRole('link', { name: '← К рулетке' })).toHaveAttribute('href', '/')
  })

  it('switches to register via tab navigation', async () => {
    window.history.pushState({}, '', '/login')
    render(<App />)

    await userEvent.click(screen.getByRole('tab', { name: 'Регистрация' }))
    expect(window.location.pathname).toBe('/register')
    expect(screen.getByRole('tab', { name: 'Регистрация' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'Зарегистрироваться' })).toBeVisible()
  })

  it('surfaces API errors as .error text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ detail: 'Неверный пароль' }, 401)),
    )
    window.history.pushState({}, '', '/login')
    render(<App />)

    await userEvent.type(screen.getByLabelText('Логин'), 'guest')
    await userEvent.type(screen.getByLabelText('Пароль'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }))

    const error = await screen.findByText('Неверный пароль')
    expect(error).toHaveClass('error')
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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiUrl, importCatalog, request, setToken, spin } from './api'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  localStorage.clear()
})

describe('apiUrl', () => {
  it('uses /api on the current host when VITE_API_URL is empty', () => {
    vi.stubEnv('VITE_API_URL', '')
    expect(apiUrl('/roulette/spin')).toBe('/api/roulette/spin')
  })

  it('does not bake a host when the env is unset', () => {
    expect(apiUrl('/auth/login')).toBe('/api/auth/login')
    expect(apiUrl('/auth/login')).not.toMatch(/127\.0\.0\.1|localhost/)
  })
})

describe('request', () => {
  it('sends Authorization Bearer from localStorage', async () => {
    setToken('tok-1')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    })
    vi.stubGlobal('fetch', fetchMock)

    await request('/mixes')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/mixes',
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    )
    const headers = fetchMock.mock.calls[0][1].headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer tok-1')
  })
})

describe('spin', () => {
  it('throws the exact narrow-pool phrase from detail.reason', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ detail: { reason: 'Выборка слишком узкая' } }),
      }),
    )

    await expect(
      spin({ count: 4, mode: 'random', source: 'catalog' }),
    ).rejects.toThrow('Выборка слишком узкая')
  })
})

describe('importCatalog', () => {
  it('exposes line and reason from a 422 import error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ detail: { line: 4, reason: 'unknown flavor' } }),
      }),
    )

    await expect(importCatalog(new File(['x'], 'bad.csv'))).rejects.toMatchObject({
      message: 'unknown flavor',
      line: 4,
    })
  })
})

const TOKEN_KEY = 'access_token'

export type SpinMode = 'random' | 'different_flavors' | 'softer' | 'stronger'
export type Source = 'catalog' | 'both' | 'shelf'

export type UserOut = {
  id: number
  login: string
  role: string
}

export type Tobacco = {
  id: number
  brand: string
  name: string
  strength: string
  flavors: string[]
  retired: boolean
  owner_id: number | null
}

export type TobaccoIn = {
  brand: string
  name: string
  strength: string
  flavors: string[]
}

export type SpinItem = {
  id: number
  brand: string
  name: string
  strength: string
  flavors: string[]
}

export type SpinResult = {
  mode: string
  count: number
  items: SpinItem[]
}

export type MixItem = {
  position: number
  tobacco_id: number
  name: string
  retired: boolean
}

export type Mix = {
  id: number
  mode: string
  size: number
  note: string | null
  rating: number | null
  created_at: string
  items: MixItem[]
}

export type SpinBody = {
  count: 2 | 3 | 4
  mode: SpinMode
  brand?: string | null
  flavor?: string | null
  strength?: string | null
  source?: Source
}

export class ApiError extends Error {
  status: number
  line?: number

  constructor(message: string, status: number, line?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.line = line
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

export function getRole(): string | null {
  const token = getToken()
  if (!token) {
    return null
  }
  const payload = token.split('.')[1]
  if (!payload) {
    return null
  }
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const parsed = JSON.parse(atob(normalized)) as { role?: unknown }
    return typeof parsed.role === 'string' ? parsed.role : null
  } catch {
    return null
  }
}

export function isLoggedIn(): boolean {
  return getToken() !== null
}

export function isAdmin(): boolean {
  return getRole() === 'admin'
}

export function apiUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`
  const raw = import.meta.env.VITE_API_URL
  const base = typeof raw === 'string' ? raw.trim().replace(/\/$/, '') : ''
  if (!base) {
    return `/api${suffix}`
  }
  if (base.endsWith('/api')) {
    return `${base}${suffix}`
  }
  return `${base}/api${suffix}`
}

function errorFromDetail(status: number, detail: unknown): ApiError {
  if (detail && typeof detail === 'object' && 'reason' in detail) {
    const reason = (detail as { reason?: unknown }).reason
    const line = (detail as { line?: unknown }).line
    const message = typeof reason === 'string' ? reason : 'request failed'
    return new ApiError(
      message,
      status,
      typeof line === 'number' ? line : undefined,
    )
  }
  if (typeof detail === 'string') {
    return new ApiError(detail, status)
  }
  return new ApiError('request failed', status)
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const token = getToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(apiUrl(path), { ...init, headers })
  if (res.status === 204) {
    return undefined as T
  }
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const detail =
      body && typeof body === 'object' && 'detail' in body
        ? (body as { detail: unknown }).detail
        : body
    throw errorFromDetail(res.status, detail)
  }
  return body as T
}

export async function register(login: string, password: string): Promise<UserOut> {
  return request<UserOut>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ login, password }),
  })
}

export async function login(loginName: string, password: string): Promise<void> {
  const out = await request<{ access_token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login: loginName, password }),
  })
  setToken(out.access_token)
}

export function logout(): void {
  setToken(null)
}

export async function listTobaccos(query: {
  brand?: string
  flavor?: string
  strength?: string
  source?: Source
  include_retired?: boolean
} = {}): Promise<Tobacco[]> {
  const params = new URLSearchParams()
  if (query.brand) params.set('brand', query.brand)
  if (query.flavor) params.set('flavor', query.flavor)
  if (query.strength) params.set('strength', query.strength)
  if (query.source) params.set('source', query.source)
  if (query.include_retired) params.set('include_retired', 'true')
  const qs = params.toString()
  return request<Tobacco[]>(`/tobaccos${qs ? `?${qs}` : ''}`)
}

export async function spin(body: SpinBody): Promise<SpinResult> {
  return request<SpinResult>('/roulette/spin', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function saveMix(mode: SpinMode, tobaccoIds: number[]): Promise<Mix> {
  return request<Mix>('/mixes', {
    method: 'POST',
    body: JSON.stringify({ mode, tobacco_ids: tobaccoIds }),
  })
}

export async function listMixes(): Promise<Mix[]> {
  return request<Mix[]>('/mixes')
}

export async function patchMix(
  id: number,
  body: { note?: string | null; rating?: number | null },
): Promise<Mix> {
  return request<Mix>(`/mixes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function createShelf(body: TobaccoIn): Promise<Tobacco> {
  return request<Tobacco>('/shelf', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function patchShelf(id: number, body: TobaccoIn): Promise<Tobacco> {
  return request<Tobacco>(`/shelf/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function deleteShelf(id: number): Promise<void> {
  return request<void>(`/shelf/${id}`, { method: 'DELETE' })
}

export async function createAdminTobacco(body: TobaccoIn): Promise<Tobacco> {
  return request<Tobacco>('/admin/tobaccos', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function patchAdminTobacco(id: number, body: TobaccoIn): Promise<Tobacco> {
  return request<Tobacco>(`/admin/tobaccos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function clearCatalog(): Promise<number> {
  return request<number>('/admin/catalog/clear', {
    method: 'POST',
    body: JSON.stringify({ confirm: 'CLEAR' }),
  })
}

export async function importCatalog(file: File): Promise<{ imported: number }> {
  const body = new FormData()
  body.append('file', file)
  return request<{ imported: number }>('/admin/catalog/import', {
    method: 'POST',
    body,
  })
}

import { request } from '@/api/http'
import type { MoliResult } from '@/types/api'
import { API_SUCCESS_CODE } from '@/types/api'
import type { PersonaOverview, PersonaQuery, PersonaUserDetail } from '@/types/persona'
import { buildMockPersonaOverview, buildMockPersonaUserDetail } from '@/composables/personaMock'

const USE_MOCK = import.meta.env.VITE_PERSONA_MOCK !== 'false'

function buildQuery(q: PersonaQuery) {
  const qs = new URLSearchParams()
  qs.set('range', q.range)
  if (q.segmentId) qs.set('segmentId', q.segmentId)
  if (q.risk) qs.set('risk', q.risk)
  if (q.search) qs.set('search', q.search)
  return `?${qs.toString()}`
}

function mockOverview(query: PersonaQuery) {
  return { code: API_SUCCESS_CODE, data: buildMockPersonaOverview(query) } satisfies MoliResult<PersonaOverview>
}

export async function getPersonaOverviewApi(query: PersonaQuery): Promise<MoliResult<PersonaOverview>> {
  if (USE_MOCK) {
    await delay(260)
    return mockOverview(query)
  }
  try {
    const result = await request<PersonaOverview>(`/persona/overview${buildQuery(query)}`, { method: 'GET' })
    if (result.code === API_SUCCESS_CODE && result.data) return result
  } catch {
    /* fallback */
  }
  await delay(100)
  return mockOverview(query)
}

export async function getPersonaUserDetailApi(userId: string): Promise<MoliResult<PersonaUserDetail>> {
  if (USE_MOCK) {
    await delay(180)
    const data = buildMockPersonaUserDetail(userId)
    return data ? { code: API_SUCCESS_CODE, data } : { code: 404, msg: 'not found' }
  }
  try {
    const result = await request<PersonaUserDetail>(`/persona/users/${userId}`, { method: 'GET' })
    if (result.code === API_SUCCESS_CODE && result.data) return result
  } catch {
    /* fallback */
  }
  const data = buildMockPersonaUserDetail(userId)
  return data ? { code: API_SUCCESS_CODE, data } : { code: 404, msg: 'not found' }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

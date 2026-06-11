import { request } from '@/api/http'
import type { LoginPayload, LoginVo, MoliResult } from '@/types/api'
import { API_SUCCESS_CODE } from '@/types/api'

const USE_MOCK = import.meta.env.VITE_USE_MOCK_AUTH !== 'false'

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function mockLogin(payload: LoginPayload): Promise<MoliResult<LoginVo>> {
  await delay(450)
  if (payload.userName === 'test' && payload.password === '123456') {
    return {
      code: API_SUCCESS_CODE,
      msg: '登录成功',
      data: {
        token: `mock-token-${Date.now()}`,
        user: {
          id: 1,
          userName: 'test',
          nickName: '测试用户',
        },
        menuVoList: undefined,
        fullPermission: true,
        permissions: ['*:*:*'],
      },
    }
  }
  if (payload.userName === 'admin' && payload.password === '123456') {
    return {
      code: API_SUCCESS_CODE,
      msg: '登录成功',
      data: {
        token: `mock-token-${Date.now()}`,
        user: {
          id: 1,
          userName: 'admin',
          nickName: '管理员',
        },
        menuVoList: undefined,
        fullPermission: true,
        permissions: ['*:*:*'],
      },
    }
  }
  if (payload.userName === 'zhangsan' && payload.password === '123456') {
    return {
      code: API_SUCCESS_CODE,
      msg: '登录成功',
      data: {
        token: `mock-token-${Date.now()}`,
        user: {
          id: 2,
          userName: 'zhangsan',
          nickName: '张三',
        },
        systemPortalEnabled: false,
        fullPermission: false,
        permissions: ['system:user:list'],
      },
    }
  }
  return {
    code: 500,
    msg: '用户不存在或者密码错误',
  }
}

async function mockLogout(): Promise<MoliResult<null>> {
  await delay(200)
  return { code: API_SUCCESS_CODE, msg: '退出成功' }
}

export function isMockAuthEnabled() {
  return USE_MOCK
}

export async function loginApi(payload: LoginPayload) {
  if (USE_MOCK) {
    return mockLogin(payload)
  }
  return request<LoginVo>('/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function logoutApi() {
  if (USE_MOCK) {
    return mockLogout()
  }
  return request<null>('/logout', { method: 'POST' })
}

export type CapabilitiesVo = {
  permissions?: string[]
  fullPermission?: boolean
}

export async function getCapabilitiesApi() {
  if (USE_MOCK) {
    await delay(200)
    return {
      code: API_SUCCESS_CODE,
      data: {
        permissions: ['*:*:*'],
        fullPermission: true,
      },
    } satisfies MoliResult<CapabilitiesVo>
  }
  return request<CapabilitiesVo>('/auth/capabilities', { method: 'GET' })
}

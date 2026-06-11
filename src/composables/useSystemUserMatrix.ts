import { ref } from 'vue'
import { getSystemByUserIdApi, insertUserSystemApi, listUserApi } from '@/api/user'
import { API_SUCCESS_CODE } from '@/types/api'
import type { UserVo } from '@/types/user'
import { hasFullPermission } from '@/utils/privilege'

export function useSystemUserMatrix() {
  const allUsers = ref<UserVo[]>([])
  const userSystemMap = ref(new Map<string, Set<string>>())
  const loading = ref(false)

  function isSuperAdminUser(user?: UserVo | null) {
    return hasFullPermission(user?.userName)
  }

  function userHasSystem(userId: string, systemId: string, user?: UserVo | null) {
    if (isSuperAdminUser(user ?? allUsers.value.find((row) => String(row.id) === userId))) {
      return true
    }
    return userSystemMap.value.get(userId)?.has(systemId) ?? false
  }

  function countUsersForSystem(systemId: string) {
    return allUsers.value.filter((user) => user.id != null && userHasSystem(String(user.id), systemId, user)).length
  }

  async function refreshUserAssignment(userId: string | number) {
    const key = String(userId)
    const user = allUsers.value.find((row) => String(row.id) === key)
    if (!user) return

    if (isSuperAdminUser(user)) {
      userSystemMap.value.set(key, new Set())
      return
    }

    const result = await getSystemByUserIdApi(userId)
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || 'Failed to load user systems')
    }
    const ids = result.data?.systemIds?.map((id) => String(id)) ?? []
    userSystemMap.value.set(key, new Set(ids))
  }

  async function loadMatrix() {
    loading.value = true
    try {
      const users: UserVo[] = []
      let pageNum = 1
      const pageSize = 100
      let total = 0

      do {
        const result = await listUserApi({ pageNum, pageSize })
        if (result.code !== API_SUCCESS_CODE || !result.data) {
          throw new Error(result.msg || 'Failed to load users')
        }
        users.push(...(result.data.list ?? []))
        total = result.data.total ?? users.length
        pageNum += 1
      } while (users.length < total)

      allUsers.value = users
      const map = new Map<string, Set<string>>()
      await Promise.all(
        users.map(async (user) => {
          if (user.id == null) return
          const key = String(user.id)
          if (isSuperAdminUser(user)) {
            map.set(key, new Set())
            return
          }
          const result = await getSystemByUserIdApi(user.id)
          if (result.code !== API_SUCCESS_CODE) return
          const ids = result.data?.systemIds?.map((id) => String(id)) ?? []
          map.set(key, new Set(ids))
        }),
      )
      userSystemMap.value = map
    } finally {
      loading.value = false
    }
  }

  function filterUsersForSystem(systemId: string, userName?: string, authorized = true) {
    const keyword = userName?.trim().toLowerCase() ?? ''
    return allUsers.value.filter((user) => {
      if (user.id == null) return false
      if (keyword) {
        const haystack = `${user.userName ?? ''} ${user.nickName ?? ''}`.toLowerCase()
        if (!haystack.includes(keyword)) return false
      }
      const hasAccess = userHasSystem(String(user.id), systemId, user)
      return authorized ? hasAccess : !hasAccess
    })
  }

  async function addUsersToSystem(
    systemId: string,
    userIds: string[],
    knownUsers?: UserVo[],
    onProgress?: (done: number, total: number) => void,
  ) {
    let processed = 0
    const total = userIds.length
    for (const userId of userIds) {
      const user =
        knownUsers?.find((row) => String(row.id) === userId) ??
        allUsers.value.find((row) => String(row.id) === userId)
      if (user && isSuperAdminUser(user)) continue

      const result = await getSystemByUserIdApi(userId)
      if (result.code !== API_SUCCESS_CODE) {
        throw new Error(result.msg || 'Failed to load user systems')
      }
      const currentIds = result.data?.systemIds ?? []
      const nextIds = [...new Set([...currentIds.map(String), systemId])]
      const saveResult = await insertUserSystemApi({
        userId,
        systemIds: nextIds,
      })
      if (saveResult.code !== API_SUCCESS_CODE) {
        throw new Error(saveResult.msg || 'Failed to assign system')
      }
      userSystemMap.value.set(userId, new Set(nextIds))
      processed += 1
      onProgress?.(processed, total)
    }
    if (userIds.length > 0 && processed === 0) {
      throw new Error('No users were assigned')
    }
  }

  async function removeUsersFromSystem(
    systemId: string,
    userIds: string[],
    knownUsers?: UserVo[],
    onProgress?: (done: number, total: number) => void,
  ) {
    let processed = 0
    const total = userIds.length
    for (const userId of userIds) {
      const user =
        knownUsers?.find((row) => String(row.id) === userId) ??
        allUsers.value.find((row) => String(row.id) === userId)
      if (user && isSuperAdminUser(user)) continue

      const result = await getSystemByUserIdApi(userId)
      if (result.code !== API_SUCCESS_CODE) {
        throw new Error(result.msg || 'Failed to load user systems')
      }
      const nextIds = (result.data?.systemIds ?? []).filter((id) => String(id) !== systemId)
      const saveResult = await insertUserSystemApi({
        userId,
        systemIds: nextIds,
      })
      if (saveResult.code !== API_SUCCESS_CODE) {
        throw new Error(saveResult.msg || 'Failed to remove system')
      }
      userSystemMap.value.set(userId, new Set(nextIds.map(String)))
      processed += 1
      onProgress?.(processed, total)
    }
    if (userIds.length > 0 && processed === 0) {
      throw new Error('No users were removed')
    }
  }

  async function saveUserSystems(userId: string | number, systemIds: Array<number | string>) {
    const saveResult = await insertUserSystemApi({ userId, systemIds })
    if (saveResult.code !== API_SUCCESS_CODE) {
      throw new Error(saveResult.msg || 'Failed to save user systems')
    }
    await refreshUserAssignment(userId)
  }

  return {
    allUsers,
    userSystemMap,
    loading,
    isSuperAdminUser,
    userHasSystem,
    countUsersForSystem,
    loadMatrix,
    refreshUserAssignment,
    filterUsersForSystem,
    addUsersToSystem,
    removeUsersFromSystem,
    saveUserSystems,
  }
}

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getServerLinksApi, listComponentApi, listProjectApi, saveServerLinksApi } from '@/api/operation'
import AppModal from '@/components/ui/AppModal.vue'
import { guardAction } from '@/composables/useActionPermissions'
import { showToast } from '@/composables/useToast'
import { PERM } from '@/constants/permissions'
import { API_SUCCESS_CODE } from '@/types/api'
import type { OperationComponent, OperationProject } from '@/types/operation'

const props = defineProps<{
  open: boolean
  serverId: number | string | null
  serverName?: string
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const { t } = useI18n()

const loading = ref(false)
const saving = ref(false)
const linkProjectIds = ref<string[]>([])
const linkComponentIds = ref<string[]>([])
const allProjects = ref<OperationProject[]>([])
const allComponents = ref<OperationComponent[]>([])
const linkProjectSearch = ref('')
const linkComponentSearch = ref('')

const title = computed(() =>
  props.serverName
    ? t('operation.server.topologyTitle', { name: props.serverName })
    : t('operation.server.editLinks'),
)

function matchesLinkSearch(keyword: string, ...fields: Array<string | undefined | null>) {
  const q = keyword.trim().toLowerCase()
  if (!q) return true
  return fields.some((field) => field?.toLowerCase().includes(q))
}

const filteredLinkProjects = computed(() => {
  const selected = new Set(linkProjectIds.value)
  return allProjects.value.filter((item) => {
    const id = item.id != null ? String(item.id) : ''
    if (selected.has(id)) return true
    return matchesLinkSearch(linkProjectSearch.value, item.projectName, item.serverIp, item.port)
  })
})

const filteredLinkComponents = computed(() => {
  const selected = new Set(linkComponentIds.value)
  return allComponents.value.filter((item) => {
    const id = item.id != null ? String(item.id) : ''
    if (selected.has(id)) return true
    return matchesLinkSearch(linkComponentSearch.value, item.componentName, item.serverIp, item.port)
  })
})

function toggleLinkId(ids: string[], id: string | number | undefined, checked: boolean) {
  if (id == null) return
  const key = String(id)
  if (checked) {
    if (!ids.includes(key)) ids.push(key)
  } else {
    const idx = ids.indexOf(key)
    if (idx >= 0) ids.splice(idx, 1)
  }
}

function isLinkSelected(ids: string[], id: string | number | undefined) {
  return id != null && ids.includes(String(id))
}

async function loadLinks() {
  if (props.serverId == null) return
  loading.value = true
  linkProjectSearch.value = ''
  linkComponentSearch.value = ''
  linkProjectIds.value = []
  linkComponentIds.value = []
  allProjects.value = []
  allComponents.value = []
  try {
    const [linksRes, projectsRes, componentsRes] = await Promise.all([
      getServerLinksApi(props.serverId),
      listProjectApi({ pageNum: 1, pageSize: 500 }),
      listComponentApi({ pageNum: 1, pageSize: 500 }),
    ])
    if (linksRes.code !== API_SUCCESS_CODE || !linksRes.data) throw new Error(linksRes.msg || t('operation.server.linksLoadFailed'))
    if (projectsRes.code !== API_SUCCESS_CODE || !projectsRes.data) throw new Error(projectsRes.msg || t('operation.project.loadFailed'))
    if (componentsRes.code !== API_SUCCESS_CODE || !componentsRes.data) throw new Error(componentsRes.msg || t('operation.component.loadFailed'))
    linkProjectIds.value = (linksRes.data.projectIds ?? []).map(String)
    linkComponentIds.value = (linksRes.data.componentIds ?? []).map(String)
    allProjects.value = projectsRes.data.list ?? []
    allComponents.value = componentsRes.data.list ?? []
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.server.linksLoadFailed'))
    emit('close')
  } finally {
    loading.value = false
  }
}

async function saveLinks() {
  if (!guardAction(PERM.OP_SERVER_EDIT) || props.serverId == null) return
  saving.value = true
  try {
    const result = await saveServerLinksApi(props.serverId, {
      serverId: props.serverId,
      projectIds: linkProjectIds.value,
      componentIds: linkComponentIds.value,
    })
    if (result.code !== API_SUCCESS_CODE) throw new Error(result.msg || t('operation.server.linksSaveFailed'))
    showToast('success', t('operation.server.linksSaveOk'))
    emit('saved')
    emit('close')
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.server.linksSaveFailed'))
  } finally {
    saving.value = false
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) void loadLinks()
  },
)
</script>

<template>
  <AppModal :open="open" :title="title" wide @close="emit('close')">
    <p class="mb-4 text-sm text-gray-500">{{ t('operation.server.editLinksHint') }}</p>
    <div v-if="loading" class="py-10 text-center text-gray-400">{{ t('operation.common.loading') }}</div>
    <div v-else class="space-y-6">
      <section>
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold">
            {{ t('operation.server.topologyProjects') }}
            <span class="font-normal text-gray-400">({{ linkProjectIds.length }}/{{ allProjects.length }})</span>
          </h3>
          <input
            v-model="linkProjectSearch"
            type="search"
            class="field-input max-w-xs text-sm"
            :placeholder="t('operation.server.linkSearchPlaceholder')"
          />
        </div>
        <div v-if="!allProjects.length" class="text-sm text-gray-400">{{ t('operation.common.empty') }}</div>
        <div v-else-if="!filteredLinkProjects.length" class="text-sm text-gray-400">{{ t('operation.server.linkSearchEmpty') }}</div>
        <div v-else class="max-h-48 space-y-2 overflow-y-auto rounded border border-gray-100 p-3 dark:border-white/10">
          <label v-for="p in filteredLinkProjects" :key="String(p.id)" class="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              :checked="isLinkSelected(linkProjectIds, p.id)"
              @change="toggleLinkId(linkProjectIds, p.id, ($event.target as HTMLInputElement).checked)"
            />
            <span>{{ p.projectName }}</span>
            <span class="text-gray-400">· {{ p.serverIp || '-' }} · {{ p.port || '-' }}</span>
          </label>
        </div>
      </section>
      <section>
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold">
            {{ t('operation.server.topologyComponents') }}
            <span class="font-normal text-gray-400">({{ linkComponentIds.length }}/{{ allComponents.length }})</span>
          </h3>
          <input
            v-model="linkComponentSearch"
            type="search"
            class="field-input max-w-xs text-sm"
            :placeholder="t('operation.server.linkSearchPlaceholder')"
          />
        </div>
        <div v-if="!allComponents.length" class="text-sm text-gray-400">{{ t('operation.common.empty') }}</div>
        <div v-else-if="!filteredLinkComponents.length" class="text-sm text-gray-400">{{ t('operation.server.linkSearchEmpty') }}</div>
        <div v-else class="max-h-48 space-y-2 overflow-y-auto rounded border border-gray-100 p-3 dark:border-white/10">
          <label v-for="c in filteredLinkComponents" :key="String(c.id)" class="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              :checked="isLinkSelected(linkComponentIds, c.id)"
              @change="toggleLinkId(linkComponentIds, c.id, ($event.target as HTMLInputElement).checked)"
            />
            <span>{{ c.componentName }}</span>
            <span class="text-gray-400">· {{ c.serverIp || '-' }} · {{ c.port || '-' }}</span>
          </label>
        </div>
      </section>
    </div>
    <template #footer>
      <button type="button" class="btn-ghost" :disabled="saving" @click="emit('close')">{{ t('operation.common.cancel') }}</button>
      <button type="button" class="btn-primary" :disabled="saving || loading" @click="saveLinks">
        {{ saving ? t('operation.common.saving') : t('operation.common.save') }}
      </button>
    </template>
  </AppModal>
</template>

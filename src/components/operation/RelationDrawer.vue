<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { getRelationsApi } from '@/api/operation'
import EnvironmentBadge from '@/components/operation/EnvironmentBadge.vue'
import HealthStatusBadge from '@/components/operation/HealthStatusBadge.vue'
import PortMatchBadge from '@/components/operation/PortMatchBadge.vue'
import ServerDetailModal from '@/components/operation/ServerDetailModal.vue'
import ServerRoleBadge from '@/components/operation/ServerRoleBadge.vue'
import ServerTagsBadges from '@/components/operation/ServerTagsBadges.vue'
import AppModal from '@/components/ui/AppModal.vue'
import { showToast, formatDateTime } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import type { OperationRelationEntityType, OperationRelations } from '@/types/operation'

export type RelationDrawerTab = 'servers' | 'projects' | 'components' | 'tasks'

const props = defineProps<{
  open: boolean
  entityType: OperationRelationEntityType
  entityId: number | string | null
  initialTab?: RelationDrawerTab
  entityName?: string
}>()

const emit = defineEmits<{
  close: []
  editLinks: []
}>()

const { t } = useI18n()
const router = useRouter()

const loading = ref(false)
const data = ref<OperationRelations | null>(null)
const activeTab = ref<RelationDrawerTab>('servers')
const serverDetailOpen = ref(false)
const serverDetailId = ref<number | string | null>(null)

const title = computed(() => {
  const name = data.value?.entity?.name || props.entityName || ''
  return name ? t('operation.relations.drawerTitleNamed', { name }) : t('operation.relations.drawerTitle')
})

const tabs = computed((): RelationDrawerTab[] => {
  if (props.entityType === 'server') return ['projects', 'components', 'tasks']
  if (props.entityType === 'project') return ['servers', 'components', 'tasks']
  return ['servers', 'projects', 'tasks']
})

function tabLabel(tab: RelationDrawerTab) {
  const counts: Record<RelationDrawerTab, number> = {
    servers: data.value?.servers?.length ?? 0,
    projects: data.value?.projects?.length ?? 0,
    components: data.value?.components?.length ?? 0,
    tasks: data.value?.recentTasks?.length ?? 0,
  }
  return `${t(`operation.relations.tab.${tab}`)} (${counts[tab]})`
}

async function load() {
  if (props.entityId == null) return
  loading.value = true
  try {
    const result = await getRelationsApi(props.entityType, props.entityId)
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('operation.relations.loadFailed'))
    }
    data.value = result.data
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.relations.loadFailed'))
    data.value = null
  } finally {
    loading.value = false
  }
}

function openServerDetail(id?: number) {
  if (id == null) return
  serverDetailId.value = id
  serverDetailOpen.value = true
}

function locateServer(id?: number) {
  if (id == null) return
  emit('close')
  void router.push({ path: '/operation/server', query: { serverId: String(id) } })
}

function locateProject(id?: number) {
  if (id == null) return
  emit('close')
  void router.push({ path: '/operation/project', query: { projectId: String(id) } })
}

function locateComponent(id?: number) {
  if (id == null) return
  emit('close')
  void router.push({ path: '/operation/component', query: { componentId: String(id) } })
}

function openTopology() {
  if (props.entityId == null) return
  const prefix = props.entityType === 'server' ? 's' : props.entityType === 'project' ? 'p' : 'c'
  emit('close')
  void router.push({ path: '/operation/topology', query: { focus: `${prefix}-${props.entityId}` } })
}

watch(
  () => [props.open, props.entityType, props.entityId] as const,
  ([open]) => {
    if (!open) return
    const tab = props.initialTab && tabs.value.includes(props.initialTab) ? props.initialTab : tabs.value[0]
    activeTab.value = tab ?? 'servers'
    void load()
  },
)
</script>

<template>
  <AppModal :open="open" :title="title" extra-wide @close="emit('close')">
    <div v-if="loading" class="py-10 text-center text-gray-400">{{ t('operation.common.loading') }}</div>
    <template v-else-if="data">
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <span class="font-medium text-gray-800 dark:text-gray-100">{{ data.entity?.name || '—' }}</span>
        <EnvironmentBadge v-if="data.entity?.environment != null" :environment="data.entity.environment" size="sm" />
      </div>

      <div class="mb-4 flex flex-wrap gap-2 border-b border-gray-100 pb-2 dark:border-white/10">
        <button
          v-for="tab in tabs"
          :key="tab"
          type="button"
          class="rounded-md px-3 py-1.5 text-sm transition"
          :class="activeTab === tab
            ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
            : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5'"
          @click="activeTab = tab"
        >
          {{ tabLabel(tab) }}
        </button>
      </div>

      <div v-if="activeTab === 'servers'" class="space-y-2">
        <p v-if="!data.servers?.length" class="text-sm text-gray-400">{{ t('operation.common.empty') }}</p>
        <div
          v-for="srv in data.servers"
          :key="String(srv.id)"
          class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2.5 dark:border-white/10"
        >
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-medium">{{ srv.serverName || srv.ip }}</span>
              <span v-if="srv.primary" class="text-xs text-brand-600 dark:text-brand-400">{{ t('operation.serverMulti.primaryServer') }}</span>
              <EnvironmentBadge :environment="srv.environment" size="sm" />
              <ServerRoleBadge v-if="srv.serverRole" :server-role="srv.serverRole" size="sm" />
              <HealthStatusBadge :status="srv.status" />
            </div>
            <p class="mt-1 text-xs text-gray-400">{{ srv.innerIp || srv.ip }}</p>
            <ServerTagsBadges v-if="srv.tags?.length" :tags="srv.tags" size="sm" class="mt-1" />
          </div>
          <div class="flex shrink-0 gap-2">
            <button type="button" class="btn-ghost text-xs" @click="openServerDetail(srv.id)">{{ t('operation.relations.detail') }}</button>
            <button type="button" class="btn-ghost text-xs" @click="locateServer(srv.id)">{{ t('operation.relations.locate') }}</button>
          </div>
        </div>
      </div>

      <div v-else-if="activeTab === 'projects'" class="space-y-2">
        <p v-if="!data.projects?.length" class="text-sm text-gray-400">{{ t('operation.common.empty') }}</p>
        <div
          v-for="p in data.projects"
          :key="String(p.id)"
          class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2.5 dark:border-white/10"
        >
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-medium">{{ p.projectName }}</span>
              <EnvironmentBadge :environment="p.environment" size="sm" />
              <PortMatchBadge :status="p.portMatchStatus" :expected-port="p.port" />
            </div>
          </div>
          <button type="button" class="btn-ghost shrink-0 text-xs" @click="locateProject(p.id)">{{ t('operation.relations.locate') }}</button>
        </div>
      </div>

      <div v-else-if="activeTab === 'components'" class="space-y-2">
        <p v-if="!data.components?.length" class="text-sm text-gray-400">{{ t('operation.common.empty') }}</p>
        <div
          v-for="c in data.components"
          :key="String(c.id)"
          class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2.5 dark:border-white/10"
        >
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-medium">{{ c.componentName }}</span>
              <EnvironmentBadge :environment="c.environment" size="sm" />
              <HealthStatusBadge :status="c.status" />
              <PortMatchBadge :status="c.portMatchStatus" :expected-port="c.port" />
            </div>
            <p v-if="c.version" class="mt-1 text-xs text-gray-400">{{ c.version }}</p>
          </div>
          <button type="button" class="btn-ghost shrink-0 text-xs" @click="locateComponent(c.id)">{{ t('operation.relations.locate') }}</button>
        </div>
      </div>

      <div v-else class="space-y-2">
        <p v-if="!data.recentTasks?.length" class="text-sm text-gray-400">{{ t('operation.common.empty') }}</p>
        <div
          v-for="task in data.recentTasks"
          :key="String(task.id)"
          class="rounded-lg border border-gray-100 px-3 py-2.5 text-sm dark:border-white/10"
        >
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-medium">{{ task.action || task.taskType }}</span>
            <span class="text-gray-400">{{ task.status }}</span>
          </div>
          <p class="mt-1 text-xs text-gray-400">
            {{ task.targetName || '—' }} · {{ formatDateTime(task.createTime) }}
          </p>
        </div>
      </div>
    </template>

    <template #footer>
      <button type="button" class="btn-ghost" @click="emit('close')">{{ t('operation.common.cancel') }}</button>
      <button type="button" class="btn-ghost" @click="openTopology">{{ t('operation.relations.openTopology') }}</button>
      <button type="button" class="btn-primary" @click="emit('editLinks')">{{ t('operation.relations.editLinks') }}</button>
    </template>
  </AppModal>

  <ServerDetailModal :open="serverDetailOpen" :server-id="serverDetailId" @close="serverDetailOpen = false" />
</template>

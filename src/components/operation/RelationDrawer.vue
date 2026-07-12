<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { getRelationsApi, listProjectApi, listServerApi } from '@/api/operation'
import DeployTaskDrawer from '@/components/operation/DeployTaskDrawer.vue'
import EnvironmentBadge from '@/components/operation/EnvironmentBadge.vue'
import HealthStatusBadge from '@/components/operation/HealthStatusBadge.vue'
import OperationTaskStatusBadge from '@/components/operation/OperationTaskStatusBadge.vue'
import PortMatchBadge from '@/components/operation/PortMatchBadge.vue'
import ServerDetailModal from '@/components/operation/ServerDetailModal.vue'
import ServerRoleBadge from '@/components/operation/ServerRoleBadge.vue'
import ServerTagsBadges from '@/components/operation/ServerTagsBadges.vue'
import AppModal from '@/components/ui/AppModal.vue'
import { useOperationTaskPoll } from '@/composables/useOperationTaskPoll'
import { showToast, formatDateTime } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import type {
  Environment,
  OperationRelationEntityType,
  OperationRelationProjectItem,
  OperationRelations,
} from '@/types/operation'

export type RelationDrawerTab = 'servers' | 'projects' | 'components' | 'tasks'

const props = defineProps<{
  open: boolean
  entityType: OperationRelationEntityType
  entityId: number | string | null
  initialTab?: RelationDrawerTab
  entityName?: string
  entityEnvironment?: Environment | number | null
  /** 管理页可编辑关联；导航页（28e）传 false 隐藏编辑按钮 */
  showEditLinks?: boolean
}>()

const emit = defineEmits<{
  close: []
  editLinks: []
}>()

const { t } = useI18n()
const router = useRouter()
const { drawerOpen: taskDrawerOpen, task: taskDetail, logText: taskLogText, polling: taskPolling, openTask, closeDrawer: closeTaskDrawer } = useOperationTaskPoll()

const loading = ref(false)
const data = ref<OperationRelations | null>(null)
const activeTab = ref<RelationDrawerTab>('servers')
const serverDetailOpen = ref(false)
const serverDetailId = ref<number | string | null>(null)

const isPlatform = computed(() => props.entityType === 'platform')

const title = computed(() => {
  const name = data.value?.entity?.name || props.entityName || ''
  return name ? t('operation.relations.drawerTitleNamed', { name }) : t('operation.relations.drawerTitle')
})

const tabs = computed((): RelationDrawerTab[] => {
  if (props.entityType === 'platform') return ['servers', 'projects']
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

function deployRunningLabel(project: OperationRelationProjectItem) {
  if (project.deployRunning == null) return t('operation.deploy.unknown')
  return project.deployRunning ? t('operation.deploy.running') : t('operation.deploy.stopped')
}

function deployRunningClass(project: OperationRelationProjectItem) {
  if (project.deployRunning == null) return 'border-gray-200 bg-gray-50 text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300'
  return project.deployRunning
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
    : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300'
}

async function loadPlatformAssets() {
  const env = props.entityEnvironment ?? data.value?.entity?.environment
  if (env == null || props.entityId == null) return
  loading.value = true
  try {
    const [serversRes, projectsRes] = await Promise.all([
      listServerApi({ environment: env as Environment, pageNum: 1, pageSize: 200 }),
      listProjectApi({ environment: env as Environment, pageNum: 1, pageSize: 200 }),
    ])
    if (serversRes.code !== API_SUCCESS_CODE || !serversRes.data) throw new Error(serversRes.msg || t('operation.server.loadFailed'))
    if (projectsRes.code !== API_SUCCESS_CODE || !projectsRes.data) throw new Error(projectsRes.msg || t('operation.project.loadFailed'))
    data.value = {
      entityType: 'platform',
      entity: {
        id: Number(props.entityId),
        name: props.entityName,
        environment: env as Environment,
      },
      servers: (serversRes.data.list ?? []).map((srv) => ({
        id: Number(srv.id),
        serverName: srv.serverName,
        ip: srv.ip,
        innerIp: srv.innerIp,
        environment: srv.environment,
        serverRole: srv.serverRole,
        tags: srv.tags,
        status: srv.status,
      })),
      projects: (projectsRes.data.list ?? []).map((project) => ({
        id: Number(project.id),
        projectName: project.projectName,
        port: project.port,
        environment: project.environment,
        deployRunning: project.deployRunning,
        portMatchStatus: project.portMatchStatus,
      })),
      components: [],
      recentTasks: [],
    }
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.relations.loadFailed'))
    data.value = null
  } finally {
    loading.value = false
  }
}

async function load() {
  if (props.entityId == null) return
  if (props.entityType === 'platform') {
    await loadPlatformAssets()
    return
  }
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
  if (props.entityType === 'platform') {
    emit('close')
    void router.push({ path: '/operation/server', query: { environment: String(props.entityEnvironment ?? '') } })
    return
  }
  const prefix = props.entityType === 'server' ? 's' : props.entityType === 'project' ? 'p' : 'c'
  emit('close')
  void router.push({ path: '/operation/topology', query: { focus: `${prefix}-${props.entityId}` } })
}

function openTaskLog(taskId?: number | string) {
  if (taskId == null) return
  openTask(taskId)
}

watch(
  () => [props.open, props.entityType, props.entityId, props.entityEnvironment] as const,
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
      <p v-if="isPlatform" class="mb-4 text-xs text-gray-400">{{ t('operation.relations.platformEnvHint') }}</p>

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
              <span class="badge text-xs" :class="deployRunningClass(p)">{{ deployRunningLabel(p) }}</span>
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
        <button
          v-for="task in data.recentTasks"
          :key="String(task.id)"
          type="button"
          class="w-full rounded-lg border border-gray-100 px-3 py-2.5 text-left text-sm transition hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"
          @click="openTaskLog(task.id)"
        >
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-medium">{{ task.action || task.taskType }}</span>
            <OperationTaskStatusBadge :status="task.status" />
          </div>
          <p class="mt-1 text-xs text-gray-400">
            {{ task.targetName || '—' }} · {{ formatDateTime(task.createTime) }}
          </p>
        </button>
      </div>
    </template>

    <template #footer>
      <button type="button" class="btn-ghost" @click="emit('close')">{{ t('operation.common.cancel') }}</button>
      <button type="button" class="btn-ghost" @click="openTopology">
        {{ isPlatform ? t('operation.relations.locateEnv') : t('operation.relations.openTopology') }}
      </button>
      <button v-if="props.showEditLinks !== false && !isPlatform" type="button" class="btn-primary" @click="emit('editLinks')">{{ t('operation.relations.editLinks') }}</button>
    </template>
  </AppModal>

  <ServerDetailModal :open="serverDetailOpen" :server-id="serverDetailId" @close="serverDetailOpen = false" />
  <DeployTaskDrawer
    :open="taskDrawerOpen"
    :task="taskDetail"
    :log-text="taskLogText"
    :polling="taskPolling"
    @close="closeTaskDrawer"
  />
</template>

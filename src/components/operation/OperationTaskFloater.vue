<script setup lang="ts">
import { ChevronDown, Loader2, Minimize2, ChevronUp } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import {
  type OperationTaskSession,
  useOperationTaskHub,
} from '@/composables/operationTaskHub'

const { t } = useI18n()
const {
  backgroundSessions,
  floaterExpanded,
  runningBackgroundCount,
  hasBackgroundSessions,
  toggleFloater,
  toggleSessionExpand,
} = useOperationTaskHub()

function sessionTitle(session: OperationTaskSession) {
  const task = session.task.value
  if (!task) return t('operation.task.drawerTitle')
  const typeKey = task.taskType ? (`operation.task.type.${task.taskType}` as const) : null
  const typeLabel = typeKey ? t(typeKey) : ''
  const parts = [typeLabel !== typeKey ? typeLabel : task.taskType, task.targetName].filter(Boolean)
  return parts.length ? parts.join(' · ') : t('operation.task.drawerTitle')
}

function statusLabel(session: OperationTaskSession) {
  const s = session.task.value?.status
  if (!s) return '-'
  return t(`operation.task.status.${s}` as const)
}

function statusClass(session: OperationTaskSession) {
  const s = session.task.value?.status
  if (s === 'success') return 'operation-task-floater__status--success'
  if (s === 'failed') return 'operation-task-floater__status--failed'
  if (s === 'cancelled') return 'operation-task-floater__status--cancelled'
  if (s === 'running') return 'operation-task-floater__status--running'
  return ''
}

function canCancel(session: OperationTaskSession) {
  const s = session.task.value?.status
  return !session.task.value?.finished && (s === 'pending' || s === 'running')
}

function canDismiss(session: OperationTaskSession) {
  return Boolean(session.task.value?.finished) || !session.polling.value
}

function progressValue(session: OperationTaskSession) {
  return Math.min(100, Math.max(0, session.task.value?.progress ?? 0))
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="hasBackgroundSessions"
      class="operation-task-floater"
      :class="floaterExpanded && 'operation-task-floater--expanded'"
    >
      <button
        type="button"
        class="operation-task-floater__header"
        @click="toggleFloater"
      >
        <span class="operation-task-floater__header-left">
          <Loader2 v-if="runningBackgroundCount > 0" class="h-4 w-4 animate-spin text-brand-500" />
          <span class="font-medium">
            {{ t('operation.task.backgroundPanelTitle', { count: backgroundSessions.length }) }}
          </span>
          <span v-if="runningBackgroundCount > 0" class="operation-task-floater__badge">
            {{ t('operation.task.backgroundRunningCount', { count: runningBackgroundCount }) }}
          </span>
        </span>
        <span class="operation-task-floater__header-actions">
          <Minimize2 v-if="floaterExpanded" class="h-4 w-4" />
          <ChevronUp v-else class="h-4 w-4" />
        </span>
      </button>

      <div v-show="floaterExpanded" class="operation-task-floater__body">
        <div
          v-for="session in backgroundSessions"
          :key="String(session.sessionId)"
          class="operation-task-floater__item"
          :class="session.expandedInFloater && 'operation-task-floater__item--open'"
        >
          <button
            type="button"
            class="operation-task-floater__item-head"
            @click="toggleSessionExpand(session)"
          >
            <div class="min-w-0 flex-1 text-left">
              <p class="truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                {{ sessionTitle(session) }}
              </p>
              <p class="mt-0.5 text-xs" :class="statusClass(session)">{{ statusLabel(session) }}</p>
            </div>
            <div class="ml-3 w-24 shrink-0">
              <div class="operation-task-progress operation-task-progress--sm">
                <div
                  class="operation-task-progress__bar operation-task-progress__bar--running"
                  :style="{ width: `${progressValue(session)}%` }"
                />
              </div>
              <p class="mt-1 text-right text-[10px] tabular-nums text-gray-400">{{ progressValue(session) }}%</p>
            </div>
            <ChevronDown
              class="ml-2 h-4 w-4 shrink-0 text-gray-400 transition"
              :class="session.expandedInFloater && 'rotate-180'"
            />
          </button>

          <div v-if="session.expandedInFloater" class="operation-task-floater__item-detail">
            <div
              class="max-h-40 overflow-y-auto rounded-lg bg-gray-900 p-2 font-mono text-[11px] leading-relaxed text-green-400 ring-1 ring-gray-800"
            >
              <pre class="whitespace-pre-wrap break-all">{{ session.logText.value || t('operation.task.logEmpty') }}</pre>
            </div>
            <div class="mt-2 flex flex-wrap justify-end gap-2">
              <button
                v-if="canCancel(session)"
                type="button"
                class="btn-danger text-xs"
                :disabled="session.cancelling.value"
                @click="session.cancelTask()"
              >
                {{ session.cancelling.value ? t('operation.task.cancelling') : t('operation.task.cancelTask') }}
              </button>
              <button type="button" class="btn-ghost text-xs" @click="session.reopenDrawer()">
                {{ t('operation.task.backgroundOpenDrawer') }}
              </button>
              <button
                v-if="canDismiss(session)"
                type="button"
                class="btn-ghost text-xs"
                @click="session.dismissFromFloater()"
              >
                {{ t('operation.task.backgroundDismiss') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

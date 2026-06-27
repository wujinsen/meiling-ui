<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loader2, RefreshCw } from 'lucide-vue-next'
import { triggerKbSyncApi } from '@/api/knowledge'
import KbSyncPanel from '@/components/knowledge/KbSyncPanel.vue'
import { useKbSpace } from '@/composables/useKbSpace'
import { assertAction, guardActionWithRefresh } from '@/composables/useActionPermissions'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import { PERM } from '@/constants/permissions'

const props = defineProps<{
  syncReady: boolean
  relintDone: boolean
  strict: boolean
  canEdit: boolean
}>()

const emit = defineEmits<{
  synced: []
}>()

const { t } = useI18n()
const { selectedSpace, kbSpaceQuery } = useKbSpace()
const syncPanelRef = ref<InstanceType<typeof KbSyncPanel> | null>(null)
const showLogs = ref(false)
const triggering = ref(false)

const canSync = computed(() => assertAction(PERM.KB_SYNC_TRIGGER))

async function triggerSync() {
  if (!props.syncReady || !props.canEdit || triggering.value) return
  const allowed =
    assertAction(PERM.KB_SYNC_TRIGGER) ||
    (await guardActionWithRefresh(PERM.KB_SYNC_TRIGGER))
  if (!allowed) return

  triggering.value = true
  try {
    const scope = kbSpaceQuery()
    const params: { spaceId?: number | string; spaceCode?: string } = {}
    if (scope.spaceId != null) params.spaceId = scope.spaceId
    else if (scope.spaceCode) params.spaceCode = scope.spaceCode
    else if (selectedSpace.value?.spaceCode) params.spaceCode = selectedSpace.value.spaceCode
    else params.spaceCode = 'enterprise-kb'

    const res = await triggerKbSyncApi(params)
    if (res.code === API_SUCCESS_CODE && res.data?.success) {
      showToast('success', t('knowledge.sync.triggerOk'))
      emit('synced')
      await syncPanelRef.value?.refreshAll()
    } else {
      const code = res.data?.exitCode ?? '?'
      showToast('error', t('knowledge.sync.triggerFailed', { code }))
    }
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.sync.triggerFailed', { code: '?' }))
  } finally {
    triggering.value = false
  }
}
</script>

<template>
  <section class="rounded-xl border border-gray-200 bg-white dark:border-white/10 dark:bg-gray-900/40">
    <header class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-white/5">
      <div>
        <h2 class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ t('knowledge.wikiGovern.syncTitle') }}
        </h2>
        <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {{ t('knowledge.wikiGovern.syncHint') }}
        </p>
      </div>
      <button
        type="button"
        class="btn-primary shrink-0 text-sm"
        :disabled="!canEdit || !canSync || !syncReady || triggering"
        :title="!syncReady ? t('knowledge.wikiGovern.syncBlocked') : undefined"
        @click="triggerSync"
      >
        <Loader2 v-if="triggering" class="h-4 w-4 animate-spin" />
        <RefreshCw v-else class="h-4 w-4" />
        {{ t('knowledge.sync.trigger') }}
      </button>
    </header>

    <div class="space-y-3 px-4 py-4">
      <p v-if="!canSync" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
        {{ t('knowledge.sync.noPerm') }}
      </p>

      <p
        v-if="!relintDone"
        class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
      >
        {{ t('knowledge.wikiGovern.syncNeedRelint') }}
      </p>
      <p
        v-else-if="!syncReady"
        class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
      >
        {{
          strict
            ? t('knowledge.wikiGovern.syncBlockedStrict')
            : t('knowledge.wikiGovern.syncBlockedErrors')
        }}
      </p>
      <p
        v-else
        class="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
      >
        {{ t('knowledge.wikiGovern.syncReady') }}
      </p>

      <p class="text-xs text-gray-400">{{ t('knowledge.wikiGovern.syncUnsyncedHint') }}</p>

      <button
        type="button"
        class="text-xs text-brand-600 hover:underline dark:text-brand-400"
        @click="showLogs = !showLogs"
      >
        {{ showLogs ? t('knowledge.wikiGovern.syncHideLogs') : t('knowledge.wikiGovern.syncShowLogs') }}
      </button>
      <KbSyncPanel v-if="showLogs" ref="syncPanelRef" />
    </div>
  </section>
</template>

import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { probeAllHealthApi } from '@/api/operation'
import { useOperationTaskPoll } from '@/composables/useOperationTaskPoll'
import { showToast } from '@/composables/useToast'
import { operationErrorI18nKey } from '@/constants/operationErrors'
import { API_SUCCESS_CODE } from '@/types/api'

type UseProbeAllHealthOptions = {
  onFinished?: () => void | Promise<void>
}

export function useProbeAllHealth(options: UseProbeAllHealthOptions = {}) {
  const { t } = useI18n()
  const starting = ref(false)
  const poll = useOperationTaskPoll()

  const busy = computed(() => starting.value || poll.polling.value)

  function resolveErrorMessage(code?: number, msg?: string) {
    const key = operationErrorI18nKey(code)
    if (key) return t(key)
    return msg || t('operation.health.probeAllFailed')
  }

  async function probeAll() {
    starting.value = true
    try {
      const result = await probeAllHealthApi()
      if (result.code !== API_SUCCESS_CODE || result.data == null) {
        throw new Error(resolveErrorMessage(result.code, result.msg))
      }
      showToast('success', t('operation.health.probeAllStarted'))
      poll.openTask(result.data, {
        onFinished: async () => {
          await options.onFinished?.()
          showToast('success', t('operation.health.probeAllFinished'))
        },
      })
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : t('operation.health.probeAllFailed'))
    } finally {
      starting.value = false
    }
  }

  return {
    ...poll,
    probeAll,
    busy,
    resolveErrorMessage,
  }
}

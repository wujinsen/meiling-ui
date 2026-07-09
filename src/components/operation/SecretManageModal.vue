<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppModal from '@/components/ui/AppModal.vue'
import { guardAction, guardActionWithRefresh } from '@/composables/useActionPermissions'
import { showToast } from '@/composables/useToast'
import { PERM } from '@/constants/permissions'
import { API_SUCCESS_CODE } from '@/types/api'
import { ClipboardCopy, Eye, EyeOff } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  saving?: boolean
  passwordConfigured?: boolean
  passwordMask?: string | null
  revealApi?: (id: number | string) => Promise<{ code: number; data?: { password?: string }; msg?: string }>
  recordId?: number | string
  entityName?: string
}>()

const emit = defineEmits<{
  close: []
  save: [password: string]
}>()

const { t } = useI18n()
const revealing = ref(false)
const revealedPlain = ref<string | null>(null)
const draftPassword = ref('')

const canReveal = computed(
  () => props.passwordConfigured && props.revealApi != null && props.recordId != null,
)

watch(
  () => props.open,
  (open) => {
    if (!open) {
      revealedPlain.value = null
      draftPassword.value = ''
    }
  },
)

async function revealPlain() {
  if (!props.revealApi || props.recordId == null) return
  if (!guardAction(PERM.OP_SECRET_VIEW) && !(await guardActionWithRefresh(PERM.OP_SECRET_VIEW))) return
  revealing.value = true
  try {
    const result = await props.revealApi(props.recordId)
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('operation.common.passwordRevealFailed'))
    }
    const plain = (result.data.password ?? '').trim()
    if (!plain) {
      throw new Error(t('operation.common.passwordRevealEmpty'))
    }
    revealedPlain.value = plain
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.common.passwordRevealFailed'))
  } finally {
    revealing.value = false
  }
}

function hideRevealed() {
  revealedPlain.value = null
}

async function copyPlain() {
  if (!revealedPlain.value) return
  try {
    await navigator.clipboard.writeText(revealedPlain.value)
    showToast('success', t('operation.common.passwordCopied'))
  } catch {
    showToast('error', t('operation.common.passwordCopyFailed'))
  }
}

function submitPassword() {
  const value = draftPassword.value.trim()
  if (!value) {
    showToast('error', t('operation.common.passwordPlaceholderEmpty'))
    return
  }
  emit('save', value)
}
</script>

<template>
  <AppModal
    :open="open"
    :title="t('operation.common.passwordManageTitle')"
    wide
    @close="emit('close')"
  >
    <p v-if="entityName" class="mb-4 text-sm text-gray-500 dark:text-gray-400">
      {{ t('operation.common.passwordManageFor', { name: entityName }) }}
    </p>

    <div class="space-y-4">
      <section
        v-if="passwordConfigured"
        class="rounded-xl border border-gray-100 bg-gray-50/60 p-4 dark:border-white/10 dark:bg-white/5"
      >
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-medium text-gray-800 dark:text-gray-100">
            {{ t('operation.common.passwordViewSection') }}
          </h3>
          <div v-if="canReveal" class="flex flex-wrap gap-1.5">
            <button
              type="button"
              class="btn-ghost text-xs"
              :disabled="revealing"
              @click="revealedPlain ? hideRevealed() : revealPlain()"
            >
              <component :is="revealedPlain ? EyeOff : Eye" class="h-3.5 w-3.5" />
              {{ revealedPlain ? t('operation.common.passwordHide') : t('operation.common.passwordReveal') }}
            </button>
            <button
              v-if="revealedPlain"
              type="button"
              class="btn-ghost text-xs"
              @click="copyPlain"
            >
              <ClipboardCopy class="h-3.5 w-3.5" />
              {{ t('operation.common.passwordCopy') }}
            </button>
          </div>
        </div>

        <p v-if="!revealedPlain" class="text-sm text-gray-500">
          {{ t('operation.common.passwordConfigured', { mask: passwordMask || '****' }) }}
        </p>
        <textarea
          v-else
          :value="revealedPlain"
          readonly
          rows="3"
          class="field-input w-full resize-y font-mono text-sm"
          @focus="($event.target as HTMLTextAreaElement).select()"
        />
        <p v-if="revealedPlain" class="mt-2 text-xs text-gray-400">{{ t('operation.common.passwordRevealedHint') }}</p>
      </section>

      <section class="rounded-xl border border-gray-100 p-4 dark:border-white/10">
        <h3 class="mb-3 text-sm font-medium text-gray-800 dark:text-gray-100">
          {{ passwordConfigured ? t('operation.common.passwordChangeSection') : t('operation.common.passwordSetSection') }}
        </h3>
        <input
          v-model="draftPassword"
          type="password"
          class="field-input w-full"
          :placeholder="passwordConfigured ? t('operation.common.passwordPlaceholderReplace') : t('operation.common.passwordPlaceholderEmpty')"
          autocomplete="new-password"
          @keyup.enter="submitPassword"
        />
        <p class="mt-2 text-xs text-gray-400">{{ t('operation.common.passwordSaveHint') }}</p>
      </section>
    </div>

    <template #footer>
      <button type="button" class="btn-ghost" :disabled="saving" @click="emit('close')">
        {{ t('operation.common.cancel') }}
      </button>
      <button type="button" class="btn-primary" :disabled="saving" @click="submitPassword">
        {{ saving ? t('operation.common.saving') : t('operation.common.passwordSave') }}
      </button>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import FormField from '@/components/ui/FormField.vue'
import { useProfile } from '@/composables/useProfile'
import { useAuth } from '@/composables/useAuth'
import { useLocale } from '@/i18n'

const { t } = useI18n()
const { displayName } = useAuth()
const { options: localeOptions } = useLocale()

const {
  loading,
  saving,
  activeTab,
  profile,
  form,
  passwordForm,
  load,
  saveBasic,
  changePassword,
  resetPasswordForm,
} = useProfile()

const userInitial = computed(() => (displayName.value || profile.value?.userName || 'U').charAt(0).toUpperCase())

const sexOptions = computed(() => [
  { value: 0, label: t('system.user.sexMale') },
  { value: 1, label: t('system.user.sexFemale') },
])

onMounted(() => {
  activeTab.value = 'info'
  resetPasswordForm()
  load()
})

async function onChangePassword() {
  const ok = await changePassword()
  if (ok) activeTab.value = 'info'
}
</script>

<template>
  <div class="page-stack profile-page">
    <div v-if="loading" class="card py-16 text-center text-sm text-gray-500 dark:text-gray-400">
      {{ t('profile.loading') }}
    </div>

    <template v-else>
      <div class="profile-header">
        <h1 class="page-title text-xl">{{ t('profile.title') }}</h1>
        <p class="page-subtitle mt-1">{{ t('profile.subtitle') }}</p>
      </div>

      <div class="profile-layout">
        <aside class="card profile-aside">
          <div class="profile-aside-user">
            <div class="profile-avatar">{{ userInitial }}</div>
            <div class="min-w-0 text-center">
              <p class="truncate text-lg font-semibold text-gray-900 dark:text-white">
                {{ form.nickName || form.userName || t('user.name') }}
              </p>
              <p class="truncate text-sm text-gray-500 dark:text-gray-400">@{{ form.userName }}</p>
            </div>
          </div>

          <dl class="profile-meta">
            <div class="profile-meta-item">
              <dt>{{ t('profile.dept') }}</dt>
              <dd>{{ profile?.deptName || t('system.user.deptNone') }}</dd>
            </div>
            <div class="profile-meta-item">
              <dt>{{ t('profile.post') }}</dt>
              <dd>{{ profile?.postNames || '—' }}</dd>
            </div>
            <div v-if="profile?.createTime" class="profile-meta-item">
              <dt>{{ t('profile.joinedAt') }}</dt>
              <dd>{{ new Date(profile.createTime).toLocaleDateString() }}</dd>
            </div>
          </dl>
        </aside>

        <section class="card profile-main min-w-0">
          <div class="profile-tabs">
            <button
              type="button"
              :class="['profile-tab', activeTab === 'info' && 'profile-tab-active']"
              @click="activeTab = 'info'"
            >
              {{ t('profile.tabInfo') }}
            </button>
            <button
              type="button"
              :class="['profile-tab', activeTab === 'password' && 'profile-tab-active']"
              @click="activeTab = 'password'"
            >
              {{ t('profile.tabPassword') }}
            </button>
          </div>

          <form v-if="activeTab === 'info'" class="profile-form" @submit.prevent="saveBasic">
            <div class="form-grid-pairs">
              <div class="form-grid-row">
                <FormField :label="t('system.user.userName')" horizontal class="form-field-span-2">
                  <input :value="form.userName" class="field-input field-readonly" disabled />
                </FormField>
              </div>
              <div class="form-grid-row">
                <FormField :label="t('system.user.nickName')" horizontal required>
                  <input v-model="form.nickName" class="field-input" maxlength="30" />
                </FormField>
                <FormField :label="t('profile.language')" horizontal>
                  <select v-model="form.language" class="field-input">
                    <option v-for="opt in localeOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </select>
                </FormField>
              </div>
              <div class="form-grid-row">
                <FormField :label="t('system.user.telephone')" horizontal>
                  <input v-model="form.telephone" class="field-input" maxlength="11" />
                </FormField>
                <FormField :label="t('system.user.email')" horizontal>
                  <input v-model="form.email" class="field-input" type="email" maxlength="50" />
                </FormField>
              </div>
              <div class="form-grid-row">
                <FormField :label="t('system.user.sex')" horizontal class="form-field-span-2">
                  <div class="form-row-inline flex-wrap gap-4">
                    <label v-for="opt in sexOptions" :key="opt.value" class="inline-flex items-center gap-2 text-sm">
                      <input v-model="form.sex" type="radio" :value="opt.value" class="accent-brand-500" />
                      {{ opt.label }}
                    </label>
                  </div>
                </FormField>
              </div>
            </div>

            <div class="profile-form-actions">
              <button type="submit" class="btn-primary" :disabled="saving">
                {{ saving ? t('system.user.saving') : t('profile.save') }}
              </button>
            </div>
          </form>

          <form v-else class="profile-form" @submit.prevent="onChangePassword">
            <p class="profile-form-hint">{{ t('profile.passwordHint') }}</p>

            <div class="form-grid-pairs">
              <div class="form-grid-row">
                <FormField :label="t('profile.newPassword')" horizontal required class="form-field-span-2">
                  <input
                    v-model="passwordForm.newPassword"
                    class="field-input"
                    type="password"
                    autocomplete="new-password"
                    maxlength="20"
                  />
                </FormField>
              </div>
              <div class="form-grid-row">
                <FormField :label="t('profile.confirmPassword')" horizontal required class="form-field-span-2">
                  <input
                    v-model="passwordForm.confirmPassword"
                    class="field-input"
                    type="password"
                    autocomplete="new-password"
                    maxlength="20"
                  />
                </FormField>
              </div>
            </div>

            <div class="profile-form-actions">
              <button type="button" class="btn-ghost" @click="activeTab = 'info'">{{ t('confirm.cancel') }}</button>
              <button type="submit" class="btn-primary" :disabled="saving">
                {{ saving ? t('system.user.saving') : t('profile.changePassword') }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </template>
  </div>
</template>

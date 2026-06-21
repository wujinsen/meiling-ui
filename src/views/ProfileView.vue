<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ExternalLink, Eye, EyeOff, LayoutGrid, ShieldCheck, Star } from 'lucide-vue-next'
import FormField from '@/components/ui/FormField.vue'
import { groupPortalSystems, type SystemGroup } from '@/constants/systemGroup'
import { useProfile } from '@/composables/useProfile'
import { useAuth } from '@/composables/useAuth'
import { useSystemPortal } from '@/composables/useSystemPortal'
import { useLocale } from '@/i18n'

const { t } = useI18n()
const { displayName } = useAuth()
const { currentSystem } = useSystemPortal()
const { options: localeOptions } = useLocale()

const showOldPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

const {
  loading,
  saving,
  activeTab,
  profile,
  form,
  passwordForm,
  roles,
  systems,
  isFullAccess,
  load,
  saveBasic,
  changePassword,
  resetPasswordForm,
} = useProfile()

const userInitial = computed(() => (displayName.value || profile.value?.userName || 'U').charAt(0).toUpperCase())

const groupedSystems = computed(() => groupPortalSystems(systems.value))

const sexOptions = computed(() => [
  { value: 0, label: t('system.user.sexMale') },
  { value: 1, label: t('system.user.sexFemale') },
])

function groupLabel(key: SystemGroup) {
  return t(`system.portal.group.${key}`)
}

function isCurrentSystem(id: number | string) {
  return currentSystem.value != null && String(currentSystem.value.id) === String(id)
}

onMounted(() => {
  activeTab.value = 'info'
  resetPasswordForm()
  load()
})

async function onChangePassword() {
  await changePassword()
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

      <div class="card profile-hero">
        <div class="profile-hero-user">
          <div class="profile-avatar">{{ userInitial }}</div>
          <div class="min-w-0">
            <p class="truncate text-xl font-semibold text-gray-900 dark:text-white">
              {{ form.nickName || form.userName || t('user.name') }}
            </p>
            <p class="truncate text-sm text-gray-500 dark:text-gray-400">@{{ form.userName }}</p>
          </div>
        </div>

        <dl class="profile-hero-meta">
          <div class="profile-hero-meta-item">
            <dt>{{ t('profile.dept') }}</dt>
            <dd>{{ profile?.deptName || t('system.user.deptNone') }}</dd>
          </div>
          <div class="profile-hero-meta-item">
            <dt>{{ t('profile.post') }}</dt>
            <dd>{{ profile?.postNames || '—' }}</dd>
          </div>
          <div v-if="profile?.createTime" class="profile-hero-meta-item">
            <dt>{{ t('profile.joinedAt') }}</dt>
            <dd>{{ new Date(profile.createTime).toLocaleDateString() }}</dd>
          </div>
        </dl>
      </div>

      <div class="profile-body">
        <section class="card profile-access-card">
          <div class="profile-access-block">
            <div class="profile-access-head">
              <h2 class="profile-section-title">{{ t('profile.roles') }}</h2>
              <span v-if="isFullAccess" class="profile-super-tag">
                <ShieldCheck class="h-3.5 w-3.5" />
                {{ t('system.portal.superAdminTag') }}
              </span>
            </div>
            <div v-if="roles.length" class="profile-chip-list">
              <span v-for="role in roles" :key="String(role.id ?? role.roleName)" class="profile-chip">
                {{ role.roleName }}
              </span>
            </div>
            <p v-else class="profile-access-empty">{{ t('profile.rolesNone') }}</p>
          </div>

          <div class="profile-access-block profile-access-block-systems">
            <div class="profile-access-head">
              <h2 class="profile-section-title">{{ t('profile.systems') }}</h2>
              <span v-if="systems.length" class="profile-access-count">
                {{ t('profile.systemsCount', { count: systems.length }) }}
              </span>
            </div>
            <p v-if="isFullAccess" class="profile-access-hint">{{ t('profile.systemsFullAccess') }}</p>
            <div v-if="groupedSystems.length" class="profile-system-groups">
              <section v-for="group in groupedSystems" :key="group.key" class="profile-system-group">
                <p class="profile-system-group-label">{{ groupLabel(group.key) }}</p>
                <div class="profile-system-grid">
                  <div
                    v-for="item in group.items"
                    :key="item.id"
                    class="profile-system-card"
                    :class="isCurrentSystem(item.id) && 'profile-system-card-current'"
                  >
                    <div class="profile-system-card-icon">
                      <LayoutGrid class="h-4 w-4" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex min-w-0 items-center gap-1.5">
                        <span class="truncate font-medium text-gray-800 dark:text-gray-100">{{ item.systemName }}</span>
                        <Star
                          v-if="item.isDefault"
                          class="h-3 w-3 shrink-0 text-amber-500"
                          :title="t('system.portal.defaultBadge')"
                        />
                        <ExternalLink
                          v-if="item.ssoMode === 'EXTERNAL'"
                          class="h-3 w-3 shrink-0 text-gray-400"
                          :title="t('system.portal.externalBadge')"
                        />
                      </div>
                      <p class="truncate text-xs text-gray-400">{{ item.systemCode }}</p>
                    </div>
                    <span v-if="isCurrentSystem(item.id)" class="profile-system-current">
                      {{ t('profile.currentSystem') }}
                    </span>
                  </div>
                </div>
              </section>
            </div>
            <p v-else class="profile-access-empty">{{ t('profile.systemsNone') }}</p>
          </div>
        </section>

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
            <div class="profile-form-grid">
              <FormField :label="t('system.user.userName')" class="profile-form-span-2">
                <input :value="form.userName" class="field-input field-readonly w-full" disabled />
              </FormField>
              <FormField :label="t('system.user.nickName')" required>
                <input v-model="form.nickName" class="field-input w-full" maxlength="30" />
              </FormField>
              <FormField :label="t('profile.language')">
                <select v-model="form.language" class="field-input w-full">
                  <option v-for="opt in localeOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </FormField>
              <FormField :label="t('system.user.telephone')">
                <input v-model="form.telephone" class="field-input w-full" maxlength="11" />
              </FormField>
              <FormField :label="t('system.user.email')">
                <input v-model="form.email" class="field-input w-full" type="email" maxlength="50" />
              </FormField>
              <FormField :label="t('system.user.sex')" class="profile-form-span-2">
                <div class="form-row-inline flex-wrap gap-4 pt-0.5">
                  <label v-for="opt in sexOptions" :key="opt.value" class="inline-flex items-center gap-2 text-sm">
                    <input v-model="form.sex" type="radio" :value="opt.value" class="accent-brand-500" />
                    {{ opt.label }}
                  </label>
                </div>
              </FormField>
            </div>

            <div class="profile-form-actions">
              <button type="submit" class="btn-primary" :disabled="saving">
                {{ saving ? t('system.user.saving') : t('profile.save') }}
              </button>
            </div>
          </form>

          <form v-else class="profile-form" @submit.prevent="onChangePassword">
            <p class="profile-form-hint">{{ t('profile.passwordHint') }}</p>

            <div class="profile-form-grid profile-form-grid-narrow">
              <FormField :label="t('profile.oldPassword')" required>
                <div class="relative">
                  <input
                    v-model="passwordForm.oldPassword"
                    class="field-input w-full pr-10"
                    :type="showOldPassword ? 'text' : 'password'"
                    autocomplete="current-password"
                    maxlength="20"
                  />
                  <button
                    type="button"
                    class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    :title="showOldPassword ? t('profile.hidePassword') : t('profile.showPassword')"
                    @click="showOldPassword = !showOldPassword"
                  >
                    <EyeOff v-if="showOldPassword" class="h-4 w-4" />
                    <Eye v-else class="h-4 w-4" />
                  </button>
                </div>
              </FormField>
              <FormField :label="t('profile.newPassword')" required>
                <div class="relative">
                  <input
                    v-model="passwordForm.newPassword"
                    class="field-input w-full pr-10"
                    :type="showNewPassword ? 'text' : 'password'"
                    autocomplete="new-password"
                    maxlength="20"
                  />
                  <button
                    type="button"
                    class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    :title="showNewPassword ? t('profile.hidePassword') : t('profile.showPassword')"
                    @click="showNewPassword = !showNewPassword"
                  >
                    <EyeOff v-if="showNewPassword" class="h-4 w-4" />
                    <Eye v-else class="h-4 w-4" />
                  </button>
                </div>
              </FormField>
              <FormField :label="t('profile.confirmPassword')" required>
                <div class="relative">
                  <input
                    v-model="passwordForm.confirmPassword"
                    class="field-input w-full pr-10"
                    :type="showConfirmPassword ? 'text' : 'password'"
                    autocomplete="new-password"
                    maxlength="20"
                  />
                  <button
                    type="button"
                    class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    :title="showConfirmPassword ? t('profile.hidePassword') : t('profile.showPassword')"
                    @click="showConfirmPassword = !showConfirmPassword"
                  >
                    <EyeOff v-if="showConfirmPassword" class="h-4 w-4" />
                    <Eye v-else class="h-4 w-4" />
                  </button>
                </div>
              </FormField>
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

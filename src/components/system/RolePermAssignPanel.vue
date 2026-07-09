<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import RolePermActionBlock from '@/components/system/RolePermActionBlock.vue'
import AppCheckbox from '@/components/ui/AppCheckbox.vue'
import { useRolePermAssign, isPageMenu } from '@/composables/useRolePermAssign'
import { ChevronDown, ChevronRight, CheckSquare, FoldVertical, Square, UnfoldVertical } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    roleId: number | string
    mode?: 'modal' | 'page'
    showFooter?: boolean
  }>(),
  { mode: 'modal', showFooter: true },
)

const emit = defineEmits<{
  saved: []
  cancel: []
}>()

const { t } = useI18n()
const {
  loading,
  saving,
  menuTree,
  menuExpanded,
  isFullyCollapsed,
  treeExpandLabel,
  toggleMenuExpand,
  toggleTreeExpand,
  checkedMenuIds,
  isFullyUnchecked,
  treeCheckLabel,
  actionPanelsLoading,
  checkedActionCodes,
  actionPanels,
  activePermMenuId,
  autoGrantActionsOnCheck,
  flatMenuRows,
  hasCheckedCPage,
  checkedCPageNames,
  activeActionPanel,
  countSelectedActionsForMenu,
  persistAutoGrantPreference,
  grantAllActionsForCheckedPages,
  clearAllActionsForCheckedPages,
  toggleActionCheck,
  toggleAllActionsForActivePage,
  toggleAllActionsForPanel,
  toggleMenuCheck,
  onToggleTreeCheckAll,
  selectPermMenu,
  scrollToPermPanel,
  loadMenuTreeFallback,
  loadForRole,
  submitPermissions,
} = useRolePermAssign()

onMounted(() => {
  void loadForRole(props.roleId)
})

watch(
  () => props.roleId,
  (id) => {
    if (id != null && id !== '') void loadForRole(id)
  },
)

function selectPermPanel(menuId: string) {
  activePermMenuId.value = menuId
}

function onPermPanelClick(menuId: string) {
  if (props.mode === 'page') scrollToPermPanel(menuId)
  else selectPermPanel(menuId)
}

async function handleSave() {
  const ok = await submitPermissions()
  if (ok) emit('saved')
}
</script>

<template>
  <div v-if="loading" class="py-16 text-center text-sm text-gray-400">
    {{ t('system.role.actionPermLoading') }}
  </div>

  <div
    v-else-if="!menuTree.length"
    class="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400 dark:border-white/10"
  >
    {{ t('system.role.menuEmpty') }}
    <button type="button" class="btn-ghost ml-2 text-xs" @click="loadMenuTreeFallback">
      {{ t('system.role.retry') }}
    </button>
  </div>

  <div
    v-else
    class="role-perm-layout"
    :class="{ 'role-perm-layout--page': mode === 'page' }"
  >
    <section class="role-perm-pane">
      <div class="role-perm-pane-head">
        <p class="text-sm font-medium text-gray-800 dark:text-gray-200">{{ t('system.role.pageAccess') }}</p>
        <div class="toolbar-actions">
          <button type="button" class="role-perm-quick-btn" @click="toggleTreeExpand(menuTree)">
            <UnfoldVertical v-if="isFullyCollapsed" class="h-4 w-4" />
            <FoldVertical v-else class="h-4 w-4" />
            {{ treeExpandLabel }}
          </button>
          <button type="button" class="role-perm-quick-btn" @click="onToggleTreeCheckAll">
            <CheckSquare v-if="isFullyUnchecked" class="h-4 w-4" />
            <Square v-else class="h-4 w-4" />
            {{ treeCheckLabel }}
          </button>
        </div>
        <AppCheckbox
          v-model="autoGrantActionsOnCheck"
          size="sm"
          @change="persistAutoGrantPreference"
        >
          <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('system.role.autoGrantActionsOnCheck') }}</span>
        </AppCheckbox>
      </div>
      <div class="role-perm-tree">
        <div
          v-for="row in flatMenuRows"
          :key="String(row.id)"
          class="role-perm-tree-row"
          :class="{
            'role-perm-tree-row-active': isPageMenu(row) && activePermMenuId === String(row.id),
            'role-perm-tree-row-clickable':
              isPageMenu(row)
              && checkedMenuIds.has(String(row.id))
              && actionPanels.some((p) => p.menuId === String(row.id)),
          }"
          :style="{ paddingLeft: `${12 + row.depth * 20}px` }"
          @click="selectPermMenu(row)"
        >
          <button
            v-if="row.hasChildren"
            type="button"
            class="role-perm-tree-expand-btn"
            @click.stop="toggleMenuExpand(String(row.id))"
          >
            <ChevronDown v-if="menuExpanded.has(String(row.id))" class="h-4 w-4" />
            <ChevronRight v-else class="h-4 w-4" />
          </button>
          <span v-else class="w-5" />
          <div class="inline-flex flex-1 items-center gap-2 text-sm" @click.stop>
            <AppCheckbox
              standalone
              size="sm"
              :model-value="checkedMenuIds.has(String(row.id))"
              @update:model-value="(v) => toggleMenuCheck(row, v)"
            />
            <span class="text-gray-800 dark:text-gray-200">{{ row.menuName }}</span>
            <span
              v-if="
                isPageMenu(row)
                  && checkedMenuIds.has(String(row.id))
                  && actionPanels.some((p) => p.menuId === String(row.id))
              "
              class="text-xs text-gray-400"
            >
              {{ countSelectedActionsForMenu(String(row.id)) }}/{{ actionPanels.find((p) => p.menuId === String(row.id))?.actions.length ?? 0 }}
            </span>
          </div>
        </div>
      </div>
    </section>

    <section class="role-perm-pane">
      <div class="role-perm-pane-head">
        <p class="text-sm font-medium text-gray-800 dark:text-gray-200">{{ t('system.role.actionPerm') }}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('system.role.actionPermFocusHint') }}</p>
      </div>

      <p v-if="actionPanelsLoading" class="px-4 py-6 text-sm text-gray-400">
        {{ t('system.role.actionPermLoading') }}
      </p>
      <p v-else-if="!hasCheckedCPage" class="role-perm-empty">
        {{ t('system.role.actionPermSelectPage') }}
      </p>
      <div
        v-else-if="!actionPanels.length"
        class="role-perm-empty role-perm-empty-warn"
      >
        <p>{{ t('system.role.actionPermEmpty', { pages: checkedCPageNames.join('、') }) }}</p>
        <p class="mt-1 text-xs opacity-90">{{ t('system.role.actionPermEmptyHint') }}</p>
      </div>

      <template v-else>
        <div class="role-perm-pane-body" :class="{ 'role-perm-pane-body--page': mode === 'page', 'role-perm-pane-body--modal': mode === 'modal' }">
          <div class="role-perm-bulk-actions">
            <button type="button" class="role-perm-quick-btn role-perm-quick-btn--primary" @click="grantAllActionsForCheckedPages">
              {{ t('system.role.grantAllActions') }}
            </button>
            <button type="button" class="role-perm-quick-btn role-perm-quick-btn--ghost" @click="clearAllActionsForCheckedPages">
              {{ t('system.role.clearAllActions') }}
            </button>
          </div>

          <div class="role-perm-page-grid">
            <button
              v-for="panel in actionPanels"
              :key="panel.menuId"
              type="button"
              class="role-perm-page-tile"
              :class="{ 'role-perm-page-tile-active': activePermMenuId === panel.menuId }"
              :title="panel.menuName"
              @click="onPermPanelClick(panel.menuId)"
            >
              <span class="role-perm-page-tile-name">{{ panel.menuName }}</span>
              <span class="role-perm-page-tile-count">
                {{ countSelectedActionsForMenu(panel.menuId) }}/{{ panel.actions.length }}
              </span>
            </button>
          </div>

          <div v-if="mode === 'modal' && activeActionPanel" class="role-perm-action-card">
            <RolePermActionBlock
              :panel="activeActionPanel"
              :checked-codes="checkedActionCodes"
              @toggle="(code, checked) => toggleActionCheck(code, checked)"
              @select-all="toggleAllActionsForActivePage(true)"
              @clear-all="toggleAllActionsForActivePage(false)"
            />
          </div>

          <div v-else-if="mode === 'page'" class="role-perm-panels-flat">
            <section
              v-for="panel in actionPanels"
              :id="`role-perm-panel-${panel.menuId}`"
              :key="panel.menuId"
              class="role-perm-panel-block"
            >
              <RolePermActionBlock
                :panel="panel"
                :checked-codes="checkedActionCodes"
                @toggle="(code, checked) => toggleActionCheck(code, checked)"
                @select-all="toggleAllActionsForPanel(panel, true)"
                @clear-all="toggleAllActionsForPanel(panel, false)"
              />
            </section>
          </div>
        </div>
      </template>
    </section>
  </div>

  <div
    v-if="showFooter && !loading && menuTree.length"
    class="role-perm-footer"
    :class="{ 'role-perm-footer--page': mode === 'page' }"
  >
    <button type="button" class="btn-ghost" :disabled="saving" @click="emit('cancel')">
      {{ t('system.role.cancel') }}
    </button>
    <button type="button" class="btn-primary" :disabled="saving" @click="handleSave">
      {{ saving ? t('system.role.saving') : t('system.role.save') }}
    </button>
  </div>
</template>

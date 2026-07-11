<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { CheckCircle2, Loader2, UserRound, Wrench } from 'lucide-vue-next'
import AppCheckbox from '@/components/ui/AppCheckbox.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import {
  batchUpdateKbLintIssuesApi,
  getKbDocumentApi,
  getKbLintIssuesApi,
  updateKbLintIssueApi,
} from '@/api/knowledge'
import { listUserApi } from '@/api/user'
import { kbWikiEditPath } from '@/router/knowledgeSupplementRoutes'
import { useAuth } from '@/composables/useAuth'
import { API_SUCCESS_CODE } from '@/types/api'
import { showToast } from '@/composables/useToast'
import type { KbLintIssue, KbLintIssueStatus, KbLintReport } from '@/types/knowledge'
import type { UserVo } from '@/types/user'
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination'

const ISSUE_TYPE_OPTIONS = [
  'broken_link',
  'orphan',
  'no_summary',
  'missing_summary',
  'duplicate',
  'stale',
  'conflict',
] as const

const props = defineProps<{
  spaceId?: number | string
  report?: KbLintReport | null
}>()

const { t } = useI18n()
const router = useRouter()
const { user } = useAuth()

const issuesLoading = ref(false)
const issues = ref<KbLintIssue[]>([])
const issueTotal = ref(0)
const statusFilter = ref<'' | KbLintIssueStatus>('')
const issueTypeFilter = ref('')
const unassignedOnly = ref(false)
const pageNum = ref(1)
const pageSize = ref(DEFAULT_PAGE_SIZE)

const selectedIds = ref<Set<string>>(new Set())
const batchBusy = ref(false)
const usersLoading = ref(false)
const users = ref<UserVo[]>([])
const assigneePick = ref<Record<string, string>>({})

const fixingIssueId = ref<string | number | null>(null)

const allSelected = computed(() => {
  if (!issues.value.length) return false
  return issues.value.every((row) => selectedIds.value.has(String(row.id)))
})

const someSelected = computed(() => selectedIds.value.size > 0)

const STATUS_BADGE: Record<KbLintIssueStatus, string> = {
  0: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  1: 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400',
  2: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
}

function statusLabel(status: KbLintIssueStatus) {
  return t(`knowledge.lint.issueStatus.${status}`)
}

function issueTypeLabel(type: string) {
  const key = `knowledge.opsDashboard.issueTypes.${type}` as const
  const label = t(key)
  return label === key ? type : label
}

function userLabel(id?: number | string | null) {
  if (id == null || id === '') return t('knowledge.lint.unassigned')
  const u = users.value.find((x) => String(x.id) === String(id))
  return u?.nickName || u?.userName || String(id)
}

async function loadUsers() {
  usersLoading.value = true
  try {
    const res = await listUserApi({ pageNum: 1, pageSize: 200, status: 1 })
    if (res.code === API_SUCCESS_CODE && res.data?.list) {
      users.value = res.data.list
    }
  } finally {
    usersLoading.value = false
  }
}

async function loadIssues() {
  if (!props.spaceId) {
    issues.value = []
    issueTotal.value = 0
    return
  }
  issuesLoading.value = true
  try {
    const res = await getKbLintIssuesApi({
      spaceId: props.spaceId,
      status: statusFilter.value === '' ? undefined : statusFilter.value,
      issueType: issueTypeFilter.value || undefined,
      unassignedOnly: unassignedOnly.value || undefined,
      pageNum: pageNum.value,
      pageSize: pageSize.value,
    })
    if (res.code === API_SUCCESS_CODE && res.data) {
      issues.value = res.data.records ?? []
      issueTotal.value = Number(res.data.total) || issues.value.length
      for (const row of issues.value) {
        assigneePick.value[String(row.id)] = row.assigneeId != null ? String(row.assigneeId) : ''
      }
      const maxPage = Math.max(1, Math.ceil(issueTotal.value / pageSize.value))
      if (pageNum.value > maxPage) pageNum.value = maxPage
      const valid = new Set(issues.value.map((r) => String(r.id)))
      selectedIds.value = new Set([...selectedIds.value].filter((id) => valid.has(id)))
    }
  } finally {
    issuesLoading.value = false
  }
}

function onFilterChange() {
  pageNum.value = 1
  void loadIssues()
}

function toggleSelectAll() {
  if (allSelected.value) {
    selectedIds.value = new Set()
    return
  }
  selectedIds.value = new Set(issues.value.map((r) => String(r.id)))
}

function toggleRow(id: number | string) {
  const key = String(id)
  const next = new Set(selectedIds.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  selectedIds.value = next
}

async function setIssueStatus(issue: KbLintIssue, status: KbLintIssueStatus) {
  try {
    const res = await updateKbLintIssueApi(issue.id, { status })
    if (res.code !== API_SUCCESS_CODE) throw new Error(res.msg || t('knowledge.lint.updateFailed'))
    showToast('success', t('knowledge.lint.updateOk'))
    await loadIssues()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.lint.updateFailed'))
  }
}

async function assignIssue(issue: KbLintIssue, assigneeId: string) {
  const patch = assigneeId === '' ? { assigneeId: null, status: issue.status } : { assigneeId, status: issue.status }
  try {
    const res = await updateKbLintIssueApi(issue.id, patch)
    if (res.code !== API_SUCCESS_CODE) throw new Error(res.msg || t('knowledge.lint.assignFailed'))
    showToast('success', t('knowledge.lint.assignOk'))
    await loadIssues()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.lint.assignFailed'))
  }
}

async function assignToMe(issue: KbLintIssue) {
  const uid = user.value?.id
  if (uid == null) {
    showToast('error', t('knowledge.lint.assignNoUser'))
    return
  }
  await assignIssue(issue, String(uid))
}

async function runBatch(
  action: 'ignore' | 'fixed' | 'assign',
  assigneeId?: string,
) {
  const ids = [...selectedIds.value]
  if (!ids.length) return
  batchBusy.value = true
  try {
    const patch =
      action === 'ignore'
        ? { status: 1 as KbLintIssueStatus }
        : action === 'fixed'
          ? { status: 2 as KbLintIssueStatus }
          : {
              assigneeId: assigneeId === '' ? null : assigneeId,
            }
    const res = await batchUpdateKbLintIssuesApi({ ids, ...patch })
    if (res.code !== API_SUCCESS_CODE || (res.data?.failCount ?? 0) > 0) {
      throw new Error(
        t('knowledge.lint.batchPartial', {
          ok: res.data?.okCount ?? 0,
          fail: res.data?.failCount ?? ids.length,
        }),
      )
    }
    showToast('success', t('knowledge.lint.batchOk', { count: res.data?.okCount ?? ids.length }))
    selectedIds.value = new Set()
    await loadIssues()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.lint.batchFailed'))
  } finally {
    batchBusy.value = false
  }
}

async function fixIssue(issue: KbLintIssue) {
  if (issue.status === 2 || fixingIssueId.value != null) return
  fixingIssueId.value = issue.id
  try {
    let slug = ''
    let spaceId = issue.spaceId ?? props.spaceId
    if (issue.documentId != null) {
      const res = await getKbDocumentApi(issue.documentId)
      if (res.code === API_SUCCESS_CODE && res.data?.slug) {
        slug = res.data.slug
        spaceId = res.data.spaceId ?? spaceId
      }
    }
    if (!slug && props.report && issue.detail) {
      const candidates = [...props.report.orphans, ...props.report.noSummary]
      const matched = candidates.find(
        (item) => issue.detail!.includes(item.slug) || issue.detail!.includes(item.title),
      )
      if (matched) slug = matched.slug
    }
    if (!slug) {
      showToast('error', t('knowledge.lint.fixNoSlug'))
      return
    }
    void router.push(kbWikiEditPath(slug, spaceId, {
      issueId: issue.id,
      issueType: issue.issueType,
      issueDetail: issue.detail,
    }))
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.lint.fixFailed'))
  } finally {
    fixingIssueId.value = null
  }
}

watch([() => props.spaceId, pageNum, pageSize], () => loadIssues())
watch([statusFilter, issueTypeFilter, unassignedOnly], () => onFilterChange())

onMounted(() => {
  void loadUsers()
  void loadIssues()
})

defineExpose({ loadIssues })
</script>

<template>
  <div class="card p-5">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-200">{{ t('knowledge.lint.issues') }}</h2>
      <div class="flex flex-wrap items-center gap-2">
        <select v-model="issueTypeFilter" class="field-input w-auto py-1 text-sm">
          <option value="">{{ t('knowledge.lint.typeAll') }}</option>
          <option v-for="tp in ISSUE_TYPE_OPTIONS" :key="tp" :value="tp">{{ issueTypeLabel(tp) }}</option>
        </select>
        <select v-model="statusFilter" class="field-input w-auto py-1 text-sm">
          <option value="">{{ t('knowledge.lint.statusAll') }}</option>
          <option :value="0">{{ t('knowledge.lint.issueStatus.0') }}</option>
          <option :value="1">{{ t('knowledge.lint.issueStatus.1') }}</option>
          <option :value="2">{{ t('knowledge.lint.issueStatus.2') }}</option>
        </select>
        <label class="flex items-center gap-1.5 text-xs text-gray-500">
          <AppCheckbox v-model="unassignedOnly" size="sm" />
          {{ t('knowledge.lint.unassignedOnly') }}
        </label>
      </div>
    </div>

    <div
      v-if="someSelected"
      class="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-brand-200 bg-brand-50/80 px-3 py-2 dark:border-brand-500/30 dark:bg-brand-500/10"
    >
      <span class="text-xs font-medium text-gray-700 dark:text-gray-200">
        {{ t('knowledge.lint.batchSelected', { count: selectedIds.size }) }}
      </span>
      <button type="button" class="btn-ghost px-2 py-1 text-xs" :disabled="batchBusy" @click="runBatch('ignore')">
        {{ t('knowledge.lint.batchIgnore') }}
      </button>
      <button type="button" class="btn-ghost px-2 py-1 text-xs text-emerald-600" :disabled="batchBusy" @click="runBatch('fixed')">
        {{ t('knowledge.lint.batchFixed') }}
      </button>
      <select
        class="field-input w-auto max-w-[10rem] py-1 text-xs"
        :disabled="batchBusy"
        @change="(e) => { const v = (e.target as HTMLSelectElement).value; if (v !== '__pick__') { void runBatch('assign', v); (e.target as HTMLSelectElement).value = '__pick__' } }"
      >
        <option value="__pick__">{{ t('knowledge.lint.batchAssign') }}</option>
        <option value="">{{ t('knowledge.lint.unassign') }}</option>
        <option v-for="u in users" :key="String(u.id)" :value="String(u.id)">
          {{ u.nickName || u.userName }}
        </option>
      </select>
      <Loader2 v-if="batchBusy" class="h-4 w-4 animate-spin text-gray-400" />
    </div>

    <p v-if="issuesLoading" class="py-8 text-center text-sm text-gray-400">{{ t('common.loading') }}</p>
    <div v-else-if="!issues.length" class="py-8 text-center text-sm text-gray-400">
      <p>{{ t('knowledge.lint.none') }}</p>
      <p
        v-if="report && ((report.counts?.broken ?? 0) + (report.counts?.orphans ?? 0) + (report.counts?.noSummary ?? 0) > 0)"
        class="mt-2 text-xs text-amber-600 dark:text-amber-400"
      >
        {{ t('knowledge.lint.issuesEmptyHint') }}
      </p>
    </div>
    <template v-else>
      <div class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
        <table class="w-full min-w-[48rem] text-left text-sm">
          <thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-400 dark:bg-white/5">
            <tr>
              <th class="w-10 px-3 py-3">
                <AppCheckbox standalone size="sm" :model-value="allSelected" @update:model-value="toggleSelectAll" />
              </th>
              <th class="px-3 py-3">{{ t('knowledge.lint.col.type') }}</th>
              <th class="px-3 py-3">{{ t('knowledge.lint.col.detail') }}</th>
              <th class="px-3 py-3">{{ t('knowledge.lint.col.assignee') }}</th>
              <th class="px-3 py-3">{{ t('knowledge.lint.col.status') }}</th>
              <th class="px-3 py-3 text-right">{{ t('knowledge.lint.col.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-white/5">
            <tr v-for="issue in issues" :key="issue.id">
              <td class="px-3 py-3">
                <AppCheckbox
                  standalone
                  size="sm"
                  :model-value="selectedIds.has(String(issue.id))"
                  @update:model-value="toggleRow(issue.id)"
                />
              </td>
              <td class="px-3 py-3 font-mono text-xs text-gray-500">{{ issueTypeLabel(issue.issueType) }}</td>
              <td class="px-3 py-3 text-gray-700 dark:text-gray-200">{{ issue.detail }}</td>
              <td class="px-3 py-3">
                <div class="flex min-w-[8rem] items-center gap-1">
                  <select
                    v-model="assigneePick[String(issue.id)]"
                    class="field-input max-w-[9rem] py-1 text-xs"
                    :title="userLabel(issue.assigneeId)"
                    @change="assignIssue(issue, assigneePick[String(issue.id)] ?? '')"
                  >
                    <option value="">{{ t('knowledge.lint.unassigned') }}</option>
                    <option v-for="u in users" :key="String(u.id)" :value="String(u.id)">
                      {{ u.nickName || u.userName }}
                    </option>
                  </select>
                  <button
                    type="button"
                    class="btn-ghost shrink-0 p-1 text-gray-400"
                    :title="t('knowledge.lint.assignMe')"
                    @click="assignToMe(issue)"
                  >
                    <UserRound class="h-3.5 w-3.5" />
                  </button>
                </div>
              </td>
              <td class="px-3 py-3">
                <span :class="['badge', STATUS_BADGE[issue.status]]">{{ statusLabel(issue.status) }}</span>
              </td>
              <td class="px-3 py-3">
                <div class="flex justify-end gap-2">
                  <button
                    v-if="issue.status === 0 && issue.documentId != null"
                    type="button"
                    class="btn-ghost px-2 py-1 text-xs text-brand-600 dark:text-brand-400"
                    :disabled="fixingIssueId === issue.id"
                    @click="fixIssue(issue)"
                  >
                    <Loader2 v-if="fixingIssueId === issue.id" class="h-3.5 w-3.5 animate-spin" />
                    <Wrench v-else class="h-3.5 w-3.5" />
                    {{ t('knowledge.lint.fix') }}
                  </button>
                  <button
                    type="button"
                    class="btn-ghost px-2 py-1 text-xs"
                    :disabled="issue.status === 1"
                    @click="setIssueStatus(issue, 1)"
                  >
                    {{ t('knowledge.lint.ignore') }}
                  </button>
                  <button
                    type="button"
                    class="btn-ghost px-2 py-1 text-xs text-emerald-600 dark:text-emerald-400"
                    :disabled="issue.status === 2"
                    @click="setIssueStatus(issue, 2)"
                  >
                    <CheckCircle2 class="h-3.5 w-3.5" /> {{ t('knowledge.lint.markFixed') }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="mt-3">
        <AppPagination v-model:page-num="pageNum" v-model:page-size="pageSize" :total="issueTotal" />
      </div>
      <p class="mt-2 text-xs text-gray-400">{{ t('knowledge.lint.pageHint', { total: issueTotal }) }}</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { basicSetup } from 'codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, placeholder as cmPlaceholder } from '@codemirror/view'
import { oneDark } from '@codemirror/theme-one-dark'
import { useTheme } from '@/composables/useTheme'

const model = defineModel<string>({ default: '' })

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    placeholder?: string
  }>(),
  { disabled: false, placeholder: '' },
)

const { isDark } = useTheme()
const hostRef = ref<HTMLElement | null>(null)

let view: EditorView | null = null
let syncingFromModel = false

const editableComp = new Compartment()
const themeComp = new Compartment()
const placeholderComp = new Compartment()

function buildExtensions() {
  return [
    basicSetup,
    markdown(),
    EditorView.lineWrapping,
    editableComp.of(EditorView.editable.of(!props.disabled)),
    placeholderComp.of(cmPlaceholder(props.placeholder || '')),
    themeComp.of(isDark.value ? oneDark : []),
    EditorView.updateListener.of((update) => {
      if (syncingFromModel || !update.docChanged) return
      model.value = update.state.doc.toString()
    }),
    EditorView.theme({
      '&': { height: '100%' },
      '.cm-scroller': {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '0.875rem',
        lineHeight: '1.625',
      },
      '.cm-content': { padding: '0.625rem 0' },
      '.cm-gutters': {
        borderRight: '1px solid rgb(229 231 235 / 0.8)',
        backgroundColor: 'transparent',
      },
      '&.cm-focused': { outline: 'none' },
    }),
  ]
}

function syncDoc(next: string) {
  if (!view) return
  const cur = view.state.doc.toString()
  if (cur === next) return
  syncingFromModel = true
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: next },
  })
  syncingFromModel = false
}

function mountEditor() {
  if (!hostRef.value || view) return
  view = new EditorView({
    state: EditorState.create({
      doc: model.value,
      extensions: buildExtensions(),
    }),
    parent: hostRef.value,
  })
}

function insertAtCursor(text: string) {
  if (!view) {
    model.value += text
    return
  }
  const { from, to } = view.state.selection.main
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
  })
  view.focus()
}

function focusEditor() {
  view?.focus()
}

defineExpose({ insertAtCursor, focus: focusEditor })

watch(
  () => model.value,
  (next) => syncDoc(next ?? ''),
)

watch(
  () => props.disabled,
  (disabled) => {
    view?.dispatch({
      effects: editableComp.reconfigure(EditorView.editable.of(!disabled)),
    })
  },
)

watch(
  () => props.placeholder,
  (text) => {
    view?.dispatch({
      effects: placeholderComp.reconfigure(cmPlaceholder(text || '')),
    })
  },
)

watch(isDark, (dark) => {
  view?.dispatch({
    effects: themeComp.reconfigure(dark ? oneDark : []),
  })
})

onMounted(mountEditor)

onUnmounted(() => {
  view?.destroy()
  view = null
})
</script>

<template>
  <div
    ref="hostRef"
    class="kb-wiki-cm-editor field-input kb-wiki-edit-editor font-mono text-sm leading-relaxed"
    :class="props.disabled && 'kb-wiki-cm-editor--disabled'"
  />
</template>

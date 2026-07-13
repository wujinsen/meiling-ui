import { onUnmounted } from 'vue'
import { createOperationTaskPoll } from '@/composables/operationTaskHub'

/**
 * 运维异步任务轮询（SVR-14）：模态抽屉 + 可选后台运行（operationTaskHub）。
 */
export function useOperationTaskPoll() {
  const poll = createOperationTaskPoll()
  onUnmounted(() => poll._session.onComponentUnmount())
  return poll
}

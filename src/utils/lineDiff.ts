/**
 * 轻量行级 diff（LCS），用于 Wiki 在线编辑保存前对比。
 * 无外部依赖；wiki 单页体量小，O(n*m) 足够。
 */

export type DiffRowType = 'ctx' | 'add' | 'del'

export type DiffRow = {
  type: DiffRowType
  /** 旧文件行号（del/ctx 有值） */
  oldNo?: number
  /** 新文件行号（add/ctx 有值） */
  newNo?: number
  text: string
}

function splitLines(text: string): string[] {
  if (text === '') return []
  return text.replace(/\r\n/g, '\n').split('\n')
}

/** 返回从 baseline 到 current 的逐行 diff。 */
export function diffLines(baseline: string, current: string): DiffRow[] {
  const a = splitLines(baseline)
  const b = splitLines(current)
  const n = a.length
  const m = b.length

  // LCS 长度表
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const rows: DiffRow[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ type: 'ctx', oldNo: i + 1, newNo: j + 1, text: a[i] })
      i += 1
      j += 1
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ type: 'del', oldNo: i + 1, text: a[i] })
      i += 1
    } else {
      rows.push({ type: 'add', newNo: j + 1, text: b[j] })
      j += 1
    }
  }
  while (i < n) {
    rows.push({ type: 'del', oldNo: i + 1, text: a[i] })
    i += 1
  }
  while (j < m) {
    rows.push({ type: 'add', newNo: j + 1, text: b[j] })
    j += 1
  }
  return rows
}

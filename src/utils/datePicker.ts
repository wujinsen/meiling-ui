/** 本地日期 YYYY-MM-DD，避免时区偏移 */
export function formatDateValue(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseDateValue(value?: string): Date | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDateDisplay(value: string | undefined, locale: string): string {
  const date = parseDateValue(value)
  if (!date) return ''
  const localeTag = locale === 'zh' ? 'zh-CN' : locale === 'ja' ? 'ja-JP' : 'en-US'
  return date.toLocaleDateString(localeTag, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/** 周一为第一列 */
export function getMonthGrid(year: number, month: number): Array<{ day: number; inMonth: boolean }> {
  const first = new Date(year, month, 1)
  const leading = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()
  const cells: Array<{ day: number; inMonth: boolean }> = []

  for (let i = leading - 1; i >= 0; i--) {
    cells.push({ day: daysInPrev - i, inMonth: false })
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, inMonth: true })
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: cells.length - leading - daysInMonth + 1, inMonth: false })
  }
  return cells
}

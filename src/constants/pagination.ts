export const DEFAULT_PAGE_SIZE = 15

export const PAGE_SIZE_OPTIONS = [15, 50, 100] as const

export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number]

export type PageRes<T> = {
  total?: number
  list?: T[]
  pageNum?: number
  pageSize?: number
}

export function normalizePageRes<T>(data?: PageRes<T> | null): PageRes<T> {
  return {
    list: data?.list ?? [],
    total: data?.total ?? 0,
    pageNum: data?.pageNum,
    pageSize: data?.pageSize,
  }
}

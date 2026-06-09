export type PageRes<T> = {
  total?: number
  list?: T[]
  pageNum?: number
  pageSize?: number
}

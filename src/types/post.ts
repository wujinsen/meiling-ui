export type SysPost = {
  id?: number | string
  postCode?: string
  postName?: string
  status?: number
  sort?: number
  remark?: string
  createTime?: string | number
}

export type PostQuery = {
  pageNum?: number
  pageSize?: number
  postCode?: string
  postName?: string
  status?: number | ''
}

export function createEmptyPost(): SysPost {
  return {
    postCode: '',
    postName: '',
    sort: 0,
    status: 1,
    remark: '',
  }
}

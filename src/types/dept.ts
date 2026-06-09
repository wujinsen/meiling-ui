export type DeptVo = {
  id?: number | string
  parentId?: number | string
  deptName?: string
  orderNum?: number
  status?: number
  createTime?: string | number
  children?: DeptVo[]
}

export type SysDept = {
  id?: number | string
  parentId?: number | string
  deptName: string
  orderNum?: number
  status?: number
  createTime?: string | number
  children?: SysDept[]
}

export type DeptQuery = {
  deptName?: string
  status?: number | ''
}

export function createEmptyDept(parentId: number | string = 0): SysDept {
  return {
    parentId,
    deptName: '',
    orderNum: 0,
    status: 1,
  }
}

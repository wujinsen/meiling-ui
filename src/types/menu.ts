export type MenuType = 'M' | 'C'

export type SysMenu = {
  id?: number | string
  parentId?: number | string
  menuName: string
  menuNameEn?: string
  menuNameJa?: string
  path?: string
  component?: string
  /** Vue Router name，对应后端 route_name */
  routeName?: string
  menuType: MenuType | string
  perms?: string
  status?: number
  icon?: string
  orderNum?: number
  createTime?: string | number
  children?: SysMenu[]
}

export type MenuQuery = {
  menuName?: string
  status?: number | ''
}

export function createEmptyMenu(parentId: number | string = 0): SysMenu {
  return {
    parentId,
    menuName: '',
    menuNameEn: '',
    menuNameJa: '',
    menuType: 'M',
    path: '',
    component: '',
    routeName: '',
    perms: '',
    icon: '',
    orderNum: 0,
    status: 1,
  }
}

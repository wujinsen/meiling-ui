export type SysDictType = {
  id?: number | string
  dictName?: string
  dictType?: string
  status?: number
  remark?: string
  createTime?: string | number
}

export type SysDictData = {
  id?: number | string
  dictType?: string
  dictKey?: string
  dictValue?: string
  dictValueEn?: string
  dictValueJa?: string
  sort?: number
  status?: number
  remark?: string
  createTime?: string | number
}

export type DictTypeQuery = {
  pageNum?: number
  pageSize?: number
  dictName?: string
  dictType?: string
  status?: number | ''
}

export type DictDataQuery = {
  pageNum?: number
  pageSize?: number
  dictType?: string
  dictValue?: string
  status?: number | ''
}

export function createEmptyDictType(): SysDictType {
  return {
    dictName: '',
    dictType: '',
    status: 1,
    remark: '',
  }
}

export function createEmptyDictData(dictType = ''): SysDictData {
  return {
    dictType,
    dictKey: '',
    dictValue: '',
    dictValueEn: '',
    dictValueJa: '',
    sort: 0,
    status: 1,
    remark: '',
  }
}

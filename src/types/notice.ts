export const NOTICE_STATUS_DRAFT = 0
export const NOTICE_STATUS_PUBLISHED = 1
export const NOTICE_STATUS_REVOKED = 2

export type SysNotice = {
  id?: number | string
  noticeTitle?: string
  noticeType?: number
  noticeContent?: string
  status?: number
  topFlag?: number
  publishTime?: string | number
  expireTime?: string | number | null
  createTime?: string | number
  updateTime?: string | number
}

export type NoticeQuery = {
  pageNum?: number
  pageSize?: number
  noticeTitle?: string
  noticeType?: number | ''
  status?: number | ''
}

export type NoticeBrief = {
  id: number | string
  noticeTitle?: string
  noticeType?: number
  topFlag?: number
  publishTime?: string | number
  expireTime?: string | number | null
  unread?: boolean
}

export type NoticeFeed = {
  list?: NoticeBrief[]
  unreadCount?: number
}

export function createEmptyNotice(): SysNotice {
  return {
    noticeTitle: '',
    noticeType: 1,
    noticeContent: '',
    topFlag: 0,
    expireTime: null,
  }
}

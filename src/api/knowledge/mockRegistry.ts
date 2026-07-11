import type { KbPage } from '@/types/knowledge'

let mockPages: KbPage[] = []

export function registerKnowledgeMockPages(pages: KbPage[]) {
  mockPages = pages
}

export function findKnowledgeMockPage(slug: string): KbPage | undefined {
  return mockPages.find((p) => p.slug === slug)
}

export function hasKnowledgeMockPage(slug: string): boolean {
  return mockPages.some((p) => p.slug === slug)
}

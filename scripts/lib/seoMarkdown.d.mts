import type { GuideContent } from '../../src/seo/guides'

export const TITLE_MAX: number
export const DESCRIPTION_MAX: number

export function splitFrontMatter(source: string): { meta: Record<string, string>; body: string }
export function cleanInline(text: string): string
export function blocks(
  body: string,
  warn?: (message: string) => void,
): ({ type: 'h'; level: number; text: string } | { type: 'p'; text: string } | { type: 'list'; items: string[] })[]
export function parseContent(
  source: string,
  options: { fileName: string; kind: 'guide' | 'faq' },
): { content: GuideContent; errors: string[]; warnings: string[] }

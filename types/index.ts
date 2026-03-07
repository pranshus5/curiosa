// types/index.ts

export interface Article {
  id: string
  title: string
  category: Category
  source: string
  source_url: string
  read_time: number
  date: string          // ISO date string YYYY-MM-DD
  sym: string           // unicode symbol/letter for visual
  excerpt: string
  content: string
  references: string[]
  tags: string[]
  created_at: string
}

export interface UserArticleState {
  user_id: string
  article_id: string
  is_read: boolean
  read_at: string | null
}

export interface Annotation {
  id: string
  user_id: string
  article_id: string
  article_title: string
  text: string          // the highlighted passage
  note: string          // optional personal note
  color: string         // hex color
  created_at: string
}

export type Category =
  | 'Philosophy'
  | 'Science'
  | 'History'
  | 'Economics'
  | 'Culture'
  | 'Technology'
  | 'Arts'
  | 'Anthropology'
  | 'Research'

export const ALL_CATEGORIES: Category[] = [
  'Philosophy', 'Science', 'History', 'Economics',
  'Culture', 'Technology', 'Arts', 'Anthropology', 'Research',
]

export const CATEGORY_COLORS: Record<Category, string> = {
  Philosophy:   '#5B4FCF',
  Science:      '#0E7490',
  History:      '#92400E',
  Economics:    '#065F46',
  Culture:      '#9D174D',
  Technology:   '#1D4ED8',
  Arts:         '#7C3AED',
  Anthropology: '#B45309',
  Research:     '#374151',
}

export const HIGHLIGHT_COLORS = ['#FEF08A', '#BAE6FD', '#FBCFE8'] as const
export const HIGHLIGHT_NAMES  = ['Amber', 'Sky', 'Rose'] as const

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
  | 'Psychology'
  | 'Indian Economy'
  | 'Indian Politics'
  | 'Indian Culture'
  | 'Indian Business'
  | 'Indian Innovation'

export const ALL_CATEGORIES: Category[] = [
  'Philosophy', 'Science', 'History', 'Economics',
  'Culture', 'Technology', 'Arts', 'Anthropology', 'Research',
  'Psychology', 'Indian Economy', 'Indian Politics',
  'Indian Culture', 'Indian Business', 'Indian Innovation',
]

export const CATEGORY_COLORS: Record<Category, string> = {
  Philosophy:        '#5B4FCF',
  Science:           '#0E7490',
  History:           '#92400E',
  Economics:         '#065F46',
  Culture:           '#9D174D',
  Technology:        '#1D4ED8',
  Arts:              '#7C3AED',
  Anthropology:      '#B45309',
  Research:          '#374151',
  Psychology:        '#BE185D',
  'Indian Economy':  '#0369A1',
  'Indian Politics': '#B91C1C',
  'Indian Culture':  '#D97706',
  'Indian Business': '#047857',
  'Indian Innovation': '#7C3AED',
}

export const HIGHLIGHT_COLORS = ['#FEF08A', '#BAE6FD', '#FBCFE8'] as const
export const HIGHLIGHT_NAMES  = ['Amber', 'Sky', 'Rose'] as const

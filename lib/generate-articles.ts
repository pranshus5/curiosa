import { Category } from '@/types'

const SYMBOLS = ['◈', '✦', '△', '○', '⊕', '♩', '◎', '❋', '◇', '☆', '◉', '⟡']
const GEMINI_MODEL = 'gemini-2.5-flash'
const DEFAULT_DAILY_COUNT = 1

const REAL_SOURCES: Record<Category, { name: string; url: string }> = {
  Philosophy: { name: 'Aeon', url: 'https://aeon.co' },
  Science: { name: 'Quanta Magazine', url: 'https://www.quantamagazine.org' },
  History: { name: 'Smithsonian Magazine', url: 'https://www.smithsonianmag.com' },
  Economics: { name: 'The Economist', url: 'https://www.economist.com' },
  Culture: { name: 'The Atlantic', url: 'https://www.theatlantic.com' },
  Technology: { name: 'WIRED', url: 'https://www.wired.com' },
  Arts: { name: 'The Paris Review', url: 'https://www.theparisreview.org' },
  Anthropology: { name: 'Sapiens', url: 'https://www.sapiens.org' },
  Research: { name: 'The Conversation', url: 'https://theconversation.com' },
  Psychology: { name: 'Psychology Today', url: 'https://www.psychologytoday.com' },
  'Indian Economy': { name: 'Mint', url: 'https://www.livemint.com' },
  'Indian Politics': { name: 'The Hindu', url: 'https://www.thehindu.com' },
  'Indian Culture': { name: 'Scroll.in', url: 'https://scroll.in' },
  'Indian Business': { name: 'Business Standard', url: 'https://www.business-standard.com' },
  'Indian Innovation': { name: 'YourStory', url: 'https://yourstory.com' },
}

const ALL_CATS: Category[] = [
  'Philosophy',
  'Science',
  'History',
  'Economics',
  'Culture',
  'Technology',
  'Arts',
  'Anthropology',
  'Research',
  'Psychology',
  'Indian Economy',
  'Indian Politics',
  'Indian Culture',
  'Indian Business',
  'Indian Innovation',
]

type GeneratedArticle = {
  title: string
  excerpt: string
  content: string
  references: string[]
  tags: string[]
  category: Category
  source: string
  source_url: string
  date: string
  read_time: number
  sym: string
}

type GeminiArticlePayload = {
  title?: unknown
  excerpt?: unknown
  content?: unknown
  references?: unknown
  refs?: unknown
  tags?: unknown
}

type GenerateOptions = {
  count?: number
  excludeCategories?: Category[]
}

function safeParseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function pickCategories(count: number, excludeCategories: Category[] = []): Category[] {
  const preferred: Category[] = [
    'Technology',
    'Psychology',
    'Culture',
    'Science',
    'Indian Economy',
    'Indian Innovation',
  ]

  const availablePreferred = preferred.filter((c) => !excludeCategories.includes(c))
  if (availablePreferred.length >= count) {
    return availablePreferred.slice(0, count)
  }

  const remaining = ALL_CATS.filter(
    (c) => !excludeCategories.includes(c) && !availablePreferred.includes(c)
  )

  return [...availablePreferred, ...remaining].slice(0, count)
}

function buildPrompt(cat: Category, source: { name: string; url: string }) {
  const isIndia = cat.startsWith('Indian')

  return isIndia
    ? `
Generate a thoughtful article about ${cat} for an Indian audience, in the style of ${source.name}.

Focus on real Indian context, institutions, markets, policies, culture, startups, or public life as appropriate.

Return ONLY valid JSON with exactly this structure:
{
  "title": "Compelling India-focused headline",
  "excerpt": "2 sharp sentences",
  "content": "3 polished paragraphs separated by double newlines",
  "references": ["Source 1", "Source 2"],
  "tags": ["tag1", "tag2", "tag3"]
}

Rules:
- No markdown
- No backticks
- No commentary outside the JSON
- references must be an array of strings
- tags must be an array of strings
- content must be polished and readable
`.trim()
    : `
Generate a thoughtful article about ${cat} in the style of ${source.name}.

Return ONLY valid JSON with exactly this structure:
{
  "title": "Compelling headline",
  "excerpt": "2 sharp sentences",
  "content": "3 polished paragraphs separated by double newlines",
  "references": ["Source 1", "Source 2"],
  "tags": ["tag1", "tag2", "tag3"]
}

Rules:
- No markdown
- No backticks
- No commentary outside the JSON
- references must be an array of strings
- tags must be an array of strings
- content must be polished and readable
`.trim()
}

async function generateOneArticle(
  apiKey: string,
  cat: Category,
  dateStr: string
): Promise<GeneratedArticle | null> {
  const source = REAL_SOURCES[cat]
  if (!source) {
    console.error(`No source configured for ${cat}`)
    return null
  }

  const prompt = buildPrompt(cat, source)

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 600,
            responseMimeType: 'application/json',
          },
        }),
      }
    )

    const rawText = await res.text()
    console.log(`Gemini status for ${cat}: ${res.status}`)
    console.log(`Gemini raw response for ${cat}: ${rawText}`)

    if (!res.ok) {
      console.error(`Gemini failed for ${cat}: ${rawText}`)
      return null
    }

    const envelope = safeParseJson<any>(rawText)
    if (!envelope) {
      console.error(`Failed to parse Gemini envelope for ${cat}`)
      return null
    }

    const contentText = envelope?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!contentText || typeof contentText !== 'string') {
      console.error(`Gemini returned no usable text for ${cat}:`, envelope)
      return null
    }

    const obj = safeParseJson<GeminiArticlePayload>(contentText)
    if (!obj) {
      console.error(`Failed to parse article JSON for ${cat}`)
      console.error(`Article text was: ${contentText}`)
      return null
    }

    const title = typeof obj.title === 'string' ? obj.title.trim() : ''
    const excerpt = typeof obj.excerpt === 'string' ? obj.excerpt.trim() : ''
    const content = typeof obj.content === 'string' ? obj.content.trim() : ''

    const rawReferences = Array.isArray(obj.references)
      ? obj.references
      : Array.isArray(obj.refs)
        ? obj.refs
        : []

    const references = rawReferences.filter((x): x is string => typeof x === 'string')
    const tags = Array.isArray(obj.tags)
      ? obj.tags.filter((x): x is string => typeof x === 'string')
      : []

    if (!title || !excerpt || !content) {
      console.error(`Incomplete article returned for ${cat}:`, obj)
      return null
    }

    return {
      title,
      excerpt,
      content,
      references,
      tags,
      category: cat,
      source: source.name,
      source_url: source.url,
      date: dateStr,
      read_time: 5,
      sym: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
    }
  } catch (err) {
    console.error(`Failed for ${cat}:`, err)
    return null
  }
}

export async function generateDailyArticles(
  dateStr: string,
  options: GenerateOptions = {}
): Promise<GeneratedArticle[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing')
  }

  const count = options.count ?? DEFAULT_DAILY_COUNT
  const excludeCategories = options.excludeCategories ?? []

  const picks = pickCategories(count, excludeCategories)
  console.log('Generating for:', picks.join(', '))

  const articles: GeneratedArticle[] = []

  for (const cat of picks) {
    const art = await generateOneArticle(apiKey, cat, dateStr)
    if (art) {
      articles.push(art)
    }
  }

  console.log(`Total generated: ${articles.length}`)
  console.log('Generated payload:', JSON.stringify(articles))

  return articles
}

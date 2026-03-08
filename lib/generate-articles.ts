import { ALL_CATEGORIES, Category } from '@/types'

const SYMBOLS = ['◈', '✦', '△', '○', '⊕', '♩', '◎', '❋', '◇']
const GEMINI_MODEL = 'gemini-2.5-flash'
const TARGET_DAILY_COUNT = 1

const REAL_SOURCES: Record<Category, { name: string; url: string }[]> = {
  Philosophy: [{ name: 'Aeon', url: 'https://aeon.co' }],
  Science: [{ name: 'Quanta Magazine', url: 'https://www.quantamagazine.org' }],
  History: [{ name: 'Smithsonian Magazine', url: 'https://www.smithsonianmag.com' }],
  Economics: [{ name: 'The Economist', url: 'https://www.economist.com' }],
  Culture: [{ name: 'The Atlantic', url: 'https://www.theatlantic.com' }],
  Technology: [{ name: 'WIRED', url: 'https://www.wired.com' }],
  Arts: [{ name: 'The Paris Review', url: 'https://www.theparisreview.org' }],
  Anthropology: [{ name: 'Sapiens', url: 'https://www.sapiens.org' }],
  Research: [{ name: 'The Conversation', url: 'https://theconversation.com' }],
  Psychology: [{ name: 'Psychology Today', url: 'https://www.psychologytoday.com' }],
  'Indian Economy': [{ name: 'Mint', url: 'https://www.livemint.com' }],
  'Indian Politics': [{ name: 'The Hindu', url: 'https://www.thehindu.com' }],
  'Indian Culture': [{ name: 'Scroll.in', url: 'https://scroll.in' }],
  'Indian Business': [{ name: 'Business Standard', url: 'https://www.business-standard.com' }],
  'Indian Innovation': [{ name: 'YourStory', url: 'https://yourstory.com' }],
}

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function pickCategories(count: number, excludeCategories: Category[] = []): Category[] {
  const preferred: Category[] = ['Technology', 'Psychology', 'Culture']
  return preferred.filter((c) => !excludeCategories.includes(c)).slice(0, count)
}

function buildPrompt(cat: Category, sourceName: string) {
  const isIndiaCategory = cat.startsWith('Indian')

  return isIndiaCategory
    ? `
Generate a thoughtful, original article about ${cat} in the Indian context, in the style of ${sourceName}.

Focus on India-specific developments, institutions, markets, policies, culture, startups, business trends, or public life as appropriate for the category.

Return ONLY valid JSON with exactly this structure:
{
  "title": "A compelling headline",
  "excerpt": "A 2-sentence summary",
  "content": "A detailed 5-paragraph exploration with line breaks",
  "references": ["Source 1", "Source 2"],
  "tags": ["tag1", "tag2"]
}

Rules:
- No markdown
- No backticks
- No commentary outside the JSON
- references must be an array of strings
- tags must be an array of strings
- content should be polished, readable, and insightful
- make the article feel current and grounded in India
`.trim()
    : `
Generate a thoughtful, original article about ${cat} in the style of ${sourceName}.

Return ONLY valid JSON with exactly this structure:
{
  "title": "A compelling headline",
  "excerpt": "A 2-sentence summary",
  "content": "A detailed 5-paragraph exploration with line breaks",
  "references": ["Source 1", "Source 2"],
  "tags": ["tag1", "tag2"]
}

Rules:
- No markdown
- No backticks
- No commentary outside the JSON
- references must be an array of strings
- tags must be an array of strings
- content should be polished and readable
`.trim()
}

async function generateOneArticle(
  apiKey: string,
  cat: Category,
  dateStr: string,
): Promise<GeneratedArticle | null> {
  const source = REAL_SOURCES[cat]?.[0]

  if (!source) {
    console.error(`No source configured for category: ${cat}`)
    return null
  }

  const prompt = buildPrompt(cat, source.name)

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await sleep(5000 * attempt)

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.8,
              maxOutputTokens: 1200,
              responseMimeType: 'application/json',
            },
          }),
        },
      )

      const rawText = await res.text()

      console.log(`Gemini status for ${cat}, attempt ${attempt}: ${res.status}`)
      console.log(`Gemini raw response for ${cat}, attempt ${attempt}: ${rawText}`)

      if (!res.ok) {
        console.error(`Gemini request failed for ${cat}, attempt ${attempt}: ${res.status}`)
        continue
      }

      const envelope = safeParseJson<any>(rawText)
      if (!envelope) {
        console.error(`Failed to parse Gemini API envelope for ${cat}`)
        continue
      }

      const candidate = envelope?.candidates?.[0]
      const text = candidate?.content?.parts?.[0]?.text

      if (!text || typeof text !== 'string') {
        console.error(`Gemini returned no usable text for ${cat}:`, envelope)
        continue
      }

      const parsed = safeParseJson<GeminiArticlePayload>(text)
      if (!parsed) {
        console.error(`Failed to parse article JSON for ${cat}`)
        console.error(`Article text was: ${text}`)
        continue
      }

      const title = typeof parsed.title === 'string' ? parsed.title.trim() : ''
      const excerpt = typeof parsed.excerpt === 'string' ? parsed.excerpt.trim() : ''
      const content = typeof parsed.content === 'string' ? parsed.content.trim() : ''

      const rawReferences = Array.isArray(parsed.references)
        ? parsed.references
        : Array.isArray(parsed.refs)
          ? parsed.refs
          : []

      const references = rawReferences.filter((x): x is string => typeof x === 'string')
      const tags = Array.isArray(parsed.tags)
        ? parsed.tags.filter((x): x is string => typeof x === 'string')
        : []

      if (!title || !excerpt || !content) {
        console.error(`Gemini returned incomplete article for ${cat}:`, parsed)
        continue
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
        read_time: 7,
        sym: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      }
    } catch (error) {
      console.error(`Curation failed for ${cat}, attempt ${attempt}:`, error)
    }
  }

  return null
}

export async function generateDailyArticles(
  dateStr: string,
  options: GenerateOptions = {},
): Promise<GeneratedArticle[]> {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing in environment variables')
  }

  const count = options.count ?? TARGET_DAILY_COUNT
  const excludeCategories = options.excludeCategories ?? []
  const selectedCategories = pickCategories(count, excludeCategories)

  console.log('Selected categories:', JSON.stringify(selectedCategories))

  const articles: GeneratedArticle[] = []

  for (const cat of selectedCategories) {
    const article = await generateOneArticle(apiKey, cat, dateStr)
    if (article) {
      articles.push(article)
      console.log(`Article generated successfully for ${cat}`)
    }
  }

  console.log(`Generated ${articles.length} articles total`)
  console.log('Final generated articles payload:', JSON.stringify(articles))

  return articles
}

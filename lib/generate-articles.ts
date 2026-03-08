import { Category } from '@/types'

const SYMBOLS = ['◈', '✦', '△', '○', '⊕', '♩', '◎', '❋', '◇', '☆', '◉', '⟡']
const GEMINI_MODEL = 'gemini-2.5-flash'
const DEFAULT_DAILY_COUNT = 3

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

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5)
}

function pickCategories(count: number, excludeCategories: Category[] = []): Category[] {
  const available = ALL_CATS.filter((c) => !excludeCategories.includes(c))
  const india = available.filter((c) => c.startsWith('Indian'))
  const global = available.filter((c) => !c.startsWith('Indian'))

  const picked: Category[] = []

  if (india.length > 0) {
    picked.push(...shuffle(india).slice(0, Math.min(1, count)))
  }

  const remaining = count - picked.length
  if (remaining > 0) {
    picked.push(...shuffle(global).slice(0, remaining))
  }

  if (picked.length < count) {
    const leftovers = available.filter((c) => !picked.includes(c))
    picked.push(...shuffle(leftovers).slice(0, count - picked.length))
  }

  return picked.slice(0, count)
}

function buildPrompt(cat: Category, source: { name: string; url: string }) {
  const isIndia = cat.startsWith('Indian')

  return isIndia
    ? `
Generate a thoughtful article about ${cat} for an Indian audience, in the style of ${source.name}.

Focus on real Indian context, institutions, markets, policies, culture, startups, business trends, or public life as appropriate.

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

function buildFallbackArticle(cat: Category, dateStr: string): GeneratedArticle {
  const source = REAL_SOURCES[cat]
  const isIndia = cat.startsWith('Indian')

  const titleMap: Record<Category, string> = {
    Philosophy: 'The Questions That Quietly Shape a Life',
    Science: 'Why Discovery Still Changes How We See the World',
    History: 'What the Past Still Knows About the Present',
    Economics: 'The Hidden Logic Behind Everyday Prosperity',
    Culture: 'How Culture Becomes the Memory of a Society',
    Technology: 'The Tools We Build, and the People They Rebuild',
    Arts: 'Why Great Art Still Feels New',
    Anthropology: 'What Human Rituals Reveal About Modern Life',
    Research: 'Why Good Research Matters Beyond the Lab',
    Psychology: 'The Inner Patterns That Quietly Guide Behaviour',
    'Indian Economy': 'India’s Economic Momentum and the Shape of What Comes Next',
    'Indian Politics': 'How India’s Political Energy Reshapes Public Life',
    'Indian Culture': 'Why Indian Culture Keeps Renewing Itself',
    'Indian Business': 'The New Logic of Indian Business Growth',
    'Indian Innovation': 'How Indian Innovation Is Moving From Promise to Scale',
  }

  const excerptMap: Record<Category, string> = {
    Philosophy: 'Big ideas rarely arrive with noise. They often begin as better questions.',
    Science: 'Science moves forward through method, patience, and surprise. Its impact is both practical and imaginative.',
    History: 'History is not only a record of events. It is also a guide to recurring human choices.',
    Economics: 'Economics is not just about markets. It is about incentives, trade-offs, and the systems that shape ordinary life.',
    Culture: 'Culture lives in habits, language, and symbols. It evolves slowly, then all at once.',
    Technology: 'Technology changes the pace of life first, and the structure of life later. That is why its influence is rarely neutral.',
    Arts: 'Art remains one of the clearest ways a society understands itself. It preserves feeling as much as form.',
    Anthropology: 'Anthropology helps us see the familiar from a useful distance. In that distance, patterns become visible.',
    Research: 'Research creates public value long before it becomes headline news. Its deepest impact is often cumulative.',
    Psychology: 'Psychology explains why thought, emotion, and behaviour do not always move in straight lines. It gives language to inner structure.',
    'Indian Economy': 'India’s economy is being shaped by scale, aspiration, and uneven but real transformation. The next phase will depend on execution as much as ambition.',
    'Indian Politics': 'Indian politics increasingly reflects both democratic intensity and institutional strain. Its outcomes shape everyday citizenship.',
    'Indian Culture': 'Indian culture remains plural, layered, and adaptive. Its energy comes from continuity without stagnation.',
    'Indian Business': 'Indian business is entering a phase where scale, governance, and execution matter more than easy growth stories.',
    'Indian Innovation': 'Indian innovation is now moving beyond startup enthusiasm into durable systems, products, and public infrastructure.',
  }

  const content = isIndia
    ? `India’s current moment makes ${cat.toLowerCase()} especially important to understand. Across markets, institutions, and public debate, the country is trying to balance speed with scale, ambition with capacity, and visibility with long-term depth. That tension is where the most interesting stories now live.

What makes this category especially meaningful is that it cannot be reduced to headlines alone. It is shaped by policy choices, social habits, infrastructure realities, and the growing confidence of a younger generation that expects both opportunity and relevance. In that sense, the story is not just about performance, but direction.

A serious reading of ${cat.toLowerCase()} in India therefore requires both optimism and discipline. The promise is real, but so are the constraints. The most valuable perspective is one that notices movement without mistaking it for completion.`
    : `${cat} remains one of the most useful lenses for understanding modern life. It helps connect individual experience with larger systems of thought, taste, institutions, and historical memory. That is why it continues to matter even when public attention moves quickly elsewhere.

One reason this category endures is that it reveals structures beneath surface events. Whether the subject is behaviour, beauty, evidence, or meaning, the best writing in this space shows how deep assumptions shape ordinary decisions. That is where insight begins.

To read ${cat.toLowerCase()} well is to become more attentive. It trains the mind to notice patterns, trade-offs, and possibilities that are easy to miss in faster forms of discourse. In that sense, it is not only informative, but formative.`

  const tags = isIndia
    ? ['india', cat.toLowerCase().replace(' ', '-'), 'analysis']
    : [cat.toLowerCase(), 'ideas', 'analysis']

  return {
    title: titleMap[cat],
    excerpt: excerptMap[cat],
    content,
    references: [`${source.name}`, source.url],
    tags,
    category: cat,
    source: source.name,
    source_url: source.url,
    date: dateStr,
    read_time: 5,
    sym: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
  }
}

async function generateOneArticle(
  apiKey: string,
  cat: Category,
  dateStr: string,
): Promise<GeneratedArticle | null> {
  const source = REAL_SOURCES[cat]
  if (!source) {
    return null
  }

  const prompt = buildPrompt(cat, source)

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)

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
        signal: controller.signal,
      },
    )

    clearTimeout(timeout)

    const rawText = await res.text()
    console.log(`Gemini status for ${cat}: ${res.status}`)
    console.log(`Gemini raw response for ${cat}: ${rawText}`)

    if (!res.ok) {
      console.error(`Gemini failed for ${cat}: ${rawText}`)
      return null
    }

    const envelope = safeParseJson<any>(rawText)
    if (!envelope) {
      return null
    }

    const text = envelope?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text || typeof text !== 'string') {
      return null
    }

    const obj = safeParseJson<GeminiArticlePayload>(text)
    if (!obj) {
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
    console.error(`Gemini exception for ${cat}:`, err)
    return null
  }
}

export async function generateDailyArticles(
  dateStr: string,
  options: GenerateOptions = {},
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
    const generated = await generateOneArticle(apiKey, cat, dateStr)
    if (generated) {
      articles.push(generated)
    } else {
      console.warn(`Using fallback article for ${cat}`)
      articles.push(buildFallbackArticle(cat, dateStr))
    }
  }

  console.log(`Total generated: ${articles.length}`)
  console.log('Generated payload:', JSON.stringify(articles))

  return articles
}

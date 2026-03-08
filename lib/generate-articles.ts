import { Category } from '@/types'

const SYMBOLS = ['◈', '✦', '△', '○', '⊕', '♩', '◎', '❋', '◇', '☆', '◉', '⟡']

const REAL_SOURCES: Record<Category, { name: string; url: string }> = {
  Philosophy:          { name: 'Aeon', url: 'https://aeon.co' },
  Science:             { name: 'Quanta Magazine', url: 'https://www.quantamagazine.org' },
  History:             { name: 'Smithsonian Magazine', url: 'https://www.smithsonianmag.com' },
  Economics:           { name: 'The Economist', url: 'https://www.economist.com' },
  Culture:             { name: 'The Atlantic', url: 'https://www.theatlantic.com' },
  Technology:          { name: 'WIRED', url: 'https://www.wired.com' },
  Arts:                { name: 'The Paris Review', url: 'https://www.theparisreview.org' },
  Anthropology:        { name: 'Sapiens', url: 'https://www.sapiens.org' },
  Research:            { name: 'The Conversation', url: 'https://theconversation.com' },
  Psychology:          { name: 'Psychology Today', url: 'https://www.psychologytoday.com' },
  'Indian Economy':    { name: 'Mint', url: 'https://www.livemint.com' },
  'Indian Politics':   { name: 'The Hindu', url: 'https://www.thehindu.com' },
  'Indian Culture':    { name: 'Scroll.in', url: 'https://scroll.in' },
  'Indian Business':   { name: 'Business Standard', url: 'https://www.business-standard.com' },
  'Indian Innovation': { name: 'YourStory', url: 'https://yourstory.com' },
}

const ALL_CATS: Category[] = [
  'Philosophy', 'Science', 'History', 'Economics',
  'Culture', 'Technology', 'Arts', 'Anthropology', 'Research',
  'Psychology', 'Indian Economy', 'Indian Politics',
  'Indian Culture', 'Indian Business', 'Indian Innovation',
]

type GeneratedArticle = {
  title: string
  excerpt: string
  content: string
  refs: string[]
  tags: string[]
  category: Category
  source: string
  source_url: string
  date: string
  read_time: number
  sym: string
}

async function generateOneArticle(
  apiKey: string,
  cat: Category,
  dateStr: string
): Promise<GeneratedArticle | null> {
  const source = REAL_SOURCES[cat]
  if (!source) return null

  const isIndia = cat.startsWith('Indian')

  const prompt = isIndia
    ? `Generate a thought-provoking article about ${cat} for an Indian audience, in the style of ${source.name}. Make it grounded in real Indian context.

Return ONLY valid JSON (no markdown, no backticks):
{"title":"compelling India-focused headline","excerpt":"2 sharp sentences","content":"5 paragraphs separated by double newlines with real Indian examples","refs":["Source 1","Source 2"],"tags":["tag1","tag2","tag3"]}`
    : `Generate a thought-provoking article about ${cat} in the style of ${source.name}.

Return ONLY valid JSON (no markdown, no backticks):
{"title":"compelling headline","excerpt":"2 sharp sentences","content":"5 paragraphs separated by double newlines with real thinkers and concepts","refs":["Author A. (Year). Title.","Author B. (Year). Title."],"tags":["tag1","tag2","tag3"]}`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 1200 },
        }),
      }
    )

    const data = await res.json()
    if (!res.ok) {
      console.error(`Gemini failed for ${cat}:`, JSON.stringify(data))
      return null
    }

    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    const obj = JSON.parse(clean)

    return {
      title:      obj.title,
      excerpt:    obj.excerpt,
      content:    obj.content,
      refs:       Array.isArray(obj.refs) ? obj.refs : [],
      tags:       Array.isArray(obj.tags) ? obj.tags : [],
      category:   cat,
      source:     source.name,
      source_url: source.url,
      date:       dateStr,
      read_time:  8,
      sym:        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
    }
  } catch (err) {
    console.error(`Failed for ${cat}:`, err)
    return null
  }
}

export async function generateDailyArticles(dateStr: string): Promise<GeneratedArticle[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing')

  const globalCats = ALL_CATS.filter(c => !c.startsWith('Indian'))
  const indianCats = ALL_CATS.filter(c => c.startsWith('Indian'))

  const picks = [
    ...([...globalCats].sort(() => Math.random() - 0.5).slice(0, 5)),
    ...([...indianCats].sort(() => Math.random() - 0.5).slice(0, 3)),
  ]

  console.log('Generating for:', picks.join(', '))
  const articles: GeneratedArticle[] = []

  for (const cat of picks) {
    const art = await generateOneArticle(apiKey, cat, dateStr)
    if (art) articles.push(art)
  }

  console.log(`Total: ${articles.length}`)
  return articles
}

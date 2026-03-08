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
    ? `Generate a thought-provoking article about ${cat} for an Indian audience, in the style of ${source.name}. Make it grounded in real Indian context — policies, institutions, startups, people, or cultural moments.

Return ONLY valid JSON (no markdown, no backticks):
{
  "title": "A compelling India-focused headline",
  "excerpt": "2 sharp sentences that make a curious reader want more",
  "content": "5 paragraphs separated by double newlines. Real Indian thinkers, companies, events, data points.",
  "refs": ["Author A. (Year). Title. Publisher.", "Source B name"],
  "tags": ["tag1", "tag2", "tag3"]
}`
    : `Generate a thought-provoking article about ${cat} in the style of ${source.name}.

Return ONLY valid JSON (no markdown, no backticks):
{
  "title": "A compelling headline",
  "excerpt": "2 sharp sentences that make a curious reader want more",
  "content": "5 paragraphs separated by double newlines. Real thinkers, studies, concepts.",
  "refs": ["Author A. (Year). Title. Publisher.", "Author B. (Year). Title. Journal."],
  "tags": ["tag1", "tag2", "tag3"]
}`

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
    console.log(`Gemini status for ${cat}: ${res.status}`)

    if (!res.ok) {
      console.error(`Gemini failed for ${cat}:`, JSON.stringify(data))
      return null
    }

    const raw   = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    const obj   = JSON.parse(clean)

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

  // Pick 5 global + 3 Indian categories every day for a balanced mix
  const globalCats = ALL_CATS.filter(c => !c.startsWith('Indian'))
  const indianCats = ALL_CATS.filter(c => c.startsWith('Indian'))

  const shuffledGlobal = [...globalCats].sort(() => Math.random() - 0.5).slice(0, 5)
  const shuffledIndian = [...indianCats].sort(() => Math.random() - 0.5).slice(0, 3)
  const picks = [...shuffledGlobal, ...shuffledIndian]

  console.log('Generating articles for:', picks.join(', '))

  const articles: GeneratedArticle[] = []

  for (const cat of picks) {
    const art = await generateOneArticle(apiKey, cat, dateStr)
    if (art) {
      articles.push(art)
      console.log(`✓ Generated: ${art.title}`)
    }
  }

  console.log(`Total generated: ${articles.length}`)
  return articles
}
```

Scroll down → **Commit changes**.

---

**Finally, update the UI category pills** — edit `components/CuriosaClient.tsx` on GitHub, find this line near the top:
```
const ALL_CATEGORIES: Category[] = [
```

And just below it you'll see the array. We need to update the import instead. Find this line at the very top of the file:
```
ALL_CATEGORIES, CATEGORY_COLORS,
```

That's already imported from types so it will pick up the new categories automatically once types is updated. ✅

---

Wait 2 minutes for Vercel to rebuild, then trigger:
```
https://curiosa-tan.vercel.app/api/cron/generate-articles?secret=curiosa2026
